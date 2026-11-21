import { execFileSync } from "node:child_process";

/**
 * Independent database verification for the import E2E. Queries the dedicated local Supabase Postgres container
 * through `docker exec psql`, so no extra dependency is needed. Never point this at a shared or production database:
 * E2E_DB_CONTAINER must name a disposable container.
 */
export const DB_CONTAINER = process.env.E2E_DB_CONTAINER;
const DB_USER = process.env.E2E_DB_USER ?? "supabase_admin";

export const dbAvailable = () => Boolean(DB_CONTAINER);

/** Runs one read-only statement and returns rows as arrays of strings (`|`-separated, no headers). */
export function dbRows(sql: string): string[][] {
  if (!DB_CONTAINER) throw new Error("Set E2E_DB_CONTAINER to the disposable Postgres container to run database verification.");
  const out = execFileSync("docker", ["exec", DB_CONTAINER, "psql", "-U", DB_USER, "-d", "postgres", "-X", "-tA", "-F", "|", "-c", sql], { encoding: "utf8" });
  return out.split("\n").filter(Boolean).map((line) => line.split("|"));
}

export const dbScalar = (sql: string): string => dbRows(sql)[0]?.[0] ?? "";
