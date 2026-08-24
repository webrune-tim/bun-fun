import { createClient, type Client } from "@libsql/client";
import { formatArticleDate, parseUtcDate } from "./formatDate.ts";

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

export function createAppServer(options: AppServerOptions = {}) {
  const port = options.port ?? 5173;
  const hostname = options.hostname ?? "0.0.0.0";
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

  // 2. Background Cron Scheduler (optional for tests)
  let cronJob: any = null;
  if (options.enableCron) {
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

  // 3. Native HTTP Server
  const server = Bun.serve({
    port,
    hostname,

    async fetch(req) {
      await initDbPromise;
      const url = new URL(req.url);

      // Static Asset Serving (styles.css)
      if (req.method === "GET" && url.pathname === "/styles.css") {
        const file = Bun.file("templates/styles.css");
        if (await file.exists()) {
          return new Response(file, {
            headers: { "Content-Type": "text/css; charset=utf-8" },
          });
        }
      }

      // Root UI Route (GET /)
      if (req.method === "GET" && url.pathname === "/") {
        const template = await Bun.file("templates/home.html").text();
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
      if (req.method === "GET" && url.pathname.startsWith("/articles/")) {
        const slug = url.pathname.replace("/articles/", "");
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

        const template = await Bun.file("templates/blog-post.html").text();
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
      if (req.method === "GET" && url.pathname === "/api/articles") {
        const res = await db.execute(
          "SELECT id, slug, title, created_at FROM articles ORDER BY id DESC LIMIT 20"
        );
        return Response.json(res.rows);
      }

      // JSON API: Retrieve single article raw (GET /api/articles/:slug)
      if (req.method === "GET" && url.pathname.startsWith("/api/articles/")) {
        const slug = url.pathname.replace("/api/articles/", "");
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
      if (req.method === "POST" && url.pathname === "/api/articles") {
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

          const html = Bun.markdown.html(body.markdown);

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
    },
  });

  return {
    server,
    db,
    cronJob,
    ready: initDbPromise,
    stop: () => {
      server.stop(true);
      db.close();
    },
  };
}

if (import.meta.main) {
  const rawConfig = await Bun.file("config.json5").text();
  const config = Bun.JSON5.parse(rawConfig);

  const { server, ready } = createAppServer({
    port: config.server.port,
    hostname: config.server.hostname,
    enableCron: true,
    maxRetainedPosts: config.maxRetainedPosts,
  });

  await ready;
  console.log(`Server listening on http://${server.hostname}:${server.port}`);
  if (process.env.TURSO_URL) {
    console.log(`Connected to Turso database: ${process.env.TURSO_URL}`);
  }
}

