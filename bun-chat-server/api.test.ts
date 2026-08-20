import { describe, expect, it, afterAll, beforeAll } from "bun:test";
import { createServer } from "./server";

describe("Bun Chat Server API & WebSocket Tests", () => {
  let server: ReturnType<typeof createServer>;
  let baseUrl: string;
  let wsUrl: string;

  beforeAll(() => {
    server = createServer(0); // Random available port
    baseUrl = `http://localhost:${server.port}`;
    wsUrl = `ws://localhost:${server.port}/ws`;
  });

  afterAll(() => {
    server.stop();
  });

  describe("HTTP Static File Serving", () => {
    it("serves index.html with 200 OK", async () => {
      const res = await fetch(`${baseUrl}/`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/html");
      const html = await res.text();
      expect(html).toContain("Bun Real-Time Chat");
    });

    it("serves styles.css with 200 OK", async () => {
      const res = await fetch(`${baseUrl}/styles.css`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/css");
      const css = await res.text();
      expect(css).toContain(".message");
    });

    it("returns 404 for nonexistent routes", async () => {
      const res = await fetch(`${baseUrl}/not-a-real-file.xyz`);
      expect(res.status).toBe(404);
    });
  });

  describe("WebSocket Real-Time Pub/Sub", () => {
    it("handles connection, init handshake, and system join events", async () => {
      const client1 = new WebSocket(wsUrl);

      const received1: any[] = [];
      client1.onmessage = (event) => {
        received1.push(JSON.parse(event.data as string));
      };

      await new Promise<void>((resolve) => {
        client1.onopen = () => resolve();
      });

      // Wait briefly for init + join messages
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(received1.length).toBeGreaterThanOrEqual(2);
      expect(received1[0].type).toBe("init");
      expect(received1[0].userId).toBeDefined();
      expect(received1[1].type).toBe("system");
      expect(received1[1].text).toContain("joined the chat");

      client1.close();
    });

    it("broadcasts chat messages to other connected clients", async () => {
      const client1 = new WebSocket(wsUrl);
      const client2 = new WebSocket(wsUrl);

      const client2Messages: any[] = [];
      client2.onmessage = (event) => {
        client2Messages.push(JSON.parse(event.data as string));
      };

      await Promise.all([
        new Promise<void>((r) => (client1.onopen = () => r())),
        new Promise<void>((r) => (client2.onopen = () => r())),
      ]);

      // Clear initial system join messages
      await new Promise((r) => setTimeout(r, 50));
      client2Messages.length = 0;

      // Client 1 sends a message
      client1.send("Hello from client 1!");

      await new Promise((r) => setTimeout(r, 50));

      const chatMsg = client2Messages.find((m) => m.type === "chat");
      expect(chatMsg).toBeDefined();
      expect(chatMsg.text).toBe("Hello from client 1!");
      expect(chatMsg.userId).toBeDefined();

      client1.close();
      client2.close();
    });
  });
});
