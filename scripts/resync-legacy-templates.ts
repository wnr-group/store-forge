/**
 * npx tsx scripts/resync-legacy-templates.ts                                   (dry run: reads and decides, writes nothing)
 * npx tsx scripts/resync-legacy-templates.ts --apply --confirm-host <hostname>  (writes)
 * npx tsx scripts/resync-legacy-templates.ts --activate --confirm-host <host>   (verify every V1 store, then persist the cutover marker: opens the gate)
 * npx tsx scripts/resync-legacy-templates.ts --deactivate --confirm-host <host> (close the gate again)
 * npx tsx scripts/resync-legacy-templates.ts --status                          (print the persisted marker)
 * Release order: migrate, deploy (engine reads stay closed), --apply, --activate. --activate re-verifies and refuses to open the gate while any store would still change or fails.
 *
 * Phase 4 cutover step (architecture option B): brings the template engine up to date with V1 saves made after migration 0013.
 * See lib/templates/legacy-resync.ts for the exact contract. Uses the privileged DIRECT_URL like the other db scripts.
 * Run it BEFORE the storefront starts reading the engine, and only against a database you are authorized to change.
 * `--apply` is refused unless `--confirm-host` equals the database host, and never runs in a production environment.
 * Exit code: 0 when nothing failed (and, in a dry run, nothing is pending); 1 otherwise.
 */
import postgres from "postgres";
import { activateCutover, deactivateCutover, getCutoverState, resyncLegacyTemplates, type ResyncDb, type ResyncQuery } from "../lib/templates/legacy-resync";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Variables may come from the real environment instead.
}

async function main() {
  const url = process.env.DIRECT_URL;
  if (!url) {
    console.error("resync-legacy-templates needs DIRECT_URL (the privileged connection used for migrations).");
    process.exit(2);
  }
  const host = new URL(url).hostname;
  const apply = process.argv.includes("--apply");
  const activate = process.argv.includes("--activate");
  const deactivate = process.argv.includes("--deactivate");
  const writes = apply || activate || deactivate;
  const confirmed = process.argv[process.argv.indexOf("--confirm-host") + 1];
  if (writes) {
    if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
      console.error("Refusing to write: this looks like a production environment.");
      process.exit(2);
    }
    if (!process.argv.includes("--confirm-host") || confirmed !== host) {
      console.error(`This writes to ${host}. Re-run with:  --confirm-host ${host}`);
      process.exit(2);
    }
  }

  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(host);
  const sql = postgres(url, { max: 1, prepare: false, ssl: isLocal ? false : "require", connect_timeout: 15, onnotice: () => {} });
  const wrap = (run: (text: string, params: unknown[]) => Promise<unknown>): ResyncQuery =>
    (async (text: string, params: unknown[] = []) => [...((await run(text, params)) as unknown[])]) as ResyncQuery;
  const db: ResyncDb = {
    query: wrap((t, p) => sql.unsafe(t, p as never[])),
    transaction: (fn) => sql.begin((tx) => fn(wrap((t, p) => tx.unsafe(t, p as never[])))) as never,
  };
  try {
    console.log(`${writes ? "WRITE" : "DRY RUN"} against ${host}`);
    if (process.argv.includes("--status")) {
      console.log(JSON.stringify(await getCutoverState(db)));
      return;
    }
    if (deactivate) {
      await deactivateCutover(db);
      console.log("cutover gate CLOSED");
      return;
    }
    const r = await resyncLegacyTemplates(db, { dryRun: !apply });
    for (const o of r.outcomes) console.log(`${o.action.padEnd(24)} tenant=${o.tenantId} store=${o.storeId}${o.reason ? `  (${o.reason})` : ""}`);
    console.log(JSON.stringify({ dryRun: r.dryRun, counts: r.counts, pending: r.pending, failed: r.failed }));
    process.exitCode = r.failed > 0 || (!apply && !activate && r.pending > 0) ? 1 : 0;
    if (activate) {
      const a = await activateCutover(db);
      console.log(a.activated ? "cutover gate OPEN (every V1 store verified)" : `cutover gate stays CLOSED: ${a.result.pending} store(s) would still change, ${a.result.failed} failed`);
      process.exitCode = a.activated ? 0 : 1;
    }
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
