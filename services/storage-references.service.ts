import "server-only";
import { sql } from "drizzle-orm";
import type { DbTx } from "@/lib/db/tenant-db";
import { rowsOf } from "@/lib/db/user-context";
import { removeObjects, verifyObjects, type VerifiedObject } from "@/lib/storage/server";
import { withTenantDb } from "@/lib/tenant/context";

/**
 * Reference protection for uploaded files.
 *
 * A stored path can be referenced from the catalog columns (product images, collection image, store logo, the V1
 * template hero) AND from template documents: `templates.draft` and EVERY row of `template_versions.document`.
 * Migration 0013 copied the V1 hero path into both, so replacing the V1 hero must not delete a file that a
 * published (or older, rollback-able) version still shows. Versions are immutable, so those references never go away.
 *
 * Document references are matched structurally with jsonpath: any object, at any depth, whose `path` member equals
 * the file path exactly (the image value shape `{ path, alt?, focal? }`). It is not a substring search, so
 * `a/b.webp` never matches `a/b.webp.bak`, and a path inside prose text never matches. It deliberately over-protects
 * (any object with a matching `path` key counts): the cost of a wrong answer is an orphaned file, never a broken page.
 *
 * Concurrency: writers that start referencing a path call `lockStoragePaths` inside their transaction; the remover
 * takes the same transaction-level advisory locks, checks, and deletes while holding them. A writer that committed
 * first is therefore always seen by the remover; a remover holding the lock makes the writer wait and then re-verify.
 * A future publish service MUST call `lockStoragePaths` for the image paths it writes into a version.
 */

const lockKey = (path: string) => sql`hashtextextended(${"storage-path:" + path}, 0)`;

/** Takes a transaction-scoped lock per path, always in sorted order so two callers can never deadlock. */
export async function lockStoragePaths(tx: { execute: DbTx["execute"] }, paths: Array<string | null | undefined>): Promise<void> {
  const unique = [...new Set(paths.filter((p): p is string => !!p))].sort();
  for (const p of unique) await tx.execute(sql`select pg_advisory_xact_lock(${lockKey(p)})`);
}

/**
 * The writer half of the protocol: take the per-path locks FIRST, then confirm the objects exist, all inside the caller's
 * transaction. A remover that holds a path's lock has either finished deleting it (the check below then fails and nothing is
 * referenced) or has not started (it will wait for this transaction and then see the new reference). Call it before any write
 * that creates or keeps a reference, after any row locks the caller takes, and keep the transaction open until the reference commits.
 */
export async function verifyObjectsUnderLock(tx: DbTx, folder: string, paths: string[]): Promise<VerifiedObject[]> {
  await lockStoragePaths(tx, paths);
  return verifyObjects(folder, paths);
}

/** The subset of `paths` that something in this tenant still references. Tenant-filtered on every table, and RLS applies on top. */
export async function findReferencedPaths(tx: { execute: DbTx["execute"] }, tenantId: string, paths: string[]): Promise<Set<string>> {
  const unique = [...new Set(paths)];
  if (unique.length === 0) return new Set();
  const values = sql.join(unique.map((p) => sql`(${p}::text)`), sql`, `);
  const rows = rowsOf<{ path: string }>(
    await tx.execute(sql`
      select p.path from (values ${values}) as p(path)
      where exists (select 1 from public.product_images x where x.tenant_id = ${tenantId} and x.storage_path = p.path)
         or exists (select 1 from public.collections x where x.tenant_id = ${tenantId} and x.image_path = p.path)
         or exists (select 1 from public.stores x where x.tenant_id = ${tenantId} and x.logo_url = p.path)
         or exists (select 1 from public.store_template_settings x where x.tenant_id = ${tenantId} and x.hero_image_path = p.path)
         or exists (select 1 from public.templates x where x.tenant_id = ${tenantId}
                    and jsonb_path_exists(x.draft, '$.** ? (@.path == $p)', jsonb_build_object('p', p.path)))
         or exists (select 1 from public.template_versions x where x.tenant_id = ${tenantId}
                    and jsonb_path_exists(x.document, '$.** ? (@.path == $p)', jsonb_build_object('p', p.path)))
    `),
  );
  return new Set(rows.map((r) => r.path));
}

/**
 * The only way application code removes uploaded files after a save or discard. Removes just the paths that sit under
 * `tenantId` and that nothing references, checking and deleting under the path locks. Never throws for storage
 * failures (removeObjects logs them): a failure leaves an orphaned file, never a dangling reference.
 * Call it AFTER the transaction that unlinked the files has committed.
 */
export async function removeUnreferencedObjects(tenantId: string, paths: string[]): Promise<void> {
  const prefix = `${tenantId}/`;
  const candidates = [...new Set(paths)].filter((p) => p.startsWith(prefix) && !p.includes(".."));
  if (candidates.length === 0) return;
  await withTenantDb({ tenantId }, async (tx) => {
    await lockStoragePaths(tx, candidates);
    const referenced = await findReferencedPaths(tx, tenantId, candidates);
    await removeObjects(candidates.filter((p) => !referenced.has(p)));
  });
}
