# bun-digest

A high-performance blog engine built natively with **Bun 1.4**, featuring **Turso / LibSQL** cloud database support (with local/in-memory SQLite fallback), native Markdown compilation (`Bun.markdown`), native JSON5 config, Temporal date formatting, built-in headless browser automation testing using **`Bun.WebView`**, and native support for **Vercel's Bun Runtime** ([Bun Vercel Deployment Guide](https://bun.sh/guides/deployment/vercel)).

## Getting Started

### Install Dependencies
```bash
bun install
```

### Environment Variables (Turso)
Create a `.env` file (see `.env.example`):
```env
TURSO_URL=libsql://bun-digest-tithos.aws-us-west-2.turso.io
TURSO_AUTH_TOKEN=your_token_here
```

### Run Server
```bash
# Production start
bun run start

# Development mode with hot reloading
bun run dev

# Seed Turso database from local content.db
bun run seed
```

The server listens on `http://localhost:5173`.

---

## Deploying to Vercel (Native Bun Runtime)

Following the official [Bun Vercel Deployment Guide](https://bun.sh/guides/deployment/vercel), `bun-digest` uses Vercel's **Bun Framework Preset**:

- `vercel.json` specifies `"bunVersion": "1.4.x"`.
- `server.ts` provides the single `Bun.serve()` server entrypoint that Vercel routes all requests to.
- `bun.lock` is included in the repository.

### 1. Set Up Environment Variables on Vercel
In the Vercel Dashboard (or via `vercel env add`), configure:
- `TURSO_URL`: `libsql://your-database.turso.io`
- `TURSO_AUTH_TOKEN`: your Turso auth token

### 2. Deploy via Vercel CLI or Git
```bash
# Using bunx (no global install needed)
bunx vercel login
bunx vercel deploy

# Deploy to production
bunx vercel --prod
```

Or connect the repository in the Vercel Web Dashboard:
- Vercel automatically detects the Bun Framework Preset via `vercel.json` and `server.ts`.

### 3. Architecture Highlights
- **Native Bun Runtime**: Runs `Bun.serve()` on Bun 1.4 inside Vercel.
- **Static Assets**: `public/styles.css` is served directly with Edge CDN caching.
- **Scheduled Maintenance**: Configured via `vercel.json` crons to invoke `/api/cron` daily (00:00 UTC).

---

## Testing with `Bun.WebView`

This repository uses Bun 1.4's built-in headless browser automation API ([`Bun.WebView`](https://bun.sh/blog/bun-v1.4#bun-webview)) for end-to-end browser testing with zero external dependencies (no Puppeteer/Playwright needed).

### Run Tests

```bash
# Run all tests (unit, Vercel Bun runtime, and E2E)
bun test

# Run only the Bun.WebView E2E test suite
bun run test:e2e
```

### What `Bun.WebView` Tests Cover

- **UI & DOM Structure**: Full page load, `<title>`, headers, and stylesheet loading.
- **Interactive Form Submission**: Real DOM input typing (`#title`, `#slug`, `#markdown`) and form button clicks.
- **Markdown & Date Rendering**: Validates compiled Markdown tags (`<h2>`, `<strong>`, `<ul>`, `<code>`) and Temporal date formatting (`<time datetime="...">`).
- **Navigation & Browser History**: Inter-page link clicking (`nav a`) and history navigation (`goBack()` / `goForward()`).
- **Visuals & Screenshots**: Mobile/desktop viewport resizing (`resize(375, 667)`) and screenshot capture (`screenshot({ format: 'png' })`).
- **Console Capture & Error Handling**: Capturing page-side `console.log` messages and verifying 404 response views.
