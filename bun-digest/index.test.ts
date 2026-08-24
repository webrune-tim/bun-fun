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
    const parsed = Bun.JSON5.parse(raw) as { runtime: string; version: number };
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
    expect(result.rows[0]?.is_connected).toBe(1);
    client.close();
  });
});

describe("BetterAuth & User Post Association", () => {
  it("rejects unauthenticated article publishing with 401", async () => {
    const postReq = new Request("http://localhost/api/articles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: "unauthorized-post",
        title: "Unauthorized Post",
        markdown: "Should not be created without login",
      }),
    });
    const postRes = await server.fetch(postReq);
    expect(postRes.status).toBe(401);
    const data = (await postRes.json()) as any;
    expect(data.error).toContain("Authentication required");
  });

  it("handles sign up, sign in, and ties published posts to authenticated user", async () => {
    const testEmail = `tester-${Date.now()}@example.com`;
    const testPassword = "Password123!*";
    const testName = "Test Author";

    // 1. Sign Up via BetterAuth API endpoint
    const signUpReq = new Request("http://localhost/api/auth/sign-up/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: testName,
        email: testEmail,
        password: testPassword,
      }),
    });
    const signUpRes = await server.fetch(signUpReq);
    expect(signUpRes.status).toBe(200);
    const signUpData = (await signUpRes.json()) as any;
    expect(signUpData.user).toBeDefined();
    expect(signUpData.user.email).toBe(testEmail);

    // Extract session cookie from sign-up response
    const setCookie = signUpRes.headers.get("set-cookie");
    expect(setCookie).toBeDefined();

    // 2. Publish an article with session cookie
    const postReq = new Request("http://localhost/api/articles", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: setCookie!,
      },
      body: JSON.stringify({
        slug: `user-tied-post-${Date.now()}`,
        title: "Post Tied To User",
        markdown: "## Authenticated Author\n\nThis article is tied to an author user.",
      }),
    });
    const postRes = await server.fetch(postReq);
    expect(postRes.status).toBe(201);
    const postData = (await postRes.json()) as any;
    expect(postData.success).toBe(true);
    expect(postData.author.name).toBe(testName);
    expect(postData.author.email).toBe(testEmail);

    // 3. Fetch article via API and verify author metadata
    const getReq = new Request(`http://localhost/api/articles/${postData.slug}`);
    const getRes = await server.fetch(getReq);
    expect(getRes.status).toBe(200);
    const articleData = (await getRes.json()) as any;
    expect(articleData.author_name).toBe(testName);
    expect(articleData.author_email).toBe(testEmail);
    expect(articleData.author_id).toBe(signUpData.user.id);

    // 4. Fetch HTML article view and verify author is rendered
    const viewReq = new Request(`http://localhost/articles/${postData.slug}`);
    const viewRes = await server.fetch(viewReq);
    expect(viewRes.status).toBe(200);
    const html = await viewRes.text();
    expect(html).toContain(testName);
    expect(html).toContain("Published by");
  });
});

describe("Vercel Bun Server Runtime", () => {
  it("handles cron maintenance route", async () => {
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
