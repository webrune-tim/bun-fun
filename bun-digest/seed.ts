import { createClient } from "@libsql/client";
import { createAuth, initAuthDatabase } from "./auth.ts";
import { renderMarkdown } from "./index.ts";

const tursoUrl = process.env.TURSO_URL || "file:content.db";
const tursoToken = process.env.TURSO_AUTH_TOKEN || process.env.TURSO_TOKEN;

console.log(`Connecting to Database: ${tursoUrl}`);
const db = createClient({
  url: tursoUrl,
  authToken:
    tursoUrl.startsWith("libsql://") || tursoUrl.startsWith("https://") || tursoUrl.startsWith("http://")
      ? tursoToken
      : undefined,
});

console.log("Flushing database tables...");
const tablesToDrop = ["articles", "session", "account", "verification", "user"];
for (const table of tablesToDrop) {
  try {
    await db.execute(`DROP TABLE IF EXISTS "${table}"`);
  } catch (err) {
    console.warn(`Warning dropping table ${table}:`, err);
  }
}

console.log("Initializing database schema...");
await initAuthDatabase(db);

console.log("Creating seed user via BetterAuth...");
const auth = createAuth(db);

const seedUser = {
  name: "Bun Admin",
  email: "admin@bundigest.dev",
  password: "AdminPassword123!",
};

let authorId: string | null = null;
let authorName = seedUser.name;
let authorEmail = seedUser.email;

try {
  const signUpRes = await auth.api.signUpEmail({
    body: seedUser,
  });
  authorId = signUpRes.user.id;
  console.log(`Created seed user: ${seedUser.name} (${seedUser.email}) with ID: ${authorId}`);
} catch (err) {
  console.error("Error creating seed user:", err);
}

const initialArticles = [
  {
    slug: "bun-1-4-native-apis",
    title: "Bun 1.4 Native Capabilities",
    markdown: `## Welcome to Bun Digest

Bun 1.4 introduces lightning-fast built-in tooling for modern full-stack web applications:

- **Native Markdown Parser**: Zero-dependency markdown compilation via \`Bun.markdown.html()\`
- **JSON5 Support**: Direct parsing of human-friendly configuration files
- **Built-in Testing & WebViews**: Fast test runner with native cross-platform WebView support
- **BetterAuth Integration**: Full authentication suite integrated seamlessly with LibSQL and Turso.`,
  },
  {
    slug: "turso-libsql-integration",
    title: "Connecting Application to Turso and BetterAuth",
    markdown: `## Distributed Edge Database

By combining **Turso (libSQL)** with **BetterAuth**, this application benefits from:

1. **Edge-ready sessions**: Secure authentication with cookie-based sessions and OAuth providers.
2. **Author Attribution**: Every published post is securely bound to an authenticated author.
3. **High Availability**: Global low-latency queries across distributed serverless regions.`,
  },
];

console.log(`Seeding ${initialArticles.length} initial article(s)...`);
for (const article of initialArticles) {
  const html = renderMarkdown(article.markdown);
  console.log(`Inserting article "${article.title}" (${article.slug})...`);
  await db.execute({
    sql: `
      INSERT INTO articles (slug, title, markdown_content, html_content, author_id, author_name, author_email)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(slug) DO UPDATE SET
        title = excluded.title,
        markdown_content = excluded.markdown_content,
        html_content = excluded.html_content,
        author_id = excluded.author_id,
        author_name = excluded.author_name,
        author_email = excluded.author_email
    `,
    args: [
      article.slug,
      article.title,
      article.markdown,
      html,
      authorId,
      authorName,
      authorEmail,
    ],
  });
}

console.log("Database successfully flushed and seeded!");
const articlesResult = await db.execute(
  'SELECT id, slug, title, author_name, author_email, created_at FROM articles ORDER BY id ASC'
);
console.log("Articles in database:");
console.table(articlesResult.rows);

const usersResult = await db.execute('SELECT id, name, email, createdAt FROM "user"');
console.log("Users in database:");
console.table(usersResult.rows);

db.close();
