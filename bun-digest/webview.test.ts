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
      dbPath: ":memory:",
      enableCron: false,
    });
    baseUrl = `http://127.0.0.1:${app.server.port}`;
    await app.ready;

    // Create a registered user for API interactions
    const regRes = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Alice Writer",
        email: "alice@testcorp.internal",
        password: "SecurePass123!*",
      }),
    });
    authCookie = regRes.headers.get("set-cookie") || "";
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

    const emptyNotice = await view.evaluate(
      "document.querySelector('.articles-list').textContent.trim()"
    );
    expect(emptyNotice).toBe("No articles published yet.");

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

    await view.click("#signUpEmail");
    await view.type("bob@testcorp.internal");

    await view.click("#signUpPassword");
    await view.type("SecurePass123!*");

    // Submit sign up form
    await view.click("#signUpForm button[type='submit']");

    // Wait for page reload to complete and session to be active
    await Bun.sleep(1000);
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

    // Sign in first
    await view.evaluate("openAuthModal('signin')");
    await view.click("#signInEmail");
    await view.type("alice@testcorp.internal");
    await view.click("#signInPassword");
    await view.type("SecurePass123!*");
    await view.click("#signInForm button[type='submit']");

    await Bun.sleep(1000);
    await waitForUrl(view, (url) => url === `${baseUrl}/`);

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
    await view.click("#submitBtn");

    // Wait for the browser to navigate to the article view
    await waitForUrl(view, (url) => url.includes("/articles/bun-webview-automation"));
    expect(view.url).toBe(`${baseUrl}/articles/bun-webview-automation`);

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
  });

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
    const articleLinkText = await view.evaluate(
      "document.querySelector('.article-title-link')?.textContent?.trim() ?? ''"
    );
    expect(articleLinkText).toBe("Mastering Bun.WebView Automation");

    const authorTagText = await view.evaluate(
      "document.querySelector('.author-tag')?.textContent?.trim() ?? ''"
    );
    expect(authorTagText).toBe("Alice Writer");
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

    // Navigate to the newest article (bun-zero-config-test)
    await view.navigate(`${baseUrl}/articles/bun-zero-config-test`);
    expect(view.url).toBe(`${baseUrl}/articles/bun-zero-config-test`);

    // In the newest article, "Next" should be disabled and "Previous" should link to bun-fast-bundler
    const nextDisabled = await view.evaluate(
      "Boolean(document.querySelector('.nav-card.nav-next.disabled'))"
    );
    expect(nextDisabled).toBe(true);

    const prevTitle = await view.evaluate(
      "document.querySelector('a.nav-card.nav-prev .nav-card-title')?.textContent?.trim()"
    );
    expect(prevTitle).toBe("Bun Fast Bundler");

    const hasPrevLink = await view.evaluate(
      "Boolean(document.querySelector('link[rel=\"prev\"]'))"
    );
    expect(hasPrevLink).toBe(true);

    // Click previous post button to navigate to middle article
    await view.click("a.nav-card.nav-prev");
    await waitForUrl(view, (url) => url.includes("/articles/bun-fast-bundler"));
    expect(view.url).toBe(`${baseUrl}/articles/bun-fast-bundler`);

    // In middle article, both previous and next should be active links
    const middlePrevTitle = await view.evaluate(
      "document.querySelector('a.nav-card.nav-prev .nav-card-title')?.textContent?.trim()"
    );
    expect(middlePrevTitle).toBe("Mastering Bun.WebView Automation");

    const middleNextTitle = await view.evaluate(
      "document.querySelector('a.nav-card.nav-next .nav-card-title')?.textContent?.trim()"
    );
    expect(middleNextTitle).toBe("Bun Zero-Config Test");

    // Test keyboard navigation: press ArrowLeft to go to the oldest article
    await view.evaluate("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))");
    await waitForUrl(view, (url) => url.includes("/articles/bun-webview-automation"));
    expect(view.url).toBe(`${baseUrl}/articles/bun-webview-automation`);

    // In oldest article, Previous is disabled and Next links to middle article
    const prevIsDisabledOnOldest = await view.evaluate(
      "Boolean(document.querySelector('.nav-card.nav-prev.disabled'))"
    );
    expect(prevIsDisabledOnOldest).toBe(true);

    // Test keyboard navigation: press ArrowRight to go back to middle article
    await view.evaluate("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))");
    await waitForUrl(view, (url) => url.includes("/articles/bun-fast-bundler"));
    expect(view.url).toBe(`${baseUrl}/articles/bun-fast-bundler`);
  });
});
