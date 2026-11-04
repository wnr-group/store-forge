import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getServerEnv } from "@/config/env";
import * as relations from "./relations";
import * as schema from "./schema";

export const dbSchema = { ...schema, ...relations };
export type Database = PostgresJsDatabase<typeof dbSchema>;

type Cache = { client?: ReturnType<typeof postgres>; db?: Database };
// Reused across hot reloads in dev and across invocations in a warm serverless
// instance, so we don't open a new pool per request.
const globalCache = globalThis as unknown as { __storeforgeDb?: Cache };

/**
 * INTERNAL: the raw pooled Drizzle client, connected as the `storeforge_app`
 * role through the Supabase transaction-mode pooler.
 *
 * Do not query this directly from services or pages. Outside a transaction it
 * carries no user identity, so row level security grants it nothing useful.
 * Use `withUserContext()` / `getAuthenticatedDatabase()` from ./tenant-db.
 */
export function getDatabase(): Database {
  const cache = (globalCache.__storeforgeDb ??= {});
  if (cache.db) return cache.db;

  const url = getServerEnv().DATABASE_URL;
  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(new URL(url).hostname);

  cache.client = postgres(url, {
    // Transaction-mode poolers (Supavisor :6543) don't support prepared statements.
    prepare: false,
    // Keep per-instance pools small: many serverless instances share the pooler.
    max: process.env.NODE_ENV === "production" ? 3 : 5,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: isLocal ? false : "require",
  });
  cache.db = drizzle(cache.client, { schema: dbSchema });
  return cache.db;
}
