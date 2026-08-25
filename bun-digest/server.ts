import defaultHandler from "./index.ts";

/**
 * Server entrypoint for Vercel Bun Framework Preset & serverless execution.
 */
const server = Object.assign(
  (req: Request) => defaultHandler(req),
  {
    fetch: (req: Request) => defaultHandler(req),
  }
);

export default server;
