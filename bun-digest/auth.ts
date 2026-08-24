import { betterAuth } from "better-auth";
import { Kysely } from "kysely";
import { LibsqlDialect } from "@libsql/kysely-libsql";
import { createClient, type Client } from "@libsql/client";

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
    await client.execute(sql);
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

      client = createClient({
        url,
        authToken:
          url.startsWith("libsql://") || url.startsWith("https://") || url.startsWith("http://")
            ? authToken
            : undefined,
      });
    }
  }

  baseURL = baseURL || process.env.BETTER_AUTH_URL || "http://localhost:5173";
  secret =
    secret ||
    process.env.BETTER_AUTH_SECRET ||
    "fallback_dev_secret_32_characters_long_min_1234";

  const kyselyDb = new Kysely<any>({
    dialect: new LibsqlDialect({
      client,
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
    emailAndPassword: {
      enabled: true,
    },
    socialProviders: Object.keys(socialProviders).length > 0 ? socialProviders : undefined,
  });
}

// Default auth instance
export const auth = createAuth();
export default auth;
