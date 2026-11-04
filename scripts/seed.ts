/**
 * npm run db:seed -- --confirm-dev
 *
 * Loads scripts/seed.sql (demo users with a PUBLICLY KNOWN password) using the
 * privileged DIRECT_URL. Development projects only. Refuses to run without an
 * explicit flag so it can't be triggered by accident.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Variables may come from the real environment instead.
}

async function main() {
  const url = process.env.DIRECT_URL;
  if (!url) {
    console.error("db:seed needs DIRECT_URL (the privileged connection used for migrations).");
    process.exit(2);
  }
  const u = new URL(url);
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    console.error("Refusing to seed: this looks like a production environment.");
    process.exit(2);
  }
  if (!process.argv.includes("--confirm-dev")) {
    console.error(
      `This creates demo users with a publicly known password in ${u.hostname}.\n` +
        "Only run it against a throwaway DEVELOPMENT project. Re-run with:  npm run db:seed -- --confirm-dev",
    );
    process.exit(2);
  }

  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(u.hostname);
  const sql = postgres(url, { max: 1, prepare: false, ssl: isLocal ? false : "require", connect_timeout: 15, onnotice: () => {} });
  try {
    // Simple-query protocol: the file contains several statements and a DO block.
    await sql.unsafe(readFileSync(join(process.cwd(), "scripts", "seed.sql"), "utf8"));
    console.log(`Seeded development data into ${u.hostname}. Demo logins are listed at the top of scripts/seed.sql.`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error("db:seed failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
