import { applyLegacyToPreset, type LegacyTemplateSettings } from "./presets";
import { validateDocument } from "./engine/validate";
import { getRegistry } from "./registry/index";

/**
 * Cutover re-sync of the frozen V1 table into the template engine (architecture decision: option B, D17/D18, risk X2).
 *
 * WHEN: once, by an operator, at the Phase 4 cutover, BEFORE the storefront starts reading the engine. Migration 0013 is a
 * one-time snapshot; V1 saves made between 0013 and the cutover are not in the engine. This brings the engine up to date.
 * It is NOT a dual-write, never runs at request time, and never blocks V1 saves (it takes the same store-row lock they do,
 * briefly, one store at a time).
 *
 * SOURCE  public.store_template_settings (one row per store), joined to public.stores on BOTH id and tenant_id.
 * TARGET  the store's default `index` template (is_default) and its versions.
 * TENANT  the tenant is taken from the V1 row and must equal stores.tenant_id; every write names that tenant and store.
 *
 * PER STORE, in one transaction (a failure rolls back only that store; the run continues):
 *   1. lock the store row (same lock as the V1 writers and the quota code), then re-read the V1 row;
 *   2. lock the default index template row, if any;
 *   3. desired document = applyLegacyToPreset(V1 row), validated by the shared engine validator; invalid -> `failed`;
 *   4. no default template            -> create it and publish version 1 (source `migration`)         = `created`
 *      template is migration-owned    -> see below
 *      anything else                  -> leave it alone                                                = `skipped_engine_modified`
 *
 * MIGRATION-OWNED (the only state the re-sync may overwrite) = active AND published AND draft equals the published document
 * AND every version has source `migration` AND the name is still the preset name. Any engine-side publish, rollback, unpublished
 * draft edit, archive or rename means a person changed it in the engine: ENGINE WINS, nothing is written, and the store is
 * reported so someone can decide. (A rename back to exactly "Classic"/"Spotlight" is not detectable and is treated as owned.)
 *
 * IF OWNED and the desired document differs from the published one: insert a NEW version (source `migration`, label
 * `legacy re-sync`), then move the pointer and set draft to the same document. Old versions are never touched (immutable), so
 * history and rollback are preserved                                                                   = `resynced`
 * IF OWNED and equal: nothing is written                                                              = `unchanged`
 *
 * IDEMPOTENT: a second run finds every owned store equal to V1 and writes nothing. RETRY: rerun after fixing the cause; completed
 * stores report `unchanged`. `dryRun` performs every read and decision under the same locks and writes nothing.
 *
 * GATE: the engine must not be activated for reads until `assertResyncComplete` passes (no store would still change, no failures).
 * Conflicts (`skipped_engine_modified`) do not block: the engine is the newer source for those stores by design.
 */

// NOTE: JSON parameters are bound as `$n::text::jsonb`. With postgres-js a string bound straight to `$n::jsonb` is serialized as a JSON *string*
// (not an object) and the documents' CHECK constraints reject it; PGlite parses the text, so only a real PostgreSQL driver shows the difference.
export type ResyncQuery = <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>;
export interface ResyncDb {
  query: ResyncQuery;
  transaction<T>(fn: (q: ResyncQuery) => Promise<T>): Promise<T>;
}

export type ResyncAction = "created" | "resynced" | "unchanged" | "skipped_engine_modified" | "failed";
export type StoreOutcome = { tenantId: string; storeId: string; action: ResyncAction; reason?: string; versionNumber?: number };
export type ResyncResult = {
  dryRun: boolean;
  outcomes: StoreOutcome[];
  counts: Record<ResyncAction, number>;
  /** Stores the run changed (or, in a dry run, would change). */
  pending: number;
  failed: number;
  ok: boolean;
};

type V1Row = {
  tenant_id: string;
  store_id: string;
  template_key: string;
  accent_color: string | null;
  hero_heading: string | null;
  hero_subheading: string | null;
  hero_image_path: string | null;
};

type TemplateState = {
  id: string;
  name: string;
  status: string;
  revision: number;
  published_version_id: string | null;
  published_matches_desired: boolean | null;
  draft_is_published: boolean | null;
  foreign_versions: number;
};

const RESYNC_LABEL = "legacy re-sync";

const toLegacy = (r: V1Row): LegacyTemplateSettings => ({
  templateKey: r.template_key,
  accentColor: r.accent_color,
  heroHeading: r.hero_heading,
  heroSubheading: r.hero_subheading,
  heroImagePath: r.hero_image_path,
});

export async function syncStore(q: ResyncQuery, v1: V1Row, dryRun: boolean): Promise<StoreOutcome> {
  const base = { tenantId: v1.tenant_id, storeId: v1.store_id };

  // 1. Same lock as the V1 writers: no V1 save can change the row between our read and our write.
  const locked = await q("select id from public.stores where id = $1 and tenant_id = $2 for update", [v1.store_id, v1.tenant_id]);
  if (locked.length === 0) return { ...base, action: "failed", reason: "store not found for this tenant" };
  const [row] = await q<V1Row>(
    "select tenant_id, store_id, template_key, accent_color, hero_heading, hero_subheading, hero_image_path from public.store_template_settings where store_id = $1 and tenant_id = $2",
    [v1.store_id, v1.tenant_id],
  );
  if (!row) return { ...base, action: "unchanged", reason: "legacy row no longer exists" };

  const { name, document } = applyLegacyToPreset(toLegacy(row));
  const check = validateDocument("index", document, getRegistry(), { tenantId: row.tenant_id });
  if (!check.ok) return { ...base, action: "failed", reason: "legacy settings produce an invalid document" };
  const docJson = JSON.stringify(document);

  // 2. The default index template, locked.
  const [tpl] = await q<TemplateState>(
    `select t.id, t.name, t.status, t.revision, t.published_version_id,
            (pv.document = $3::text::jsonb) as published_matches_desired,
            (t.draft = pv.document) as draft_is_published,
            (select count(*)::int from public.template_versions v where v.template_id = t.id and v.source <> 'migration') as foreign_versions
       from public.templates t
       left join public.template_versions pv on pv.id = t.published_version_id and pv.template_id = t.id
      where t.tenant_id = $1 and t.store_id = $2 and t.kind = 'index' and t.is_default
      for update of t`,
    [row.tenant_id, row.store_id, docJson],
  );

  if (!tpl) {
    if (dryRun) return { ...base, action: "created" };
    const [t] = await q<{ id: string }>(
      "insert into public.templates (tenant_id, store_id, kind, name, is_default, draft) values ($1,$2,'index',$3,true,$4::text::jsonb) returning id",
      [row.tenant_id, row.store_id, name, docJson],
    );
    const [v] = await q<{ id: string; version_number: number }>(
      "insert into public.template_versions (tenant_id, store_id, template_id, document, source, label) values ($1,$2,$3,$4::text::jsonb,'migration',$5) returning id, version_number",
      [row.tenant_id, row.store_id, t.id, docJson, RESYNC_LABEL],
    );
    await q("update public.templates set published_version_id = $1 where id = $2", [v.id, t.id]);
    return { ...base, action: "created", versionNumber: v.version_number };
  }

  const owned =
    tpl.status === "active" &&
    tpl.published_version_id !== null &&
    tpl.draft_is_published === true &&
    tpl.foreign_versions === 0 &&
    (tpl.name === "Classic" || tpl.name === "Spotlight");
  if (!owned) return { ...base, action: "skipped_engine_modified", reason: "the default template was changed in the engine; engine wins" };
  if (tpl.published_matches_desired === true && tpl.name === name) return { ...base, action: "unchanged" };
  if (dryRun) return { ...base, action: "resynced" };

  // New version first (the pointer FK needs it), then pointer + draft + name together, guarded by the revision we read.
  const [v] = await q<{ id: string; version_number: number }>(
    "insert into public.template_versions (tenant_id, store_id, template_id, document, source, label) values ($1,$2,$3,$4::text::jsonb,'migration',$5) returning id, version_number",
    [row.tenant_id, row.store_id, tpl.id, docJson, RESYNC_LABEL],
  );
  const updated = await q(
    "update public.templates set draft = $1::text::jsonb, name = $2, published_version_id = $3 where id = $4 and revision = $5 returning id",
    [docJson, name, v.id, tpl.id, tpl.revision],
  );
  if (updated.length !== 1) throw new Error("the template changed during the re-sync");
  return { ...base, action: "resynced", versionNumber: v.version_number };
}

export async function resyncLegacyTemplates(db: ResyncDb, opts: { dryRun?: boolean; storeIds?: string[] } = {}): Promise<ResyncResult> {
  const dryRun = opts.dryRun ?? false;
  const rows = await db.query<{ tenant_id: string; store_id: string }>(
    `select ts.tenant_id, ts.store_id from public.store_template_settings ts
       join public.stores s on s.id = ts.store_id and s.tenant_id = ts.tenant_id
      order by ts.store_id`,
  );
  const wanted = opts.storeIds ? new Set(opts.storeIds) : null;
  const outcomes: StoreOutcome[] = [];
  for (const r of rows) {
    if (wanted && !wanted.has(r.store_id)) continue;
    try {
      outcomes.push(await db.transaction((q) => syncStore(q, r as V1Row, dryRun)));
    } catch (e) {
      outcomes.push({ tenantId: r.tenant_id, storeId: r.store_id, action: "failed", reason: e instanceof Error ? e.message : String(e) });
    }
  }
  const counts: Record<ResyncAction, number> = { created: 0, resynced: 0, unchanged: 0, skipped_engine_modified: 0, failed: 0 };
  for (const o of outcomes) counts[o.action]++;
  const pending = counts.created + counts.resynced;
  return { dryRun, outcomes, counts, pending, failed: counts.failed, ok: counts.failed === 0 };
}

/** Throws unless the engine is safe to activate: a dry run finds nothing left to change and nothing failing. */
export async function assertResyncComplete(db: ResyncDb): Promise<ResyncResult> {
  const r = await resyncLegacyTemplates(db, { dryRun: true });
  if (r.failed > 0 || r.pending > 0) {
    throw new Error(`Legacy re-sync is not complete: ${r.pending} store(s) still differ from V1, ${r.failed} failed. Run the re-sync and retry.`);
  }
  return r;
}

export type CutoverState = { status: "pending" | "complete" | "missing"; completedAt: string | null; verifiedStores: number | null; resyncCounts: unknown };

/** The persisted marker as the privileged connection sees it (the app itself only ever calls public.template_engine_cutover_complete()). */
export async function getCutoverState(db: ResyncDb): Promise<CutoverState> {
  const [r] = await db.query<{ status: string; completed_at: string | null; verified_stores: number | null; resync_counts: unknown }>(
    "select status, completed_at, verified_stores, resync_counts from public.template_engine_cutover where id",
  );
  if (!r) return { status: "missing", completedAt: null, verifiedStores: null, resyncCounts: null };
  return { status: r.status === "complete" ? "complete" : "pending", completedAt: r.completed_at ? String(r.completed_at) : null, verifiedStores: r.verified_stores, resyncCounts: r.resync_counts };
}

/**
 * Opens the cutover gate, or leaves/forces it closed. ONE transaction: lock every V1 store row (fixed order, so no V1 save can land between
 * the check and the marker), verify every V1 store exactly as a dry-run re-sync would, and persist the result.
 *   - any store that would still change, or that fails  -> marker is written/kept PENDING, nothing is activated (partial sync cannot activate);
 *   - everything clean (engine-modified stores count as clean: engine wins) -> marker COMPLETE.
 * Safe to repeat: a second activation re-verifies and keeps the original completion time. Any error rolls the transaction back and the marker is unchanged
 * (the reader treats an absent or non-complete marker as closed).
 */
export async function activateCutover(db: ResyncDb): Promise<{ activated: boolean; result: ResyncResult }> {
  return db.transaction(async (q) => {
    const rows = await q<{ tenant_id: string; store_id: string }>(
      `select ts.tenant_id, ts.store_id from public.store_template_settings ts
         join public.stores s on s.id = ts.store_id and s.tenant_id = ts.tenant_id
        order by ts.store_id`,
    );
    for (const r of rows) await q("select id from public.stores where id = $1 and tenant_id = $2 for update", [r.store_id, r.tenant_id]);
    const outcomes: StoreOutcome[] = [];
    for (const r of rows) outcomes.push(await syncStore(q, r as V1Row, true));
    const counts: Record<ResyncAction, number> = { created: 0, resynced: 0, unchanged: 0, skipped_engine_modified: 0, failed: 0 };
    for (const o of outcomes) counts[o.action]++;
    const pending = counts.created + counts.resynced;
    const result: ResyncResult = { dryRun: true, outcomes, counts, pending, failed: counts.failed, ok: counts.failed === 0 };
    if (pending > 0 || counts.failed > 0) {
      await q(
        "insert into public.template_engine_cutover (id, status, resync_counts) values (true, 'pending', $1::text::jsonb) on conflict (id) do update set status = 'pending', completed_at = null, verified_stores = null, resync_counts = excluded.resync_counts, updated_at = now()",
        [JSON.stringify(counts)],
      );
      return { activated: false, result };
    }
    await q(
      `insert into public.template_engine_cutover (id, status, completed_at, verified_stores, resync_counts) values (true, 'complete', now(), $1, $2::text::jsonb)
       on conflict (id) do update set status = 'complete',
         completed_at = coalesce(case when public.template_engine_cutover.status = 'complete' then public.template_engine_cutover.completed_at end, now()),
         verified_stores = excluded.verified_stores, resync_counts = excluded.resync_counts, updated_at = now()`,
      [rows.length, JSON.stringify(counts)],
    );
    return { activated: true, result };
  });
}

/** Closes the gate again (rollback of the cutover). Idempotent. */
export async function deactivateCutover(db: ResyncDb): Promise<void> {
  await db.query(
    "insert into public.template_engine_cutover (id, status) values (true, 'pending') on conflict (id) do update set status = 'pending', completed_at = null, verified_stores = null, updated_at = now()",
  );
}
