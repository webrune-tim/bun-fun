import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";

interface TodoItem {
  id: number;
  title: string;
  completed: boolean;
}

let todos: TodoItem[] = [
  { id: 1, title: "Explore htmx 4 built-in morphing", completed: true },
  { id: 2, title: "Test hx-action and hx-method syntax", completed: false },
  { id: 3, title: "Experiment with View Transitions API", completed: false },
];

let serverTicks = 0;

function renderTodoList(items: TodoItem[]): string {
  return items
    .map(
      (todo) => `
    <li id="todo-${todo.id}" class="todo-item ${todo.completed ? "completed" : ""}">
      <label class="todo-label">
        <input
          type="checkbox"
          ${todo.completed ? "checked" : ""}
          hx-action="/api/todos/${todo.id}/toggle"
          hx-method="PATCH"
          hx-target="#todo-list"
          hx-swap="innerMorph"
        />
        <span>${escapeHtml(todo.title)}</span>
      </label>
      <button
        type="button"
        class="btn-danger"
        hx-delete="/api/todos/${todo.id}"
        hx-target="closest li"
        hx-swap="outerHTML swap:200ms"
      >
        Delete
      </button>
    </li>
  `
    )
    .join("");
}

function renderThemeSwitcher(activeTheme: "light" | "dark" | "system" = "system"): string {
  const themes: { id: "light" | "dark" | "system"; label: string; icon: string }[] = [
    { id: "light", label: "Light", icon: "☀️" },
    { id: "dark", label: "Dark", icon: "🌙" },
    { id: "system", label: "System", icon: "💻" },
  ];

  return `
    <fieldset id="theme-selector" class="theme-toggle-group" aria-label="Color theme">
      ${themes
        .map(
          (t) => `
        <button
          type="button"
          aria-pressed="${t.id === activeTheme}"
          class="theme-btn ${t.id === activeTheme ? "active" : ""}"
          data-theme-id="${t.id}"
          onclick="applyTheme('${t.id}')"
          hx-post="/api/theme?mode=${t.id}"
          hx-target="#theme-selector"
          hx-swap="outerHTML"
        >
          <span aria-hidden="true">${t.icon}</span>
          <span>${t.label}</span>
        </button>
      `
        )
        .join("")}
    </fieldset>
  `;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function parseBody(req: IncomingMessage): Promise<URLSearchParams> {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      resolve(new URLSearchParams(body));
    });
  });
}

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const pathname = url.pathname;
  const method = req.method?.toUpperCase() ?? "GET";

  // Static Assets
  if (pathname === "/" || pathname === "/index.html") {
    const filePath = join(__dirname, "public", "index.html");
    if (existsSync(filePath)) {
      const html = readFileSync(filePath, "utf-8");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }
  }

  if (pathname === "/styles.css") {
    const filePath = join(__dirname, "public", "styles.css");
    if (existsSync(filePath)) {
      const css = readFileSync(filePath, "utf-8");
      res.writeHead(200, { "Content-Type": "text/css; charset=utf-8" });
      res.end(css);
      return;
    }
  }

  // HTMX API Endpoints

  // 1. Basic Click Swap
  if (pathname === "/api/clicked" && method === "POST") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`
      <div class="alert success" role="status">
        <strong>Action Executed:</strong> Server responded with an HTML fragment at ${new Date().toLocaleTimeString()}!
      </div>
    `);
    return;
  }

  // 2. Active Search
  if (pathname === "/api/search" && (method === "GET" || method === "QUERY")) {
    const q = (url.searchParams.get("q") ?? "").toLowerCase().trim();
    const mockData = [
      { name: "Hypermedia Systems", category: "Book", year: 2023 },
      { name: "SvelteKit Architecture", category: "Framework", year: 2024 },
      { name: "OKLCH Color Spec", category: "CSS Standard", year: 2025 },
      { name: "WebGPU Compute Shaders", category: "Web API", year: 2025 },
      { name: "TypeScript 5.8 Engine", category: "Language", year: 2025 },
      { name: "htmx 4 Morph Engine", category: "Library", year: 2026 },
    ];

    const filtered = q
      ? mockData.filter((item) => item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q))
      : mockData;

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    if (filtered.length === 0) {
      res.end(`<p class="empty-state">No matching records found for "${escapeHtml(q)}".</p>`);
      return;
    }

    const rows = filtered
      .map(
        (item) => `
        <tr>
          <td><strong>${escapeHtml(item.name)}</strong></td>
          <td><span class="badge">${escapeHtml(item.category)}</span></td>
          <td>${item.year}</td>
        </tr>
      `
      )
      .join("");

    res.end(`
      <table class="data-table">
        <thead>
          <tr>
            <th>Resource</th>
            <th>Type</th>
            <th>Year</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `);
    return;
  }

  // 3. Polling Endpoint
  if (pathname === "/api/metrics" && method === "GET") {
    serverTicks++;
    const memoryUsageMb = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`
      <div class="metrics-grid">
        <div class="metric-card">
          <span class="metric-label">Server Heartbeat</span>
          <span class="metric-value">${serverTicks}</span>
        </div>
        <div class="metric-card">
          <span class="metric-label">Heap Memory</span>
          <span class="metric-value">${memoryUsageMb} MB</span>
        </div>
        <div class="metric-card">
          <span class="metric-label">Last Polled</span>
          <span class="metric-value">${new Date().toLocaleTimeString()}</span>
        </div>
      </div>
    `);
    return;
  }

  // 4. Todo List Operations
  if (pathname === "/api/todos" && method === "GET") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(renderTodoList(todos));
    return;
  }

  if (pathname === "/api/todos" && method === "POST") {
    const params = await parseBody(req);
    const title = (params.get("title") ?? "").trim();
    if (title.length > 0) {
      const newTodo: TodoItem = {
        id: Date.now(),
        title,
        completed: false,
      };
      todos.push(newTodo);
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(renderTodoList(todos));
    return;
  }

  if (pathname.startsWith("/api/todos/") && pathname.endsWith("/toggle") && method === "PATCH") {
    const id = parseInt(pathname.split("/")[3] ?? "", 10);
    const target = todos.find((t) => t.id === id);
    if (target) {
      target.completed = !target.completed;
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(renderTodoList(todos));
    return;
  }

  if (pathname.startsWith("/api/todos/") && method === "DELETE") {
    const id = parseInt(pathname.split("/")[3] ?? "", 10);
    todos = todos.filter((t) => t.id !== id);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    // Empty response deletes the targeted <li> element
    res.end("");
    return;
  }

  // 5. Error simulation (Demonstrating htmx 4 default 4xx/5xx swapping)
  if (pathname === "/api/trigger-error" && method === "POST") {
    res.writeHead(422, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`
      <div class="alert error" role="alert">
        <strong>HTTP 422 Unprocessable Content:</strong> In htmx 4.0, error responses are swapped into the target DOM by default!
      </div>
    `);
    return;
  }

  // 6. Theme Switching API
  if (pathname === "/api/theme" && (method === "GET" || method === "POST")) {
    const mode = (url.searchParams.get("mode") ?? "system") as "light" | "dark" | "system";
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Set-Cookie": `theme=${mode}; Path=/; SameSite=Lax; Max-Age=31536000`,
    });
    res.end(renderThemeSwitcher(mode));
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not Found");
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`HTMX 4 Playground server running at http://localhost:${PORT}`);
});
