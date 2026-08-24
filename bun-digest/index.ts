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

const FALLBACK_STYLES_CSS = `@layer reset, base, home, blog;

@layer reset {
  *, *::before, *::after { box-sizing: border-box; }
  body, h1, h2, ul, li, p { margin: 0; }
  ul { padding: 0; }
}

@layer base {
  :root {
    color-scheme: light dark;
    --bg-light: #ffffff;
    --bg-dark: #121212;
    --surface-light: #f5f6f8;
    --surface-dark: #1e1e24;
    --text-light: #18181b;
    --text-dark: #f4f4f5;
    --text-muted-light: #424750;
    --text-muted-dark: #c4c8d0;
    --border-light: #71717a;
    --border-dark: #8e8e93;
    --border-subtle-light: #e4e4e7;
    --border-subtle-dark: #27272a;
    --accent-light: #5b21b6;
    --accent-dark: #caa4ff;
    --accent-hover-light: #4c1d95;
    --accent-hover-dark: #dec7ff;
    --accent-contrast-light: #ffffff;
    --accent-contrast-dark: #0f081d;

    --bg: light-dark(var(--bg-light), var(--bg-dark));
    --surface: light-dark(var(--surface-light), var(--surface-dark));
    --text: light-dark(var(--text-light), var(--text-dark));
    --text-muted: light-dark(var(--text-muted-light), var(--text-muted-dark));
    --border: light-dark(var(--border-light), var(--border-dark));
    --border-subtle: light-dark(var(--border-subtle-light), var(--border-subtle-dark));
    --accent: light-dark(var(--accent-light), var(--accent-dark));
    --accent-hover: light-dark(var(--accent-hover-light), var(--accent-hover-dark));
    --accent-contrast: light-dark(var(--accent-contrast-light), var(--accent-contrast-dark));
    --focus-ring: light-dark(var(--accent-light), var(--accent-dark));

    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    line-height: 1.6;
  }

  body { max-width: 1000px; margin: 2rem auto; padding: 0 1rem; background-color: var(--bg); color: var(--text); }
  header { margin-bottom: 2rem; text-align: center; }
  h1, h2 { margin-bottom: 0.75rem; color: var(--text); }
  p { margin-bottom: 1rem; }
  a { color: var(--accent); text-decoration: underline; text-underline-offset: 3px; }
  a:hover { color: var(--accent-hover); }
  a:focus-visible, button:focus-visible, input:focus-visible, textarea:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
  hr { margin: 2rem 0; border: none; border-top: 1px solid var(--border-subtle); }
  textarea, input { width: 100%; margin-bottom: 0.75rem; padding: 0.5rem; font-family: inherit; font-size: 1rem; color: var(--text); background-color: var(--surface); border: 1px solid var(--border); border-radius: 4px; }
  input::placeholder, textarea::placeholder { color: var(--text-muted); opacity: 1; }
  textarea { height: 140px; font-family: monospace; resize: vertical; }
  button { padding: 0.6rem 1.2rem; cursor: pointer; font-size: 1rem; font-weight: 600; border-radius: 4px; border: none; background-color: var(--accent); color: var(--accent-contrast); transition: opacity 0.15s ease-in-out; }
  button:hover { opacity: 0.92; }
  pre { background-color: var(--surface); padding: 1rem; border-radius: 6px; overflow-x: auto; border: 1px solid var(--border-subtle); color: var(--text); }
  code { font-family: monospace; font-size: 0.9em; }
}

@layer home {
  ul { padding-left: 1.2rem; list-style-type: disc; }
  li { margin-bottom: 0.5rem; }
  .grid { display: grid; grid-template-columns: 300px 1fr; gap: clamp(1.125rem, 1.0739rem + 0.2273vw, 1.25rem); }
  @media (max-width: 1000px) { .grid { grid-template-columns: 1fr; } }
}

@layer blog {
  header { margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border-subtle); }
  h1 { font-size: 2.25rem; line-height: 1.2; margin-bottom: 0.5rem; }
  .meta { color: var(--text-muted); font-size: 0.9rem; }
  .content { margin-top: 1.5rem; }
  .post-nav { margin-top: 3rem; padding-top: 1.5rem; border-top: 1px solid var(--border-subtle); display: flex; flex-direction: column; gap: 1.5rem; }
  .post-nav-links { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  @media (max-width: 600px) { .post-nav-links { grid-template-columns: 1fr; } }
  .nav-card { display: flex; flex-direction: column; padding: 1rem 1.25rem; background-color: var(--surface); border: 1px solid var(--border-subtle); border-radius: 8px; text-decoration: none; transition: transform 0.15s ease, border-color 0.15s ease; color: var(--text); }
  .nav-card:hover:not(.disabled) { border-color: var(--accent); transform: translateY(-2px); }
  .nav-card.nav-prev { text-align: left; }
  .nav-card.nav-next { text-align: right; }
  .nav-card-label { display: flex; align-items: center; gap: 0.5rem; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); margin-bottom: 0.35rem; }
  .nav-card.nav-next .nav-card-label { justify-content: flex-end; }
  .nav-card-title { font-size: 1rem; font-weight: 600; color: var(--accent); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .nav-card.disabled { opacity: 0.5; cursor: not-allowed; border-style: dashed; }
  .nav-card.disabled .nav-card-title { color: var(--text-muted); font-weight: 400; }
  .nav-keyboard-hint { display: inline-block; padding: 0.1em 0.35em; font-size: 0.7rem; font-family: monospace; background: var(--bg); border: 1px solid var(--border-subtle); border-radius: 4px; color: var(--text-muted); }
  .post-nav-home { text-align: center; }
  .nav-home-link { display: inline-block; color: var(--text-muted); text-decoration: underline; text-underline-offset: 3px; font-size: 0.95rem; }
  .nav-home-link:hover { color: var(--accent-hover); }
}`;

const FALLBACK_HOME_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="/styles.css" />
  <title>Bun Digest</title>
</head>
<body>
  <header>
    <h1>Bun Digest</h1>
    <p>Lightweight native content engine running on Bun 1.4 APIs.</p>
  </header>

  <section class="grid">
    <div>
      <h2>Articles List</h2>
      <ul>
        <!-- ARTICLES_LIST -->
      </ul>
    </div>

    <div class="card">
    <h2>Publish Markdown Article</h2>
    <form id="postForm">
      <input id="title" type="text" placeholder="Article Title" required />
      <input id="slug" type="text" placeholder="slug (e.g., post-one)" required />
      <textarea id="markdown" placeholder="## Write markdown here..." required></textarea>
      <button type="submit">Submit & Compile</button>
    </form>
    </div>
  </section>

  <script>
    document.getElementById('postForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        title: document.getElementById('title').value,
        slug: document.getElementById('slug').value,
        markdown: document.getElementById('markdown').value
      };
      const res = await fetch('/api/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        window.location.href = '/articles/' + payload.slug;
      } else {
        alert('Failed to save article');
      }
    });
  </script>
</body>
</html>`;

const FALLBACK_BLOG_POST_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="/styles.css">
  {{HEAD_LINKS}}
  <title>{{TITLE}}</title>
</head>
<body>
  <header>
    <h1>{{TITLE}}</h1>
    <div class="meta">
      Published on <time datetime="{{ISO_DATE}}">{{FORMATTED_DATE}}</time>
      <span class="relative-date">({{RELATIVE_DATE}})</span>
    </div>
  </header>

  <article class="content">
    {{HTML_CONTENT}}
  </article>

  <nav class="post-nav" aria-label="Post navigation">
    <div class="post-nav-links">
      {{PREV_POST}}
      {{NEXT_POST}}
    </div>
    <div class="post-nav-home">
      <a href="/" class="nav-home-link">&larr; Back to Home</a>
    </div>
  </nav>

  <script>
    document.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) || document.activeElement?.isContentEditable) {
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'j') {
        const prev = document.querySelector('a.nav-card.nav-prev');
        if (prev && prev.href) prev.click();
      } else if (e.key === 'ArrowRight' || e.key === 'k') {
        const next = document.querySelector('a.nav-card.nav-next');
        if (next && next.href) next.click();
      }
    });
  </script>
</body>
</html>`;

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

  // Fallbacks if files are not bundled in serverless environment
  if (filename === "home.html") return FALLBACK_HOME_HTML;
  if (filename === "blog-post.html") return FALLBACK_BLOG_POST_HTML;
  if (filename === "styles.css") return FALLBACK_STYLES_CSS;

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

  // 1. LibSQL / Turso setup
  const db: Client = createClient({
    url,
    authToken:
      url.startsWith("libsql://") || url.startsWith("https://") || url.startsWith("http://")
        ? authToken
        : undefined,
  });

  let initDbPromise: Promise<any> | null = null;
  function ensureDbInitialized(): Promise<any> {
    if (!initDbPromise) {
      initDbPromise = db.execute(`
        CREATE TABLE IF NOT EXISTS articles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          slug TEXT UNIQUE,
          title TEXT,
          markdown_content TEXT,
          html_content TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `).catch((err) => {
        console.error("[Database Init Error]:", err);
        initDbPromise = null;
        throw err;
      });
    }
    return initDbPromise;
  }

  // Trigger init on creation (catch so uncaught rejection does not crash boot)
  ensureDbInitialized().catch(() => {});

  async function handleRequest(req: Request): Promise<Response> {
    const reqUrl = new URL(req.url, "http://localhost");

    // Favicon handler (avoids 404 / 500 noise)
    if (req.method === "GET" && reqUrl.pathname === "/favicon.ico") {
      return new Response(null, { status: 204 });
    }

    // Static Asset Serving (styles.css fallback)
    if (
      req.method === "GET" &&
      (reqUrl.pathname === "/styles.css" || reqUrl.pathname === "/public/styles.css")
    ) {
      const cssContent = getTemplate("styles.css");
      return new Response(cssContent, {
        headers: { "Content-Type": "text/css; charset=utf-8" },
      });
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
                return `<li><a href="/articles/${a.slug}">${escapeHtml(a.title)}</a> &mdash; <small class="meta">${shortDate}</small> &mdash; <small><a href="/api/articles/${a.slug}" target="_blank">JSON</a></small></li>`;
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
  <p><small>If you are deploying to Vercel, ensure <code>TURSO_URL</code> and <code>TURSO_AUTH_TOKEN</code> are added to your Vercel Project Settings &rarr; Environment Variables.</small></p>
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
    ready: initDbPromise ?? Promise.resolve(),
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


