import { createServer } from "./server";

// Start server if not already provided via PORT env
const port = Number(process.env.PORT || 5173);
let server: ReturnType<typeof createServer> | null = null;

try {
  server = createServer(port);
  console.log(`🚀 Chat server running at http://localhost:${server.port}`);
} catch {
  console.log(`ℹ️ Using existing server on port ${port}`);
}

const targetUrl = `http://localhost:${port}`;

console.log("🖥️  Opening 2 native Bun.WebView windows for real-time testing...");

const wv1 = new Bun.WebView();
const wv2 = new Bun.WebView();

await wv1.navigate(targetUrl);
await wv2.navigate(targetUrl);

console.log("✅ WebViews launched! Close the terminal or press Ctrl+C to exit.");

// Keep process alive until user exits
process.on("SIGINT", () => {
  console.log("\nClosing WebViews and shutting down...");
  wv1.close();
  wv2.close();
  if (server) server.stop();
  process.exit(0);
});
