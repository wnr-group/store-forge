/**
 * npm run db:verify [-- --read-only] [-- --concurrency=20]
 *
 * Verifies row level security and the application role against the REAL
 * database named by your env: DATABASE_URL (storeforge_app via the Supabase
 * transaction pooler - the production path) and DIRECT_URL (postgres, used only
 * for catalog reads and throwaway fixtures). See scripts/lib/verify.ts.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { getDatabase } from "../lib/db";
import { runVerification, summarize } from "./lib/verify";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Variables may come from the real environment instead.
}

const args = process.argv.slice(2);
const readOnly = args.includes("--read-only");
const concurrency = Number(args.find((a) => a.startsWith("--concurrency="))?.split("=")[1] ?? 20);

function hostOf(url: string) {
  const u = new URL(url);
  return { host: u.hostname, port: u.port || "5432", user: decodeURIComponent(u.username) };
}

async function main() {
  const { DATABASE_URL, DIRECT_URL } = process.env;
  if (!DATABASE_URL || !DIRECT_URL) {
    console.error("db:verify needs both DATABASE_URL (storeforge_app, transaction pooler) and DIRECT_URL (postgres). See .env.example.");
    process.exit(2);
  }
  const app = hostOf(DATABASE_URL);
  const direct = hostOf(DIRECT_URL);

  console.log("StoreForge database verification");
  console.log(`  app    : ${app.user} @ ${app.host}:${app.port}`);
  console.log(`  admin  : ${direct.user} @ ${direct.host}:${direct.port}`);
  console.log(`  mode   : ${readOnly ? "read-only (catalog + connection checks only)" : `full (creates and removes throwaway users; ${concurrency} parallel requests)`}`);
  if (app.port !== "6543") {
    console.warn(`  WARNING: DATABASE_URL port is ${app.port}, not 6543 (transaction pooler). Pooling checks will not reflect production.`);
  }
  if (app.user === "postgres" || app.user.startsWith("postgres.")) {
    console.error("\nDATABASE_URL uses the postgres owner role. The app refuses to run with it; use storeforge_app.");
    process.exit(2);
  }
  console.log("");

  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(direct.host);
  const adminSql = postgres(DIRECT_URL, { max: 1, prepare: false, ssl: isLocal ? false : "require", connect_timeout: 15 });
  const journal = JSON.parse(readFileSync(join(process.cwd(), "drizzle", "meta", "_journal.json"), "utf8")) as { entries: unknown[] };

  let checks;
  try {
    checks = await runVerification({
      app: getDatabase(),
      admin: async <T,>(q: string) => (await adminSql.unsafe(q)) as unknown as T[],
      journalEntries: journal.entries.length,
      concurrency,
      readOnly,
    });
  } finally {
    await adminSql.end({ timeout: 5 });
    const cache = (globalThis as unknown as { __storeforgeDb?: { client?: { end: (o?: { timeout: number }) => Promise<void> } } }).__storeforgeDb;
    await cache?.client?.end({ timeout: 5 });
  }

  const icon = { pass: "PASS", fail: "FAIL", skip: "SKIP" } as const;
  for (const c of checks) {
    console.log(`  [${icon[c.status]}] ${c.title}`);
    if (c.detail && c.status !== "pass") console.log(`         ${c.detail}`);
    else if (c.detail) console.log(`         (${c.detail})`);
  }

  const { failed, skipped, passed, ok } = summarize(checks);
  console.log(`\n${passed} passed, ${failed.length} failed, ${skipped.length} skipped`);
  if (failed.length) {
    console.log("\nVERIFICATION FAILED - do not rely on row level security until the failures above are fixed.");
    process.exit(1);
  }
  if (!ok) {
    console.log("\nIncomplete: some checks were skipped, so this is NOT a full verification.");
    process.exit(3);
  }
  console.log(`\nALL CHECKS PASSED - RLS and role isolation verified against ${app.host}:${app.port} as ${app.user}.`);
}

main().catch((e) => {
  console.error("\ndb:verify could not complete:", e instanceof Error ? `${e.message}${e.cause ? ` (${(e.cause as Error).message})` : ""}` : e);
  process.exit(2);
});
