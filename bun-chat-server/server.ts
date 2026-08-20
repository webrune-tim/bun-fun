import { parseArgs } from "util";
import "./index.html" with { type: "text" };
import "./styles.css" with { type: "text" };

export interface WebSocketData {
  userId: string;
  username: string;
  createdAt: number;
  channel: string;
}

export function createServer(port: number = 5173) {
  const server = Bun.serve<WebSocketData>({
    port,
    async fetch(req, server) {
      const url = new URL(req.url);

      // WebSocket Upgrade
      if (url.pathname === "/ws") {
        const userId = Math.random().toString(36).substring(2, 7);
        const upgraded = server.upgrade(req, {
          data: {
            userId,
            username: `User-${userId}`,
            createdAt: Date.now(),
            channel: "general",
          },
        });

        return upgraded
          ? undefined
          : new Response("WebSocket upgrade failed", { status: 400 });
      }

      // Serve static assets (HTML, CSS, JS, etc.)
      const filePath = url.pathname === "/" ? "./index.html" : `.${url.pathname}`;
      const file = Bun.file(filePath);

      if (await file.exists()) {
        return new Response(file);
      }

      return new Response("Not Found", { status: 404 });
    },
    websocket: {
      open(ws) {
        ws.subscribe(ws.data.channel);

        // Send client identity info directly to this user
        ws.send(
          JSON.stringify({
            type: "init",
            userId: ws.data.userId,
            username: ws.data.username,
          })
        );

        // Broadcast join message to channel
        server.publish(
          ws.data.channel,
          JSON.stringify({
            type: "system",
            text: `${ws.data.username} joined the chat.`,
          })
        );
      },
      message(ws, message) {
        const text = typeof message === "string" ? message : new TextDecoder().decode(message);
        // Publish chat message to everyone in channel
        server.publish(
          ws.data.channel,
          JSON.stringify({
            type: "chat",
            userId: ws.data.userId,
            username: ws.data.username,
            text,
          })
        );
      },
      close(ws) {
        ws.unsubscribe(ws.data.channel);
        server.publish(
          ws.data.channel,
          JSON.stringify({
            type: "system",
            text: `${ws.data.username} left the chat.`,
          })
        );
      },
    },
  });

  return server;
}

if (import.meta.main) {
  const { values } = parseArgs({
    args: Bun.argv,
    options: {
      port: {
        type: "string",
        short: "p",
      },
    },
    strict: false,
    allowPositionals: true,
  });

  const port = Number(values.port || process.env.PORT || 5173);
  const server = createServer(port);
  console.log(`Server listening on http://localhost:${server.port}`);
}
