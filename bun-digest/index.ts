import { createClient, type Client } from "@libsql/client";
import { formatArticleDate, parseUtcDate } from "./formatDate.ts";
import { marked } from "marked";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export interface AppServerOptions {
  port?: number;
  hostname?: string;
  dbUrl?: string;
  authToken?: string;
  dbPath?: string;
  enableCron?: boolean;
  maxRetainedPosts?: number;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderMarkdown(markdown: string): string {
  if (typeof Bun !== "undefined" && Bun.markdown?.html) {
    return Bun.markdown.html(markdown);
  }
  return marked.parse(markdown, { async: false }) as string;
}

const currentFile =
  typeof import.meta.url === "string" && import.meta.url.startsWith("file:")
    ? fileURLToPath(import.meta.url)
    : "";
const currentDir = currentFile ? dirname(currentFile) : process.cwd();

const templateCache = new Map<string, string>();

function getTemplate(filename: string): string {
  if (templateCache.has(filename)) {
    return templateCache.get(filename)!;
  }

  const candidatePaths = [
    join(process.cwd(), "templates", filename),
    join(process.cwd(), "public", filename),
    join(process.cwd(), filename),
    join(currentDir, "templates", filename),
    join(currentDir, "public", filename),
    join(currentDir, "..", "templates", filename),
    join(currentDir, "..", "public", filename),
  ];

  for (const p of candidatePaths) {
    if (existsSync(p)) {
      const content = readFileSync(p, "utf-8");
      templateCache.set(filename, content);
      return content;
    }
  }
  return "";
}

export function createRequestHandler(options: AppServerOptions = {}) {
  const maxRetainedPosts = options.maxRetainedPosts ?? 50;

  const url =
    options.dbUrl ??
    (options.dbPath
      ? options.dbPath.startsWith("file:") || options.dbPath === ":memory:"
        ? options.dbPath
        : `file:${options.dbPath}`
      : process.env.TURSO_URL ?? "file:content.db");

  const authToken =
    options.authToken ??
    process.env.TURSO_AUTH_TOKEN ??
    process.env.TURSO_TOKEN;

  // 1. LibSQL / Turso setup
  const db: Client = createClient({
    url,
    authToken:
      url.startsWith("libsql://") || url.startsWith("https://") || url.startsWith("http://")
        ? authToken
        : undefined,
  });

  const initDbPromise = db.execute(`
    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE,
      title TEXT,
      markdown_content TEXT,
      html_content TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  async function handleRequest(req: Request): Promise<Response> {
    await initDbPromise;
    const reqUrl = new URL(req.url, "http://localhost");

    // Static Asset Serving (styles.css fallback)
    if (
      req.method === "GET" &&
      (reqUrl.pathname === "/styles.css" || reqUrl.pathname === "/public/styles.css")
    ) {
      const cssContent = getTemplate("styles.css");
      if (cssContent) {
        return new Response(cssContent, {
          headers: { "Content-Type": "text/css; charset=utf-8" },
        });
      }
    }

    // Cron maintenance route (for Vercel Cron or webhooks)
    if (
      (req.method === "GET" || req.method === "POST") &&
      (reqUrl.pathname === "/api/cron" || reqUrl.pathname === "/cron")
    ) {
      try {
        const result = await db.execute({
          sql: `
            DELETE FROM articles WHERE id NOT IN (
              SELECT id FROM articles ORDER BY id DESC LIMIT ?
            )
          `,
          args: [maxRetainedPosts],
        });
        return Response.json({
          success: true,
          deleted: result.rowsAffected,
          maxRetainedPosts,
        });
      } catch (err: unknown) {
        return new Response(JSON.stringify({ error: (err as Error).message }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Root UI Route (GET /)
    if (req.method === "GET" && reqUrl.pathname === "/") {
      const template = getTemplate("home.html");
      const res = await db.execute(
        "SELECT id, slug, title, created_at FROM articles ORDER BY id DESC LIMIT 20"
      );
      const articles = res.rows as unknown as Array<{
        slug: string;
        title: string;
        created_at: string;
      }>;

      const linksHtml = articles.length
        ? articles
            .map((a) => {
              const { shortDate } = formatArticleDate(a.created_at);
              return `<li><a href="/articles/${a.slug}">${a.title}</a> &mdash; <small class="meta">${shortDate}</small> &mdash; <small><a href="/api/articles/${a.slug}" target="_blank">JSON</a></small></li>`;
            })
            .join("")
        : "<li><em>No articles published yet.</em></li>";

      const renderedHtml = template.replace("<!-- ARTICLES_LIST -->", linksHtml);

      return new Response(renderedHtml, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // Render HTML Blog Post View (GET /articles/:slug)
    if (req.method === "GET" && reqUrl.pathname.startsWith("/articles/")) {
      const slug = reqUrl.pathname.replace("/articles/", "");
      const res = await db.execute({
        sql: "SELECT * FROM articles WHERE slug = ?",
        args: [slug],
      });
      const article = res.rows[0] as unknown as
        | { id: number; slug: string; title: string; html_content: string; created_at: string }
        | undefined;

      if (!article) {
        return new Response("Article not found", {
          status: 404,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }

      // Temporal date formatting
      const dateFormats = formatArticleDate(article.created_at);
      const isoDate = parseUtcDate(article.created_at).toString();

      const [prevRes, nextRes] = await Promise.all([
        db.execute({
          sql: "SELECT slug, title FROM articles WHERE id < ? ORDER BY id DESC LIMIT 1",
          args: [article.id],
        }),
        db.execute({
          sql: "SELECT slug, title FROM articles WHERE id > ? ORDER BY id ASC LIMIT 1",
          args: [article.id],
        }),
      ]);

      const prevArticle = prevRes.rows[0] as unknown as
        | { slug: string; title: string }
        | undefined;
      const nextArticle = nextRes.rows[0] as unknown as
        | { slug: string; title: string }
        | undefined;

      const prevPostHtml = prevArticle
        ? `<a href="/articles/${escapeHtml(prevArticle.slug)}" class="nav-card nav-prev" rel="prev" id="prevPostLink">
            <span class="nav-card-label">
              <span aria-hidden="true">&larr;</span> Previous Post <kbd class="nav-keyboard-hint">&larr;</kbd>
            </span>
            <span class="nav-card-title">${escapeHtml(prevArticle.title)}</span>
          </a>`
        : `<div class="nav-card nav-prev disabled" aria-disabled="true">
            <span class="nav-card-label">
              <span aria-hidden="true">&larr;</span> Previous Post
            </span>
            <span class="nav-card-title">No older posts</span>
          </div>`;

      const nextPostHtml = nextArticle
        ? `<a href="/articles/${escapeHtml(nextArticle.slug)}" class="nav-card nav-next" rel="next" id="nextPostLink">
            <span class="nav-card-label">
              Next Post <kbd class="nav-keyboard-hint">&rarr;</kbd> <span aria-hidden="true">&rarr;</span>
            </span>
            <span class="nav-card-title">${escapeHtml(nextArticle.title)}</span>
          </a>`
        : `<div class="nav-card nav-next disabled" aria-disabled="true">
            <span class="nav-card-label">
              Next Post <span aria-hidden="true">&rarr;</span>
            </span>
            <span class="nav-card-title">No newer posts</span>
          </div>`;

      const headLinks: string[] = [];
      const prefetchUrls: string[] = [];
      if (prevArticle) {
        headLinks.push(`<link rel="prev" href="/articles/${escapeHtml(prevArticle.slug)}" />`);
        prefetchUrls.push(`/articles/${prevArticle.slug}`);
      }
      if (nextArticle) {
        headLinks.push(`<link rel="next" href="/articles/${escapeHtml(nextArticle.slug)}" />`);
        prefetchUrls.push(`/articles/${nextArticle.slug}`);
      }
      if (prefetchUrls.length > 0) {
        headLinks.push(
          `<script type="speculationrules">${JSON.stringify({
            prefetch: [{ source: "list", urls: prefetchUrls, eagerness: "eager" }],
          })}</script>`
        );
      }

      const template = getTemplate("blog-post.html");
      const renderedHtml = template
        .replaceAll("{{TITLE}}", article.title)
        .replaceAll("{{ISO_DATE}}", isoDate)
        .replaceAll("{{FORMATTED_DATE}}", dateFormats.longDate)
        .replaceAll("{{RELATIVE_DATE}}", dateFormats.relativeTime)
        .replaceAll("{{HTML_CONTENT}}", article.html_content)
        .replaceAll("{{HEAD_LINKS}}", headLinks.join("\n  "))
        .replaceAll("{{PREV_POST}}", prevPostHtml)
        .replaceAll("{{NEXT_POST}}", nextPostHtml);

      return new Response(renderedHtml, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // JSON API: List articles (GET /api/articles)
    if (req.method === "GET" && reqUrl.pathname === "/api/articles") {
      const res = await db.execute(
        "SELECT id, slug, title, created_at FROM articles ORDER BY id DESC LIMIT 20"
      );
      return Response.json(res.rows);
    }

    // JSON API: Retrieve single article raw (GET /api/articles/:slug)
    if (req.method === "GET" && reqUrl.pathname.startsWith("/api/articles/")) {
      const slug = reqUrl.pathname.replace("/api/articles/", "");
      const res = await db.execute({
        sql: "SELECT * FROM articles WHERE slug = ?",
        args: [slug],
      });
      const article = res.rows[0];

      if (!article) {
        return new Response(JSON.stringify({ error: "Article not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
      return Response.json(article);
    }

    // Ingest & render Markdown (POST /api/articles)
    if (req.method === "POST" && reqUrl.pathname === "/api/articles") {
      try {
        const body = (await req.json()) as { slug: string; title: string; markdown: string };

        if (!body.slug || !body.title || !body.markdown) {
          return new Response(
            JSON.stringify({ error: "slug, title, and markdown fields are required" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        const html = renderMarkdown(body.markdown);

        await db.execute({
          sql: `
            INSERT INTO articles (slug, title, markdown_content, html_content)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(slug) DO UPDATE SET
              title=excluded.title,
              markdown_content=excluded.markdown_content,
              html_content=excluded.html_content
          `,
          args: [body.slug, body.title, body.markdown, html],
        });

        return Response.json({ success: true, slug: body.slug }, { status: 201 });
      } catch (err: unknown) {
        return new Response(JSON.stringify({ error: (err as Error).message }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    return new Response("Not Found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return {
    handleRequest,
    db,
    ready: initDbPromise,
  };
}

export function createAppServer(options: AppServerOptions = {}) {
  const port = options.port ?? 5173;
  const hostname = options.hostname ?? "0.0.0.0";
  const maxRetainedPosts = options.maxRetainedPosts ?? 50;

  const { handleRequest, db, ready } = createRequestHandler(options);

  // Background Cron Scheduler (optional for standalone Bun servers)
  let cronJob: any = null;
  if (options.enableCron && typeof Bun !== "undefined" && typeof Bun.cron === "function") {
    cronJob = Bun.cron("0 * * * *", async () => {
      try {
        const result = await db.execute({
          sql: `
            DELETE FROM articles WHERE id NOT IN (
              SELECT id FROM articles ORDER BY id DESC LIMIT ?
            )
          `,
          args: [maxRetainedPosts],
        });
        console.log(`[CRON] Cleaned up old articles: ${result.rowsAffected} deleted`);
      } catch (err) {
        console.error("[CRON] Cleanup failed:", err);
      }
    });
  }

  const server = Bun.serve({
    port,
    hostname,
    fetch: handleRequest,
  });

  return {
    server,
    db,
    cronJob,
    ready,
    stop: () => {
      server.stop(true);
      db.close();
    },
  };
}

if (typeof import.meta !== "undefined" && (import.meta as any).main) {
  const rawConfig = await Bun.file("config.json5").text();
  const config = Bun.JSON5.parse(rawConfig) as {
    server?: { port?: number; hostname?: string };
    maxRetainedPosts?: number;
  };

  const { server, ready } = createAppServer({
    port: config?.server?.port,
    hostname: config?.server?.hostname,
    enableCron: true,
    maxRetainedPosts: config?.maxRetainedPosts,
  });

  await ready;
  console.log(`Server listening on http://${server.hostname}:${server.port}`);
  if (process.env.TURSO_URL) {
    console.log(`Connected to Turso database: ${process.env.TURSO_URL}`);
  }
}

// Default export for Vercel Bun Serverless Runtime
const defaultApp = createRequestHandler({
  enableCron: process.env.ENABLE_CRON === "true",
});

const defaultHandler = Object.assign(
  (req: Request) => defaultApp.handleRequest(req),
  { fetch: (req: Request) => defaultApp.handleRequest(req) }
);

export default defaultHandler;

