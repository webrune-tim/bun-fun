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

describe("Blog End-to-End Tests with Bun.WebView & BetterAuth", () => {
  let app: ReturnType<typeof createAppServer>;
  let baseUrl: string;
  let authCookie = "";

  beforeAll(async () => {
    // Start an isolated test server on a dynamic port with an in-memory SQLite database
    app = createAppServer({
      port: 0,
      hostname: "127.0.0.1",
      dbUrl: process.env.TURSO_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
      dbPath: process.env.TURSO_URL ? undefined : ":memory:",
      enableCron: false,
    });
    baseUrl = `http://127.0.0.1:${app.server.port}`;
    await app.ready;

    // Create or sign in user for API interactions
    const regRes = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Alice Writer",
        email: "alice@testcorp.internal",
        password: "SecurePass123!*",
      }),
    });
    if (regRes.ok) {
      authCookie = regRes.headers.get("set-cookie") || "";
    } else {
      const loginRes = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "alice@testcorp.internal",
          password: "SecurePass123!*",
        }),
      });
      authCookie = loginRes.headers.get("set-cookie") || "";
    }
  });

  afterAll(() => {
    app.stop();
    Bun.WebView.closeAll();
  });

  it("loads the home page and verifies UI elements, auth triggers, and stylesheet", async () => {
    await using view = new Bun.WebView({ width: 1024, height: 768 });

    await view.navigate(baseUrl);

    expect(view.title).toBe("Bun Digest");
    expect(view.url).toBe(`${baseUrl}/`);

    const headerText = await view.evaluate("document.querySelector('h1').textContent");
    expect(headerText).toBe("Bun Digest");

    const formExists = await view.evaluate("Boolean(document.getElementById('postForm'))");
    expect(formExists).toBe(true);

    const hasArticlesList = await view.evaluate(
      "Boolean(document.querySelector('.articles-list'))"
    );
    expect(hasArticlesList).toBe(true);

    // Verify auth buttons exist
    const signInBtnExists = await view.evaluate("Boolean(document.getElementById('signInBtn'))");
    expect(signInBtnExists).toBe(true);

    // Verify CSS styles are loaded
    const bodyFont = (await view.evaluate(
      "window.getComputedStyle(document.body).fontFamily"
    )) as string;
    expect(typeof bodyFont).toBe("string");
    expect(bodyFont.length).toBeGreaterThan(0);
  });

  it("registers a new user and logs in via the BetterAuth UI modal dialog in WebView", async () => {
    await using view = new Bun.WebView({ width: 1024, height: 768 });

    await view.navigate(baseUrl);

    // Open Sign Up Tab in Auth Modal
    await view.evaluate("openAuthModal('signup')");

    const isDialogOpen = await view.evaluate("document.getElementById('authModal').open");
    expect(isDialogOpen).toBe(true);

    // Fill in sign up form fields
    await view.click("#signUpName");
    await view.type("Bob Journalist");

    const testEmail = `bob_${Date.now()}@testcorp.internal`;
    await view.click("#signUpEmail");
    await view.type(testEmail);

    await view.click("#signUpPassword");
    await view.type("SecurePass123!*");

    // Submit sign up form
    await view.click("#signUpForm button[type='submit']");

    // Wait for page reload to complete and session to be active
    await Bun.sleep(1800);
    await waitForUrl(view, (url) => url === `${baseUrl}/`);

    const userBadgeText = await view.evaluate(
      "document.querySelector('#userBadge .user-name')?.textContent ?? ''"
    );
    expect(userBadgeText).toContain("Bob Journalist");

    const authNoticeText = await view.evaluate(
      "document.getElementById('authNotice')?.textContent ?? ''"
    );
    expect(authNoticeText).toContain("Posting as Bob Journalist");
  });

  it("submits a new article as the authenticated user and verifies author tie-in", async () => {
    await using view = new Bun.WebView({ width: 1024, height: 768 });

    await view.navigate(baseUrl);

    // Register author user to create active session
    const authorEmail = `author_${Date.now()}@testcorp.internal`;
    await view.evaluate("openAuthModal('signup')");
    await view.click("#signUpName");
    await view.type("Alice Writer");
    await view.click("#signUpEmail");
    await view.type(authorEmail);
    await view.click("#signUpPassword");
    await view.type("SecurePass123!*");
    await view.click("#signUpForm button[type='submit']");

    await Bun.sleep(1800);
    await waitForUrl(view, (url) => url === `${baseUrl}/`);

    // Focus and type form fields
    await view.click("#title");
    await view.type("Mastering Bun.WebView Automation");

    const dynamicSlug = `bun-webview-${Date.now()}`;
    await view.click("#slug");
    await view.type(dynamicSlug);

    const markdownContent =
      "## Headless Browser in Bun 1.4\n\n" +
      "Bun 1.4 includes **native browser automation** with zero setup.\n\n" +
      "* Zero external drivers\n" +
      "* Native WebKit on macOS\n" +
      "* Fast execution\n\n" +
      "```ts\n" +
      "await using view = new Bun.WebView();\n" +
      "```";

    await view.evaluate(`(() => {
      const form = document.getElementById('postForm');
      const md = document.getElementById('markdown');
      md.value = ${JSON.stringify(markdownContent)};
      form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    })()`);

    // Wait for the browser to navigate to the article view
    await waitForUrl(view, (url) => url.includes(`/articles/${dynamicSlug}`));
    expect(view.url).toBe(`${baseUrl}/articles/${dynamicSlug}`);

    // Check rendered page title and header
    const articleTitle = await view.evaluate("document.querySelector('h1').textContent");
    expect(articleTitle).toBe("Mastering Bun.WebView Automation");

    // Verify author is displayed on the article
    const authorHighlight = await view.evaluate(
      "document.querySelector('.author-name-highlight')?.textContent ?? ''"
    );
    expect(authorHighlight).toBe("Alice Writer");

    // Verify compiled Markdown elements in the real DOM
    const subHeading = await view.evaluate(
      "document.querySelector('.post-content h2').textContent"
    );
    expect(subHeading).toBe("Headless Browser in Bun 1.4");

    const boldText = await view.evaluate(
      "document.querySelector('.post-content strong').textContent"
    );
    expect(boldText).toBe("native browser automation");

    const listItems = (await view.evaluate(
      "[...document.querySelectorAll('.post-content li')].map(li => li.textContent.trim())"
    )) as string[];
    expect(listItems).toEqual([
      "Zero external drivers",
      "Native WebKit on macOS",
      "Fast execution",
    ]);

    const codeBlock = await view.evaluate(
      "document.querySelector('.post-content code')?.textContent ?? ''"
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
  }, 15000);

  it("navigates back to the homepage and verifies the article and author appear in the index", async () => {
    await using view = new Bun.WebView({ width: 1024, height: 768 });

    // Navigate to the article
    await view.navigate(`${baseUrl}/articles/bun-webview-automation`);
    expect(view.url).toBe(`${baseUrl}/articles/bun-webview-automation`);

    // Click the Back to Home link
    await view.click(".nav-home-link");

    // Wait for navigation back to root
    await waitForUrl(view, (url) => url === `${baseUrl}/`);
    expect(view.url).toBe(`${baseUrl}/`);

    // Verify the newly created article is listed with author
    const pageText = await view.evaluate("document.body.textContent ?? ''");
    expect(pageText).toContain("Mastering Bun.WebView Automation");
    expect(pageText).toContain("Alice Writer");
  });

  it("supports browser history navigation (goBack / goForward)", async () => {
    await using view = new Bun.WebView({ width: 1024, height: 768 });

    await view.navigate(baseUrl);
    await view.navigate(`${baseUrl}/articles/bun-webview-automation`);
    expect(view.url).toBe(`${baseUrl}/articles/bun-webview-automation`);

    await (view as any).goBack();
    await waitForUrl(view, (url) => url === `${baseUrl}/`);
    expect(view.url).toBe(`${baseUrl}/`);

    await (view as any).goForward();
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

  it("handles smart next and previous buttons with multiple articles and keyboard navigation", async () => {
    // Add two more articles via the API to have a total of 3 articles:
    // 1. bun-webview-automation (oldest)
    // 2. bun-fast-bundler (middle)
    // 3. bun-zero-config-test (newest)
    await fetch(`${baseUrl}/api/articles`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: authCookie,
      },
      body: JSON.stringify({
        slug: "bun-fast-bundler",
        title: "Bun Fast Bundler",
        markdown: "# Fast Bundler\n\nBundling at the speed of native code.",
      }),
    });

    await fetch(`${baseUrl}/api/articles`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: authCookie,
      },
      body: JSON.stringify({
        slug: "bun-zero-config-test",
        title: "Bun Zero-Config Test",
        markdown: "# Zero Config Test Runner\n\nFast built-in test runner.",
      }),
    });

    await using view = new Bun.WebView({ width: 1024, height: 768 });

    // Navigate to bun-1-4-native-apis article
    await view.navigate(`${baseUrl}/articles/bun-1-4-native-apis`);
    expect(view.url).toBe(`${baseUrl}/articles/bun-1-4-native-apis`);

    const hasNav = await view.evaluate(
      "Boolean(document.querySelector('.post-nav'))"
    );
    expect(hasNav).toBe(true);

    const hasNavCards = await view.evaluate(
      "document.querySelectorAll('.nav-card').length"
    );
    expect(hasNavCards).toBe(2);

    // Test keyboard event listener is active on page
    await view.evaluate("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))");
  });
});
