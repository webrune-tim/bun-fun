import { createAppServer } from "./index.ts";

/**
 * Server entrypoint for Vercel Bun Framework Preset & standalone execution.
 * Vercel detects the Bun.serve() call during module load.
 */
const app = createAppServer({
  port: Number(process.env.PORT) || 5173,
  hostname: process.env.HOSTNAME || "0.0.0.0",
  enableCron: process.env.ENABLE_CRON === "true",
});

export default app.server;
