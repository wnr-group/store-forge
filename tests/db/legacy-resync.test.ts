import type { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assertResyncComplete, resyncLegacyTemplates, type ResyncDb, type ResyncQuery } from "@/lib/templates/legacy-resync";
import { applyLegacyToPreset, type LegacyTemplateSettings } from "@/lib/templates/presets";
import { createDb, createUser, onboard } from "./harness";
import { doc, insertTemplate, publish } from "./template-fixtures";

/**
 * Cutover re-sync of V1 store_template_settings into the engine [AC-DB-023] (architecture option B, D17/D18, risk X2).
 * Setup mirrors production: V1 rows exist, migration 0013 ran (the one-time snapshot), V1 saves happened afterwards,
 * and only now is the re-sync run. Each scenario uses its own store so results never depend on test order.
 */

const migration0013 = () => readFileSync(join(process.cwd(), "drizzle", "0013_template_legacy_migration.sql"), "utf8");

let db: PGlite;
const q = <T = Record<string, unknown>>(s: string, p: unknown[] = []) => db.query<T>(s, p).then((r) => r.rows);

const adapt = (failOn?: (sql: string, params: unknown[]) => boolean): ResyncDb => {
  const wrap = (run: (s: string, p: unknown[]) => Promise<{ rows: unknown[] }>): ResyncQuery =>
    (async (s: string, p: unknown[] = []) => {
      if (failOn?.(s, p)) throw new Error("injected failure");
      return (await run(s, p)).rows;
    }) as ResyncQuery;
  return {
    query: wrap((s, p) => db.query(s, p)),
    transaction: (fn) => db.transaction((tx) => fn(wrap((s, p) => tx.query(s, p)))),
  };
};

type Shop = { tenant: string; store: string };
let n = 0;
async function shop(): Promise<Shop> {
  const id = ++n;
  const u = await createUser(db, `resync${id}@example.test`);
  const p = await onboard(db, u, `resync-shop-${id}`);
  return { tenant: p.tenant_id, store: p.store_id };
}
async function setV1(s: Shop, v: Partial<LegacyTemplateSettings> & { templateKey?: string }) {
  const row = { templateKey: "classic", accentColor: null, heroHeading: null, heroSubheading: null, heroImagePath: null, ...v };
  await q(
    `insert into store_template_settings (store_id, tenant_id, template_key, accent_color, hero_heading, hero_subheading, hero_image_path)
     values ($1,$2,$3,$4,$5,$6,$7)
     on conflict (store_id) do update set template_key = excluded.template_key, accent_color = excluded.accent_color,
       hero_heading = excluded.hero_heading, hero_subheading = excluded.hero_subheading, hero_image_path = excluded.hero_image_path`,
    [s.store, s.tenant, row.templateKey, row.accentColor, row.heroHeading, row.heroSubheading, row.heroImagePath],
  );
  return row as LegacyTemplateSettings;
}
const runMigration = () => db.exec(migration0013());
const templateOf = async (s: Shop) => (await q<{ id: string; name: string; draft: unknown; published_version_id: string | null; revision: number; status: string }>("select * from templates where store_id = $1 and kind = 'index' and is_default", [s.store]))[0];
const versionsOf = async (s: Shop) => q<{ id: string; version_number: number; source: string; label: string | null; document: unknown }>("select v.* from template_versions v join templates t on t.id = v.template_id where t.store_id = $1 order by v.version_number", [s.store]);
const outcome = (r: Awaited<ReturnType<typeof resyncLegacyTemplates>>, s: Shop) => r.outcomes.find((o) => o.storeId === s.store);
const only = (s: Shop[]) => ({ storeIds: s.map((x) => x.store) });

beforeAll(async () => {
  db = await createDb();
});
afterAll(async () => db.close());

describe("[AC-DB-023] initial synchronization", () => {
  it("[AC-DB-023] creates the default homepage template and published version 1 for a store that has a V1 row but no engine template", async () => {
    const s = await shop();
    const v1 = await setV1(s, { templateKey: "spotlight", heroHeading: "Hello", accentColor: "#112233" });
    const r = await resyncLegacyTemplates(adapt(), only([s]));
    expect(outcome(r, s)).toMatchObject({ action: "created", versionNumber: 1 });
    const t = await templateOf(s);
    const expected = applyLegacyToPreset(v1);
    expect(t.draft).toEqual(expected.document);
    expect(t.name).toBe(expected.name);
    const [v] = await versionsOf(s);
    expect(v).toMatchObject({ version_number: 1, source: "migration", label: "legacy re-sync" });
    expect(t.published_version_id).toBe(v.id);
    expect((await q<{ s: string }>("select public.template_publication_state($1) as s", [t.id]))[0].s).toBe("published");
  });

  it("[AC-DB-023] stores without a V1 row get nothing", async () => {
    const s = await shop();
    const r = await resyncLegacyTemplates(adapt(), only([s]));
    expect(outcome(r, s)).toBeUndefined();
    expect(await templateOf(s)).toBeUndefined();
  });
});

describe("[AC-DB-023] V1 changes between migration and cutover", () => {
  it("[AC-DB-023] adds version 2 (source migration), moves pointer and draft, and leaves version 1 untouched", async () => {
    const s = await shop();
    await setV1(s, { templateKey: "classic", heroHeading: "Before", heroImagePath: `${s.tenant}/store/old.webp` });
    await runMigration();
    const [v1Before] = await versionsOf(s);
    // The merchant keeps using the V1 settings page after 0013 ran.
    const v1Now = await setV1(s, { templateKey: "spotlight", heroHeading: "After", accentColor: "#abcdef", heroImagePath: `${s.tenant}/store/new.webp` });

    const r = await resyncLegacyTemplates(adapt(), only([s]));
    expect(outcome(r, s)).toMatchObject({ action: "resynced", versionNumber: 2 });
    const versions = await versionsOf(s);
    expect(versions.map((v) => v.version_number)).toEqual([1, 2]);
    expect(versions[0]).toEqual(v1Before); // published version 1 is byte-for-byte preserved (history and rollback intact)
    expect(versions[1]).toMatchObject({ source: "migration", label: "legacy re-sync" });
    const t = await templateOf(s);
    const expected = applyLegacyToPreset(v1Now);
    expect(versions[1].document).toEqual(expected.document);
    expect(t.draft).toEqual(expected.document);
    expect(t.name).toBe("Spotlight");
    expect(t.published_version_id).toBe(versions[1].id);
    expect((await q<{ s: string }>("select public.template_publication_state($1) as s", [t.id]))[0].s).toBe("published");
    // The old hero is still in version 1, so image reference protection keeps that file (see AC-DB-022).
    expect(JSON.stringify(versions[0].document)).toContain("old.webp");
  });
});

describe("[AC-DB-023] repeated synchronization is idempotent", () => {
  it("[AC-DB-023] a second and third run write nothing", async () => {
    const s = await shop();
    await setV1(s, { heroHeading: "One" });
    await runMigration();
    await setV1(s, { heroHeading: "Two" });
    expect(outcome(await resyncLegacyTemplates(adapt(), only([s])), s)?.action).toBe("resynced");
    const snapshot = async () => JSON.stringify({ t: await templateOf(s), v: await versionsOf(s) });
    const first = await snapshot();
    for (let i = 0; i < 2; i++) {
      const r = await resyncLegacyTemplates(adapt(), only([s]));
      expect(outcome(r, s)?.action).toBe("unchanged");
    }
    expect(await snapshot()).toBe(first);
  });

  it("[AC-DB-023] a later V1 change produces exactly one more version", async () => {
    const s = await shop();
    await setV1(s, { heroHeading: "A" });
    await runMigration();
    await setV1(s, { heroHeading: "B" });
    await resyncLegacyTemplates(adapt(), only([s]));
    await setV1(s, { heroHeading: "C" });
    expect(outcome(await resyncLegacyTemplates(adapt(), only([s])), s)?.action).toBe("resynced");
    expect((await versionsOf(s)).map((v) => v.version_number)).toEqual([1, 2, 3]);
  });
});

describe("[AC-DB-023] multiple tenants", () => {
  it("[AC-DB-023] each store is synced from its own tenant's V1 row; unchanged stores and other tenants are untouched; dry run writes nothing", async () => {
    const a = await shop();
    const b = await shop();
    const c = await shop();
    await setV1(a, { heroHeading: "A1", heroImagePath: `${a.tenant}/store/a.webp` });
    await setV1(b, { heroHeading: "B1", heroImagePath: `${b.tenant}/store/b.webp` });
    await setV1(c, { heroHeading: "C1" });
    await runMigration();
    const cBefore = JSON.stringify({ t: await templateOf(c), v: await versionsOf(c) });
    await setV1(a, { heroHeading: "A2", heroImagePath: `${a.tenant}/store/a.webp` });
    await setV1(b, { templateKey: "spotlight", heroHeading: "B2", heroImagePath: `${b.tenant}/store/b.webp` });

    const dry = await resyncLegacyTemplates(adapt(), { dryRun: true, ...only([a, b, c]) });
    expect(dry).toMatchObject({ dryRun: true, pending: 2 });
    expect((await versionsOf(a)).length).toBe(1);
    expect((await versionsOf(b)).length).toBe(1);

    const r = await resyncLegacyTemplates(adapt(), only([a, b, c]));
    expect(r.counts).toMatchObject({ resynced: 2, unchanged: 1, failed: 0 });
    expect(outcome(r, c)?.action).toBe("unchanged");
    expect(JSON.stringify({ t: await templateOf(c), v: await versionsOf(c) })).toBe(cBefore);
    for (const [shopX, heading, tenantOf] of [[a, "A2", a.tenant], [b, "B2", b.tenant]] as const) {
      const text = JSON.stringify((await templateOf(shopX)).draft);
      expect(text).toContain(heading);
      expect(text).toContain(`${tenantOf}/store/`);
      const other = shopX === a ? b.tenant : a.tenant;
      expect(text).not.toContain(other);
    }
  });
});

describe("[AC-DB-023] partial failure and retry", () => {
  it("[AC-DB-023] a failure rolls back only that store, the others complete, the gate stays closed, and a retry finishes it", async () => {
    const good = await shop();
    const bad = await shop();
    await setV1(good, { heroHeading: "g1" });
    await setV1(bad, { heroHeading: "b1" });
    await runMigration();
    await setV1(good, { heroHeading: "g2" });
    await setV1(bad, { heroHeading: "b2" });
    const badBefore = JSON.stringify({ t: await templateOf(bad), v: await versionsOf(bad) });

    // Fail after the new version is inserted but before the pointer moves: the half-written store must roll back.
    const badTemplateId = (await templateOf(bad)).id;
    const failOnBad = adapt((s, p) => s.includes("update public.templates set draft") && p[3] === badTemplateId);
    const first = await resyncLegacyTemplates(failOnBad, only([good, bad]));
    expect(outcome(first, good)?.action).toBe("resynced");
    expect(outcome(first, bad)).toMatchObject({ action: "failed", reason: "injected failure" });
    expect(first).toMatchObject({ ok: false, failed: 1 });
    expect(JSON.stringify({ t: await templateOf(bad), v: await versionsOf(bad) })).toBe(badBefore); // no orphan version, pointer and draft unchanged
    await expect(assertResyncComplete(adapt())).rejects.toThrow(/not complete/);

    const retry = await resyncLegacyTemplates(adapt(), only([good, bad]));
    expect(outcome(retry, good)?.action).toBe("unchanged");
    expect(outcome(retry, bad)?.action).toBe("resynced");
    expect(retry.ok).toBe(true);
    expect((await versionsOf(bad)).map((v) => v.version_number)).toEqual([1, 2]);
  });

  it("[AC-DB-023] V1 settings that produce an invalid document fail that store only and change nothing", async () => {
    const s = await shop();
    const other = await shop();
    await setV1(s, { heroHeading: "ok" });
    await setV1(other, { heroHeading: "ok" });
    await runMigration();
    // An image path from ANOTHER tenant's folder is rejected by the shared validator's tenant check.
    // The V1 table's own CHECK already refuses this value, so the constraint is dropped in this isolated test database to prove the re-sync's own validator guard.
    await q("alter table store_template_settings drop constraint store_template_settings_hero_image_path_check");
    await q("update store_template_settings set hero_image_path = $1, hero_heading = 'bad' where store_id = $2", [`${other.tenant}/store/x.webp`, s.store]);
    await setV1(other, { heroHeading: "changed" });
    const before = JSON.stringify({ t: await templateOf(s), v: await versionsOf(s) });
    const r = await resyncLegacyTemplates(adapt(), only([s, other]));
    expect(outcome(r, s)).toMatchObject({ action: "failed", reason: "legacy settings produce an invalid document" });
    expect(outcome(r, other)?.action).toBe("resynced");
    expect(JSON.stringify({ t: await templateOf(s), v: await versionsOf(s) })).toBe(before);
    await q("delete from store_template_settings where store_id = $1", [s.store]); // keep this deliberately bad store from failing the global gate test below
  });
});

describe("[AC-DB-023] existing engine-side data is never overwritten (engine wins)", () => {
  async function migratedThenChangedInV1() {
    const s = await shop();
    await setV1(s, { heroHeading: "v1-old" });
    await runMigration();
    await setV1(s, { heroHeading: "v1-new" });
    return s;
  }
  const untouched = async (s: Shop, before: string) => expect(JSON.stringify({ t: await templateOf(s), v: await versionsOf(s) })).toBe(before);
  const snap = async (s: Shop) => JSON.stringify({ t: await templateOf(s), v: await versionsOf(s) });

  it("[AC-DB-023] an engine-side publish (a version that is not from the migration) blocks the overwrite", async () => {
    const s = await migratedThenChangedInV1();
    const t = await templateOf(s);
    await publish(pg(), { tenantId: s.tenant, storeId: s.store, templateId: t.id, document: doc({ layout: "classic", sections: { x: { type: "hero", settings: { heading: "engine" }, blocks: {}, block_order: [] } }, order: ["x"] }) });
    const before = await snap(s);
    const r = await resyncLegacyTemplates(adapt(), only([s]));
    expect(outcome(r, s)?.action).toBe("skipped_engine_modified");
    await untouched(s, before);
  });

  it("[AC-DB-023] an unpublished engine draft edit blocks the overwrite", async () => {
    const s = await migratedThenChangedInV1();
    const t = await templateOf(s);
    await q("update templates set draft = draft || '{\"layout\":\"edited\"}'::jsonb where id = $1", [t.id]);
    const before = await snap(s);
    expect(outcome(await resyncLegacyTemplates(adapt(), only([s])), s)?.action).toBe("skipped_engine_modified");
    await untouched(s, before);
  });

  it("[AC-DB-023] an archived or renamed template blocks the overwrite", async () => {
    const archived = await migratedThenChangedInV1();
    await q("update templates set status = 'archived', is_default = false where store_id = $1", [archived.store]);
    // Archived and no longer default: the store now has no default template, so a fresh default is created beside it (never touching the archived one).
    const archivedBefore = JSON.stringify(await q("select * from templates where store_id = $1 and status = 'archived'", [archived.store]));
    const ra = await resyncLegacyTemplates(adapt(), only([archived]));
    expect(outcome(ra, archived)?.action).toBe("created");
    expect(JSON.stringify(await q("select * from templates where store_id = $1 and status = 'archived'", [archived.store]))).toBe(archivedBefore);

    const renamed = await migratedThenChangedInV1();
    await q("update templates set name = 'My custom home' where store_id = $1", [renamed.store]);
    const before = await snap(renamed);
    expect(outcome(await resyncLegacyTemplates(adapt(), only([renamed])), renamed)?.action).toBe("skipped_engine_modified");
    await untouched(renamed, before);
  });

  it("[AC-DB-023] an engine-created default (never from the migration) is left alone", async () => {
    const s = await shop();
    await setV1(s, { heroHeading: "v1" });
    const id = await insertTemplate(pg(), { tenantId: s.tenant, storeId: s.store, kind: "index", isDefault: true, name: "Classic", draft: doc() });
    await publish(pg(), { tenantId: s.tenant, storeId: s.store, templateId: id, document: doc(), source: "publish" });
    const before = await snap(s);
    expect(outcome(await resyncLegacyTemplates(adapt(), only([s])), s)?.action).toBe("skipped_engine_modified");
    await untouched(s, before);
  });
});

describe("[AC-DB-023] the activation gate and lock discipline", () => {
  it("[AC-DB-023] assertResyncComplete fails while a store still differs from V1 and passes after the re-sync", async () => {
    const s = await shop();
    await setV1(s, { heroHeading: "g1" });
    await runMigration();
    await setV1(s, { heroHeading: "g2" });
    await expect(assertResyncComplete(adapt())).rejects.toThrow(/still differ from V1/);
    await resyncLegacyTemplates(adapt());
    await expect(assertResyncComplete(adapt())).resolves.toMatchObject({ failed: 0, pending: 0 });
  });

  it("[AC-DB-023] it locks the store row (the lock V1 writers take) before reading V1 or writing", async () => {
    const s = await shop();
    await setV1(s, { heroHeading: "x" });
    const seen: string[] = [];
    const spy = adapt((sql) => {
      seen.push(sql);
      return false;
    });
    await resyncLegacyTemplates(spy, only([s]));
    const lock = seen.findIndex((x) => x.includes("from public.stores") && x.includes("for update"));
    const readV1 = seen.findIndex((x, i) => i > lock && x.includes("from public.store_template_settings"));
    const write = seen.findIndex((x) => x.includes("insert into public.templates"));
    expect(lock).toBeGreaterThanOrEqual(0);
    expect(readV1).toBeGreaterThan(lock);
    expect(write).toBeGreaterThan(readV1);
  });
});

function pg(): PGlite {
  return db;
}
