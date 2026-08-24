import { describe, expect, it, beforeAll } from "bun:test";

describe("Bun 1.4 Native Capabilities", () => {
  it("parses JSON5 files natively", async () => {
    const raw = `
      {
        // Trailing commas and single quotes
        runtime: 'Bun',
        version: 1.4,
      }
    `;
    const parsed = Bun.JSON5.parse(raw);
    expect(parsed.runtime).toBe("Bun");
    expect(parsed.version).toBe(1.4);
  });

  it("compiles Markdown to HTML with Bun.markdown", () => {
    const md = "# Hello Bun 1.4\n\n* High performance\n* Zero dependencies";
    const html = Bun.markdown.html(md);

    expect(html).toContain("<h1>Hello Bun 1.4</h1>");
    expect(html).toContain("<li>High performance</li>");
  });

  it("connects and queries via @libsql/client", async () => {
    const { createClient } = await import("@libsql/client");
    const url = process.env.TURSO_URL || ":memory:";
    const authToken = process.env.TURSO_AUTH_TOKEN || process.env.TURSO_TOKEN;

    const client = createClient({
      url,
      authToken: url.startsWith("libsql://") || url.startsWith("https://") ? authToken : undefined,
    });

    const result = await client.execute("SELECT 1 as is_connected;");
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].is_connected).toBe(1);
    client.close();
  });
});

