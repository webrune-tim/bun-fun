import type { Client } from "@libsql/client/web";
import { formatArticleDate, parseUtcDate } from "./formatDate.ts";
import { createAuth, initAuthDatabase, AUTH_DB_DDL, createDbClient } from "./auth.ts";
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
  authBaseURL?: string;
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
    try {
      if (existsSync(p)) {
        const content = readFileSync(p, "utf-8");
        templateCache.set(filename, content);
        return content;
      }
    } catch {
      // ignore fs error and try next path
    }
  }

  return "";
}

export function createRequestHandler(options: AppServerOptions = {}) {
  const maxRetainedPosts = options.maxRetainedPosts ?? 50;

  const isServerlessEnv = Boolean(
    process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT
  );

  const defaultLocalDb = isServerlessEnv ? "file:/tmp/content.db" : "file:content.db";

  const url =
    options.dbUrl ??
    (options.dbPath
      ? options.dbPath.startsWith("file:") || options.dbPath === ":memory:"
        ? options.dbPath
        : `file:${options.dbPath}`
      : process.env.TURSO_URL ?? defaultLocalDb);

  const authToken =
    options.authToken ??
    process.env.TURSO_AUTH_TOKEN ??
    process.env.TURSO_TOKEN;

  // 1. LibSQL / Turso client setup
  const db: Client = createDbClient({
    url,
    authToken:
      url.startsWith("libsql://") || url.startsWith("https://") || url.startsWith("http://")
        ? authToken
        : undefined,
  });

  // 2. BetterAuth setup with shared LibSQL client
  const auth = createAuth({
    client: db,
    baseURL: options.authBaseURL || process.env.BETTER_AUTH_URL || (options.port ? `http://127.0.0.1:${options.port}` : undefined),
  });

  let initDbPromise: Promise<any> | null = null;
  function ensureDbInitialized(): Promise<any> {
    if (!initDbPromise) {
      initDbPromise = initAuthDatabase(db).catch((err) => {
        console.error("[Database Init Error]:", err);
        initDbPromise = null;
        throw err;
      });
    }
    return initDbPromise;
  }

  // Trigger init on creation
  ensureDbInitialized().catch(() => {});

  async function handleRequest(req: Request): Promise<Response> {
    const reqUrl = new URL(req.url, "http://localhost");

    // Favicon handler
    if (req.method === "GET" && reqUrl.pathname === "/favicon.ico") {
      return new Response(null, { status: 204 });
    }

    // Static Asset Serving (styles.css)
    if (
      req.method === "GET" &&
      (reqUrl.pathname === "/styles.css" || reqUrl.pathname === "/public/styles.css")
    ) {
      const cssContent = getTemplate("styles.css");
      return new Response(cssContent, {
        headers: { "Content-Type": "text/css; charset=utf-8" },
      });
    }

    // 3. BetterAuth API Endpoint Routing (/api/auth/*)
    if (reqUrl.pathname.startsWith("/api/auth")) {
      return auth.handler(req);
    }

    try {
      await ensureDbInitialized();

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

        // Fetch current session for active user
        const session = await auth.api.getSession({
          headers: req.headers,
        });

        const res = await db.execute(
          "SELECT id, slug, title, author_name, author_email, created_at FROM articles ORDER BY id DESC LIMIT 20"
        );
        const articles = res.rows as unknown as Array<{
          slug: string;
          title: string;
          author_name?: string;
          author_email?: string;
          created_at: string;
        }>;

        const linksHtml = articles.length
          ? articles
              .map((a) => {
                const { shortDate } = formatArticleDate(a.created_at);
                const authorDisplay = a.author_name
                  ? `<span>by <span class="author-tag">${escapeHtml(a.author_name)}</span></span> &bull; `
                  : "";
                return `<li class="article-item">
                  <div class="article-title-row">
                    <a href="/articles/${escapeHtml(a.slug)}" class="article-title-link">${escapeHtml(a.title)}</a>
                    <small><a href="/api/articles/${escapeHtml(a.slug)}" target="_blank">JSON</a></small>
                  </div>
                  <div class="article-meta-row">
                    ${authorDisplay}<time>${shortDate}</time>
                  </div>
                </li>`;
              })
              .join("")
          : "<li><em>No articles published yet.</em></li>";

        // Generate Auth Status Bar HTML
        let authStatusBarHtml = "";
        let authFormNoticeHtml = "";
        if (session?.user) {
          const initial = session.user.name ? session.user.name.charAt(0).toUpperCase() : "U";
          authStatusBarHtml = `
            <div class="user-badge" id="userBadge">
              <span class="user-avatar">${escapeHtml(initial)}</span>
              <span class="user-name">${escapeHtml(session.user.name || session.user.email)}</span>
            </div>
            <button type="button" class="btn-outline" onclick="handleSignOut()" id="signOutBtn">Sign Out</button>
          `;
          authFormNoticeHtml = `
            <div class="auth-notice" id="authNotice">
              Posting as <strong>${escapeHtml(session.user.name || "User")}</strong> (${escapeHtml(session.user.email)})
            </div>
          `;
        } else {
          authStatusBarHtml = `
            <button type="button" class="btn-outline" onclick="openAuthModal('signin')" id="signInBtn">Sign In</button>
            <button type="button" onclick="openAuthModal('signup')" id="signUpBtn">Create Account</button>
          `;
          authFormNoticeHtml = `
            <div class="auth-notice warning" id="authNotice">
              <p>You must be signed in to publish articles.</p>
              <button type="button" onclick="openAuthModal('signin')" style="margin-top: 0.5rem; font-size: 0.85rem; padding: 0.35rem 0.75rem;">Sign In to Post</button>
            </div>
          `;
        }

        const renderedHtml = template
          .replace("<!-- ARTICLES_LIST -->", linksHtml)
          .replace("<!-- AUTH_STATUS_BAR -->", authStatusBarHtml)
          .replace("<!-- AUTH_FORM_NOTICE -->", authFormNoticeHtml);

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
          | {
              id: number;
              slug: string;
              title: string;
              html_content: string;
              author_name?: string;
              author_email?: string;
              created_at: string;
            }
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

        const authorInfoHtml = article.author_name
          ? `by <span class="author-name-highlight">${escapeHtml(article.author_name)}</span>`
          : "";

        const template = getTemplate("blog-post.html");
        const renderedHtml = template
          .replaceAll("{{TITLE}}", article.title)
          .replaceAll("{{AUTHOR_INFO}}", authorInfoHtml)
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
          "SELECT id, slug, title, author_id, author_name, author_email, created_at FROM articles ORDER BY id DESC LIMIT 20"
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

      // Ingest & render Markdown (POST /api/articles) - Tie new posts to authenticated user
      if (req.method === "POST" && reqUrl.pathname === "/api/articles") {
        try {
          // Check BetterAuth user session
          const session = await auth.api.getSession({
            headers: req.headers,
          });

          if (!session?.user) {
            return new Response(
              JSON.stringify({ error: "Authentication required to publish articles. Please sign in." }),
              {
                status: 401,
                headers: { "Content-Type": "application/json" },
              }
            );
          }

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
              INSERT INTO articles (slug, title, markdown_content, html_content, author_id, author_name, author_email)
              VALUES (?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(slug) DO UPDATE SET
                title=excluded.title,
                markdown_content=excluded.markdown_content,
                html_content=excluded.html_content,
                author_id=excluded.author_id,
                author_name=excluded.author_name,
                author_email=excluded.author_email
            `,
            args: [
              body.slug,
              body.title,
              body.markdown,
              html,
              session.user.id,
              session.user.name,
              session.user.email,
            ],
          });

          return Response.json(
            {
              success: true,
              slug: body.slug,
              author: {
                id: session.user.id,
                name: session.user.name,
                email: session.user.email,
              },
            },
            { status: 201 }
          );
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
    } catch (err: unknown) {
      console.error("[Request Error]:", err);
      const errorMessage = (err as Error)?.message || String(err);
      if (reqUrl.pathname.startsWith("/api/")) {
        return new Response(JSON.stringify({ error: errorMessage }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(
        `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Application Error</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body style="padding: 2rem; font-family: system-ui, sans-serif;">
  <h1>Application Error</h1>
  <p>An error occurred while handling this request:</p>
  <pre style="background: #f4f4f5; padding: 1rem; border-radius: 6px; color: #b91c1c; overflow-x: auto;">${escapeHtml(errorMessage)}</pre>
  <p><small>If you are deploying to Vercel, ensure <code>TURSO_URL</code>, <code>TURSO_AUTH_TOKEN</code>, and <code>BETTER_AUTH_SECRET</code> are added to your Vercel Project Settings &rarr; Environment Variables.</small></p>
  <p><a href="/">&larr; Return Home</a></p>
</body>
</html>`,
        {
          status: 500,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        }
      );
    }
  }

  return {
    handleRequest,
    db,
    auth,
    ready: initDbPromise ?? Promise.resolve(),
  };
}

export function createAppServer(options: AppServerOptions = {}) {
  const port = options.port ?? 5173;
  const hostname = options.hostname ?? "0.0.0.0";
  const maxRetainedPosts = options.maxRetainedPosts ?? 50;

  const { handleRequest, db, auth, ready } = createRequestHandler(options);

  // Background Cron Scheduler
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
    auth,
    cronJob,
    ready,
    stop: () => {
      server.stop(true);
      db.close();
    },
  };
}

if (
  !process.env.VERCEL &&
  !process.env.AWS_LAMBDA_FUNCTION_NAME &&
  typeof import.meta !== "undefined" &&
  (import.meta as any).main
) {
  try {
    let config: {
      server?: { port?: number; hostname?: string };
      maxRetainedPosts?: number;
    } = {};

    const configFile = Bun.file("config.json5");
    if (await configFile.exists()) {
      const rawConfig = await configFile.text();
      config = Bun.JSON5.parse(rawConfig) as {
        server?: { port?: number; hostname?: string };
        maxRetainedPosts?: number;
      };
    }

    const { server, ready } = createAppServer({
      port: config?.server?.port ?? 5173,
      hostname: config?.server?.hostname ?? "0.0.0.0",
      enableCron: true,
      maxRetainedPosts: config?.maxRetainedPosts ?? 50,
    });

    await ready;
    console.log(`Server listening on http://${server.hostname}:${server.port}`);
    if (process.env.TURSO_URL) {
      console.log(`Connected to Turso database: ${process.env.TURSO_URL}`);
    }
  } catch (err) {
    console.error("[Startup Error]:", err);
  }
}

// Lazy-initialized default export for Vercel Bun Serverless Runtime
let lazyAppInstance: ReturnType<typeof createRequestHandler> | null = null;
function getLazyApp() {
  if (!lazyAppInstance) {
    lazyAppInstance = createRequestHandler({
      enableCron: process.env.ENABLE_CRON === "true",
    });
  }
  return lazyAppInstance;
}

const defaultHandler = Object.assign(
  (req: Request) => getLazyApp().handleRequest(req),
  {
    fetch: (req: Request) => getLazyApp().handleRequest(req),
  }
);

export default defaultHandler;
