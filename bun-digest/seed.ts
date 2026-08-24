import { Database } from "bun:sqlite";
import { createClient } from "@libsql/client";

const tursoUrl = process.env.TURSO_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN || process.env.TURSO_TOKEN;

if (!tursoUrl) {
  console.error("Error: TURSO_URL environment variable is not set.");
  process.exit(1);
}

console.log(`Connecting to Turso: ${tursoUrl}`);
const tursoClient = createClient({
  url: tursoUrl,
  authToken: tursoUrl.startsWith("libsql://") || tursoUrl.startsWith("https://") ? tursoToken : undefined,
});

console.log("Reading from content.db...");
const localDb = new Database("content.db");

// Ensure articles table exists in Turso
await tursoClient.execute(`
  CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE,
    title TEXT,
    markdown_content TEXT,
    html_content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

interface ArticleRow {
  id: number;
  slug: string;
  title: string;
  markdown_content: string;
  html_content: string;
  created_at: string;
}

const articles = localDb.query("SELECT * FROM articles ORDER BY id ASC").all() as ArticleRow[];
console.log(`Found ${articles.length} article(s) in content.db`);

for (const article of articles) {
  console.log(`Seeding [id=${article.id}] "${article.title}" (${article.slug})...`);
  await tursoClient.execute({
    sql: `
      INSERT INTO articles (id, slug, title, markdown_content, html_content, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(slug) DO UPDATE SET
        title = excluded.title,
        markdown_content = excluded.markdown_content,
        html_content = excluded.html_content,
        created_at = excluded.created_at
    `,
    args: [
      article.id,
      article.slug,
      article.title,
      article.markdown_content,
      article.html_content,
      article.created_at,
    ],
  });
}

console.log("Seeding complete! Verifying Turso database contents...");
const verifyResult = await tursoClient.execute("SELECT id, slug, title, created_at FROM articles ORDER BY id ASC");
console.log("Articles in Turso database:");
console.table(verifyResult.rows);

tursoClient.close();
localDb.close();
