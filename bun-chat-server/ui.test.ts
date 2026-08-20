import { describe, expect, it, afterAll, beforeAll } from "bun:test";
import { createServer } from "./server";

describe("Bun.WebView UI & Real-Time E2E Tests", () => {
  let server: ReturnType<typeof createServer>;
  let serverUrl: string;

  beforeAll(() => {
    server = createServer(0); // Random available port
    serverUrl = `http://localhost:${server.port}`;
  });

  afterAll(() => {
    server.stop();
  });

  it("loads the page, verifies title and core DOM elements in Bun.WebView", async () => {
    const webview = new Bun.WebView();
    await webview.navigate(serverUrl);

    // Verify page heading
    const heading = await webview.evaluate(`document.querySelector("h2").textContent`);
    expect(heading).toBe("Bun Real-Time Chat");

    // Verify input and button existence
    const hasInput = await webview.evaluate(`!!document.getElementById("msgInput")`);
    const hasButton = await webview.evaluate(`!!document.querySelector("button[type='submit']")`);
    expect(hasInput).toBe(true);
    expect(hasButton).toBe(true);

    webview.close();
  });

  it("renders live chat between two Bun.WebViews with distinct self and other classes", async () => {
    const wvUser1 = new Bun.WebView();
    const wvUser2 = new Bun.WebView();

    await wvUser1.navigate(serverUrl);
    await wvUser2.navigate(serverUrl);

    // Wait for WebSocket connections to establish
    await new Promise((resolve) => setTimeout(resolve, 150));

    // User 1 sends a message via UI form submission
    await wvUser1.evaluate(`(() => {
      const input = document.getElementById("msgInput");
      const form = document.getElementById("chatForm");
      input.value = "Hello from User 1 in WebView!";
      form.dispatchEvent(new Event("submit", { cancelable: true }));
    })()`);

    // Give WebSockets time to broadcast and render
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Inspect rendered messages in wvUser1
    const user1Messages: Array<{ class: string; text: string }> = await wvUser1.evaluate(`(() => {
      return Array.from(document.querySelectorAll(".message")).map(el => ({
        class: el.className,
        text: el.textContent
      }));
    })()`);

    // Inspect rendered messages in wvUser2
    const user2Messages: Array<{ class: string; text: string }> = await wvUser2.evaluate(`(() => {
      return Array.from(document.querySelectorAll(".message")).map(el => ({
        class: el.className,
        text: el.textContent
      }));
    })()`);

    // Verify User 1 sees their own message with 'self' class
    const user1SelfMsg = user1Messages.find((m) => m.class.includes("self"));
    expect(user1SelfMsg).toBeDefined();
    expect(user1SelfMsg?.text).toContain("You: Hello from User 1 in WebView!");

    // Verify User 2 sees the message with 'other' class
    const user2OtherMsg = user2Messages.find((m) => m.class.includes("other"));
    expect(user2OtherMsg).toBeDefined();
    expect(user2OtherMsg?.text).toContain("Hello from User 1 in WebView!");

    // Verify system join notifications were rendered
    const user1SystemMsg = user1Messages.find((m) => m.class.includes("system"));
    expect(user1SystemMsg).toBeDefined();
    expect(user1SystemMsg?.text).toContain("joined the chat");

    wvUser1.close();
    wvUser2.close();
  });
});
