import "@better-auth/utils";
import "@better-auth/utils/password";
import "@better-auth/utils/random";
import "@better-auth/utils/base64";
import "@better-auth/utils/hash";
import "@better-auth/utils/hex";
import "@better-auth/utils/binary";
import "@better-auth/utils/hmac";
import "@better-auth/utils/otp";
import "@better-auth/telemetry";
import { betterAuth } from "better-auth";
import {
  Kysely,
  SqliteAdapter,
  SqliteIntrospector,
  SqliteQueryCompiler,
  type Dialect,
  type Driver,
  type DatabaseConnection,
  type CompiledQuery,
  type QueryResult,
} from "kysely";
import { createClient as createWebClient, type Client, type Transaction } from "@libsql/client/web";

export class LibsqlDialect implements Dialect {
  #config: { client: Client };
  constructor(config: { client: Client }) {
    this.#config = config;
  }
  createAdapter() {
    return new SqliteAdapter();
  }
  createDriver(): Driver {
    return new LibsqlDriver(this.#config.client);
  }
  createIntrospector(db: Kysely<any>) {
    return new SqliteIntrospector(db);
  }
  createQueryCompiler() {
    return new SqliteQueryCompiler();
  }
}

class LibsqlDriver implements Driver {
  client: Client;
  constructor(client: Client) {
    this.client = client;
  }
  async init() {}
  async acquireConnection(): Promise<DatabaseConnection> {
    return new LibsqlConnection(this.client);
  }
  async beginTransaction(connection: DatabaseConnection) {
    await (connection as LibsqlConnection).beginTransaction();
  }
  async commitTransaction(connection: DatabaseConnection) {
    await (connection as LibsqlConnection).commitTransaction();
  }
  async rollbackTransaction(connection: DatabaseConnection) {
    await (connection as LibsqlConnection).rollbackTransaction();
  }
  async releaseConnection(_conn: DatabaseConnection) {}
  async destroy() {}
}

class LibsqlConnection implements DatabaseConnection {
  client: Client;
  #transaction?: Transaction;
  constructor(client: Client) {
    this.client = client;
  }
  async executeQuery<R>(compiledQuery: CompiledQuery): Promise<QueryResult<R>> {
    const target = this.#transaction ?? this.client;
    const result = await target.execute({
      sql: compiledQuery.sql,
      args: compiledQuery.parameters as any[],
    });
    return {
      insertId:
        result.lastInsertRowid !== undefined
          ? BigInt(result.lastInsertRowid)
          : undefined,
      numAffectedRows: BigInt(result.rowsAffected),
      rows: result.rows as unknown as R[],
    };
  }
  async beginTransaction() {
    if (this.#transaction) {
      throw new Error("Transaction already in progress");
    }
    this.#transaction = await this.client.transaction();
  }
  async commitTransaction() {
    if (!this.#transaction) {
      throw new Error("No transaction to commit");
    }
    await this.#transaction.commit();
    this.#transaction = undefined;
  }
  async rollbackTransaction() {
    if (!this.#transaction) {
      throw new Error("No transaction to rollback");
    }
    await this.#transaction.rollback();
    this.#transaction = undefined;
  }
  async *streamQuery<R>(_compiledQuery: CompiledQuery, _chunkSize?: number): AsyncIterableIterator<QueryResult<R>> {
    throw new Error("Streaming not supported");
  }
}

const bunSqliteCache = new Map<string, any>();

function createBunSqliteClient(path: string): Client {
  const { Database } = require("bun:sqlite");
  const normalizedPath = path === ":memory:" ? ":memory:" : path.replace(/^file:/, "");
  let db = bunSqliteCache.get(normalizedPath);
  if (!db) {
    db = new Database(normalizedPath);
    bunSqliteCache.set(normalizedPath, db);
  }
  
  const client: any = {
    async execute(stmt: any) {
      const sql = typeof stmt === "string" ? stmt : stmt.sql;
      const rawArgs = typeof stmt === "string" ? [] : stmt.args || [];
      const args = Array.isArray(rawArgs) ? rawArgs : Object.values(rawArgs);
      
      const trimmed = sql.trim();
      const isSelect = /^(SELECT|PRAGMA|EXPLAIN)/i.test(trimmed);
      
      if (isSelect) {
        const query = db.query(sql);
        const rows = query.all(...args);
        return {
          rows,
          columns: rows.length ? Object.keys(rows[0] as object) : [],
          rowsAffected: 0,
          lastInsertRowid: undefined,
        };
      } else {
        const res = db.run(sql, args);
        return {
          rows: [],
          columns: [],
          rowsAffected: res.changes,
          lastInsertRowid: res.lastInsertRowid !== undefined ? BigInt(res.lastInsertRowid) : undefined,
        };
      }
    },
    async transaction() {
      return {
        async execute(stmt: any) {
          return client.execute(stmt);
        },
        async commit() {},
        async rollback() {},
      };
    },
    close() {
      db.close();
    },
  };
  return client as Client;
}

export function createDbClient(config: { url: string; authToken?: string }): Client {
  if (
    config.url.startsWith("libsql:") ||
    config.url.startsWith("https:") ||
    config.url.startsWith("http:") ||
    config.url.startsWith("wss:") ||
    config.url.startsWith("ws:") ||
    process.env.VERCEL
  ) {
    return createWebClient(config);
  }
  if (typeof Bun !== "undefined") {
    try {
      return createBunSqliteClient(config.url);
    } catch {
      return createWebClient(config);
    }
  }
  return createWebClient(config);
}

export interface CreateAuthOptions {
  baseURL?: string;
  secret?: string;
  client?: Client;
  dbUrl?: string;
  authToken?: string;
}

export const AUTH_DB_DDL = `
CREATE TABLE IF NOT EXISTS "user" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "emailVerified" INTEGER NOT NULL DEFAULT 0,
  "image" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "session" (
  "id" TEXT PRIMARY KEY,
  "expiresAt" DATETIME NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "account" (
  "id" TEXT PRIMARY KEY,
  "issuer" TEXT,
  "accountId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "idToken" TEXT,
  "accessTokenExpiresAt" DATETIME,
  "refreshTokenExpiresAt" DATETIME,
  "scope" TEXT,
  "password" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "verification" (
  "id" TEXT PRIMARY KEY,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expiresAt" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "articles" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "slug" TEXT UNIQUE NOT NULL,
  "title" TEXT NOT NULL,
  "markdown_content" TEXT NOT NULL,
  "html_content" TEXT NOT NULL,
  "author_id" TEXT REFERENCES "user"("id") ON DELETE SET NULL,
  "author_name" TEXT,
  "author_email" TEXT,
  "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

export async function initAuthDatabase(client: Client): Promise<void> {
  const statements = AUTH_DB_DDL.split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const sql of statements) {
    try {
      await client.execute(sql);
    } catch (err) {
      console.warn(`[DDL Statement Notice]:`, err);
    }
  }

  // Ensure author columns exist on articles table if table already existed from a previous schema version
  const columnsToAdd = [
    { name: "author_id", def: 'TEXT REFERENCES "user"("id") ON DELETE SET NULL' },
    { name: "author_name", def: "TEXT" },
    { name: "author_email", def: "TEXT" },
  ];

  for (const col of columnsToAdd) {
    try {
      await client.execute(`ALTER TABLE articles ADD COLUMN ${col.name} ${col.def}`);
    } catch {
      // Column already exists, safe to ignore
    }
  }
}

export function createAuth(clientOrOptions?: Client | CreateAuthOptions) {
  let client: Client;
  let baseURL: string | undefined;
  let secret: string | undefined;

  if (clientOrOptions && "execute" in clientOrOptions) {
    client = clientOrOptions;
  } else {
    const opts = clientOrOptions || {};
    baseURL = opts.baseURL;
    secret = opts.secret;
    if (opts.client) {
      client = opts.client;
    } else {
      const url =
        opts.dbUrl ||
        process.env.TURSO_URL ||
        (process.env.VERCEL ? "file:/tmp/content.db" : "file:content.db");
      const authToken =
        opts.authToken ||
        process.env.TURSO_AUTH_TOKEN ||
        process.env.TURSO_TOKEN;

      client = createDbClient({
        url,
        authToken:
          url.startsWith("libsql://") || url.startsWith("https://") || url.startsWith("http://")
            ? authToken
            : undefined,
      });
    }
  }

  const vercelProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL
    ? "https://bun-digest.vercel.app"
    : undefined;

  const vercelUrl = process.env.VERCEL_URL
    ? process.env.VERCEL_URL.startsWith("http")
      ? process.env.VERCEL_URL
      : `https://${process.env.VERCEL_URL}`
    : undefined;

  baseURL =
    baseURL ||
    process.env.BETTER_AUTH_URL ||
    vercelProductionUrl ||
    vercelUrl ||
    "http://localhost:5173";

  secret =
    secret ||
    process.env.BETTER_AUTH_SECRET ||
    "fallback_dev_secret_32_characters_long_min_1234";

  const kyselyDb = new Kysely<any>({
    dialect: new LibsqlDialect({
      client: client as any,
    }),
  });

  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  const socialProviders: Record<string, { clientId: string; clientSecret: string }> = {};
  if (
    googleClientId &&
    googleClientSecret &&
    !googleClientSecret.startsWith("your_")
  ) {
    socialProviders.google = {
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    };
  }

  return betterAuth({
    database: {
      db: kyselyDb,
      type: "sqlite",
    },
    baseURL,
    secret,
    trustedOrigins: [
      "https://*.vercel.app",
      "http://localhost:*",
      "http://127.0.0.1:*",
      ...(vercelUrl ? [vercelUrl] : []),
    ],
    emailAndPassword: {
      enabled: true,
    },
    socialProviders: Object.keys(socialProviders).length > 0 ? socialProviders : undefined,
  });
}

// Default auth instance
export const auth = createAuth();
export default auth;
