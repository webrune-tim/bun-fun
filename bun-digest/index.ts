import { Database } from "bun:sqlite";
import { formatArticleDate, parseUtcDate } from "./formatDate.ts";

// 1. Native JSON5 configuration parsing
const rawConfig = await Bun.file("config.json5").text();
const config = Bun.JSON5.parse(rawConfig);

// 2. Embedded SQLite setup
const db = new Database("content.db");
db.run(`
  CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE,
    title TEXT,
    markdown_content TEXT,
    html_content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

const insertArticle = db.prepare(`
  INSERT INTO articles (slug, title, markdown_content, html_content)
  VALUES ($slug, $title, $markdown_content, $html_content)
  ON CONFLICT(slug) DO UPDATE SET
    title=excluded.title,
    markdown_content=excluded.markdown_content,
    html_content=excluded.html_content
`);

const listArticles = db.prepare(`
  SELECT id, slug, title, created_at FROM articles ORDER BY id DESC LIMIT 20
`);

const getArticleBySlug = db.prepare(`
  SELECT * FROM articles WHERE slug = ?
`);

const deleteOldArticles = db.prepare(`
  DELETE FROM articles WHERE id NOT IN (
    SELECT id FROM articles ORDER BY id DESC LIMIT ?
  )
`);

// 3. Background Cron Scheduler
Bun.cron("0 * * * *", () => {
  const result = deleteOldArticles.run(config.maxRetainedPosts);
  console.log(`[CRON] Cleaned up old articles: ${result.changes} deleted`);
});

// 4. Native HTTP Server
const server = Bun.serve({
  port: config.server.port,
  hostname: config.server.hostname,

  async fetch(req) {
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
      const articles = listArticles.all() as Array<{
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
      const article = getArticleBySlug.get(slug) as
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

      const template = await Bun.file("templates/blog-post.html").text();
      const renderedHtml = template
        .replaceAll("{{TITLE}}", article.title)
        .replaceAll("{{ISO_DATE}}", isoDate)
        .replaceAll("{{FORMATTED_DATE}}", dateFormats.longDate)
        .replaceAll("{{RELATIVE_DATE}}", dateFormats.relativeTime)
        .replaceAll("{{HTML_CONTENT}}", article.html_content);

      return new Response(renderedHtml, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // JSON API: List articles (GET /api/articles)
    if (req.method === "GET" && url.pathname === "/api/articles") {
      const rows = listArticles.all();
      return Response.json(rows);
    }

    // JSON API: Retrieve single article raw (GET /api/articles/:slug)
    if (req.method === "GET" && url.pathname.startsWith("/api/articles/")) {
      const slug = url.pathname.replace("/api/articles/", "");
      const article = getArticleBySlug.get(slug);

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

        insertArticle.run({
          $slug: body.slug,
          $title: body.title,
          $markdown_content: body.markdown,
          $html_content: html,
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

console.log(`Server listening on http://${server.hostname}:${server.port}`);
