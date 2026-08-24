import { describe, expect, it } from "bun:test";
import { renderMarkdown, createRequestHandler } from "./index.ts";
import server from "./server.ts";

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
    const html = renderMarkdown(md);

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

describe("Vercel Bun Server Runtime", () => {
  it("handles requests via server.fetch (Vercel Bun framework preset)", async () => {
    // 1. Post an article
    const postReq = new Request("http://localhost/api/articles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: "vercel-bun-preset-test",
        title: "Deploying with Vercel Bun Preset",
        markdown: "## Bun Native Preset\n\nUses server.ts and bunVersion.",
      }),
    });
    const postRes = await server.fetch(postReq);
    expect(postRes.status).toBe(201);
    const postData = (await postRes.json()) as any;
    expect(postData.slug).toBe("vercel-bun-preset-test");

    // 2. Fetch the article view
    const viewReq = new Request("http://localhost/articles/vercel-bun-preset-test");
    const viewRes = await server.fetch(viewReq);
    expect(viewRes.status).toBe(200);
    const html = await viewRes.text();
    expect(html).toContain("Deploying with Vercel Bun Preset");
    expect(html).toContain("Uses server.ts and bunVersion.");

    // 3. Test Cron route
    const cronReq = new Request("http://localhost/api/cron");
    const cronRes = await server.fetch(cronReq);
    expect(cronRes.status).toBe(200);
    const cronData = (await cronRes.json()) as any;
    expect(cronData.success).toBe(true);
  });

  it("handles requests via default export in index.ts (Vercel Serverless module entrypoint)", async () => {
    const indexModule = await import("./index.ts");
    expect(indexModule.default).toBeDefined();
    expect(typeof indexModule.default).toBe("function");
    expect(typeof indexModule.default.fetch).toBe("function");

    // Call as function
    const req1 = new Request("http://localhost/");
    const res1 = await indexModule.default(req1);
    expect(res1.status).toBe(200);

    // Call via .fetch
    const req2 = new Request("http://localhost/api/cron");
    const res2 = await indexModule.default.fetch(req2);
    expect(res2.status).toBe(200);
  });
});

