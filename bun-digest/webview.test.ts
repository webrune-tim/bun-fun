import { describe, expect, it, beforeAll, afterAll } from "bun:test";
import { createAppServer } from "./index.ts";

/**
 * Helper to wait for the WebView's URL to satisfy a condition
 */
async function waitForUrl(
  view: InstanceType<typeof Bun.WebView>,
  predicate: (url: string) => boolean,
  timeout = 5000
) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (predicate(view.url)) return;
    await Bun.sleep(25);
  }
  throw new Error(`Timeout waiting for URL condition. Current URL: ${view.url}`);
}

describe("Blog End-to-End Tests with Bun.WebView", () => {
  let app: ReturnType<typeof createAppServer>;
  let baseUrl: string;

  beforeAll(async () => {
    // Start an isolated test server on a dynamic port with an in-memory SQLite database
    app = createAppServer({
      port: 0,
      hostname: "127.0.0.1",
      dbPath: ":memory:",
      enableCron: false,
    });
    baseUrl = `http://127.0.0.1:${app.server.port}`;
  });

  afterAll(() => {
    app.stop();
    Bun.WebView.closeAll();
  });

  it("loads the home page and verifies UI elements and stylesheet", async () => {
    await using view = new Bun.WebView({ width: 1024, height: 768 });

    await view.navigate(baseUrl);

    expect(view.title).toBe("Bun 1.4 Native Server");
    expect(view.url).toBe(`${baseUrl}/`);

    const headerText = await view.evaluate("document.querySelector('h1').textContent");
    expect(headerText).toBe("Bun 1.4 Content Service");

    const formExists = await view.evaluate("Boolean(document.getElementById('postForm'))");
    expect(formExists).toBe(true);

    const emptyNotice = await view.evaluate(
      "document.querySelector('ul').textContent.trim()"
    );
    expect(emptyNotice).toBe("No articles published yet.");

    // Verify CSS styles are loaded
    const bodyFont = await view.evaluate(
      "window.getComputedStyle(document.body).fontFamily"
    );
    expect(typeof bodyFont).toBe("string");
    expect(bodyFont.length).toBeGreaterThan(0);
  });

  it("submits a new article via browser interaction and verifies rendered Markdown", async () => {
    await using view = new Bun.WebView({ width: 1024, height: 768 });

    await view.navigate(baseUrl);

    // Focus and type form fields
    await view.click("#title");
    await view.type("Mastering Bun.WebView Automation");

    await view.click("#slug");
    await view.type("bun-webview-automation");

    await view.click("#markdown");
    const markdownContent =
      "## Headless Browser in Bun 1.4\n\n" +
      "Bun 1.4 includes **native browser automation** with zero setup.\n\n" +
      "* Zero external drivers\n" +
      "* Native WebKit on macOS\n" +
      "* Fast execution\n\n" +
      "```ts\n" +
      "await using view = new Bun.WebView();\n" +
      "```";
    await view.type(markdownContent);

    // Click submit button to trigger form submission and client-side redirect
    await view.click("button[type='submit']");

    // Wait for the browser to navigate to the article view
    await waitForUrl(view, (url) => url.includes("/articles/bun-webview-automation"));
    expect(view.url).toBe(`${baseUrl}/articles/bun-webview-automation`);

    // Check rendered page title and header
    const articleTitle = await view.evaluate("document.querySelector('h1').textContent");
    expect(articleTitle).toBe("Mastering Bun.WebView Automation");

    // Verify compiled Markdown elements in the real DOM
    const subHeading = await view.evaluate(
      "document.querySelector('.content h2').textContent"
    );
    expect(subHeading).toBe("Headless Browser in Bun 1.4");

    const boldText = await view.evaluate(
      "document.querySelector('.content strong').textContent"
    );
    expect(boldText).toBe("native browser automation");

    const listItems = (await view.evaluate(
      "[...document.querySelectorAll('.content li')].map(li => li.textContent.trim())"
    )) as string[];
    expect(listItems).toEqual([
      "Zero external drivers",
      "Native WebKit on macOS",
      "Fast execution",
    ]);

    const codeBlock = await view.evaluate(
      "document.querySelector('.content code')?.textContent ?? ''"
    );
    expect(codeBlock).toContain("Bun.WebView");

    // Verify Temporal date formatting in DOM
    const hasIsoDate = await view.evaluate(
      "Boolean(document.querySelector('time[datetime]'))"
    );
    expect(hasIsoDate).toBe(true);

    const relativeDateText = await view.evaluate(
      "document.querySelector('.relative-date')?.textContent ?? ''"
    );
    expect(relativeDateText).toMatch(/this minute|ago/);
  });

  it("navigates back to the homepage and verifies the article appears in the index", async () => {
    await using view = new Bun.WebView({ width: 1024, height: 768 });

    // Navigate to the article
    await view.navigate(`${baseUrl}/articles/bun-webview-automation`);
    expect(view.url).toBe(`${baseUrl}/articles/bun-webview-automation`);

    // Click the Back to Home link
    await view.click("nav a");

    // Wait for navigation back to root
    await waitForUrl(view, (url) => url === `${baseUrl}/`);
    expect(view.url).toBe(`${baseUrl}/`);

    // Verify the newly created article is listed
    const articleLinks = (await view.evaluate(
      "[...document.querySelectorAll('ul li a')].map(a => ({ href: a.getAttribute('href'), text: a.textContent }))"
    )) as Array<{ href: string; text: string }>;

    const matching = articleLinks.find(
      (l) => l.href === "/articles/bun-webview-automation"
    );
    expect(matching).toBeDefined();
    expect(matching?.text).toBe("Mastering Bun.WebView Automation");
  });

  it("supports browser history navigation (goBack / goForward)", async () => {
    await using view = new Bun.WebView({ width: 1024, height: 768 });

    await view.navigate(baseUrl);
    await view.navigate(`${baseUrl}/articles/bun-webview-automation`);
    expect(view.url).toBe(`${baseUrl}/articles/bun-webview-automation`);

    await view.goBack();
    await waitForUrl(view, (url) => url === `${baseUrl}/`);
    expect(view.url).toBe(`${baseUrl}/`);

    await view.goForward();
    await waitForUrl(view, (url) => url === `${baseUrl}/articles/bun-webview-automation`);
    expect(view.url).toBe(`${baseUrl}/articles/bun-webview-automation`);
  });

  it("captures screenshots and supports viewport resizing", async () => {
    await using view = new Bun.WebView({ width: 800, height: 600 });
    await view.navigate(baseUrl);

    // Resize viewport to mobile dimensions
    await view.resize(375, 667);

    // Capture screenshot as Blob
    const blob = (await view.screenshot({ format: "png" })) as Blob;
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
    expect(blob.type).toBe("image/png");

    // Capture screenshot as Buffer and verify PNG magic numbers
    const buf = (await view.screenshot({
      format: "png",
      encoding: "buffer",
    })) as Buffer;
    expect(buf[0]).toBe(0x89);
    expect(buf[1]).toBe(0x50); // 'P'
    expect(buf[2]).toBe(0x4e); // 'N'
    expect(buf[3]).toBe(0x47); // 'G'
  });

  it("handles 404 not found pages cleanly", async () => {
    await using view = new Bun.WebView({ width: 800, height: 600 });
    await view.navigate(`${baseUrl}/articles/non-existent-article-slug`);

    const bodyText = await view.evaluate("document.body.innerText");
    expect(bodyText).toContain("Article not found");
  });

  it("captures page console logs", async () => {
    const logs: Array<{ type: string; args: any[] }> = [];

    await using view = new Bun.WebView({
      console: (type, ...args) => {
        logs.push({ type, args });
      },
    });

    await view.navigate(baseUrl);
    await view.evaluate("console.log('Hello from test page', 123)");

    expect(logs.length).toBeGreaterThanOrEqual(1);
    const captured = logs.find((l) => l.args.includes("Hello from test page"));
    expect(captured).toBeDefined();
    expect(captured?.type).toBe("log");
  });
});
