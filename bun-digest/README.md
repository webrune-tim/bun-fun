# bun-digest

A high-performance blog engine built natively with **Bun 1.4**, featuring **Turso / LibSQL** cloud database support (with local/in-memory SQLite fallback), native Markdown compilation (`Bun.markdown`), native JSON5 config, Temporal date formatting, and built-in headless browser automation testing using **`Bun.WebView`**.

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

## Testing with `Bun.WebView`

This repository uses Bun 1.4's built-in headless browser automation API ([`Bun.WebView`](https://bun.sh/blog/bun-v1.4#bun-webview)) for end-to-end browser testing with zero external dependencies (no Puppeteer/Playwright needed).

### Run Tests

```bash
# Run all tests (unit and E2E)
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
