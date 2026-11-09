import type { PGlite } from "@electric-sql/pglite";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { validateDocument } from "@/lib/templates/engine/validate";
import { applyLegacyToPreset, type LegacyTemplateSettings } from "@/lib/templates/presets";
import { getRegistry } from "@/lib/templates/registry/index";
import { createDb, createUser, onboard } from "./harness";
import { insertTemplate } from "./template-fixtures";

/**
 * Data migration 0013 (D17, D18): V1 store_template_settings -> published version 1 of a default homepage template.
 * The schema is built with migrations up to 0012, legacy rows are inserted, then 0013 is applied by hand so it can be
 * run twice and compared with the TypeScript preset logic.
 */
const MIGRATIONS = join(process.cwd(), "drizzle");
let db: PGlite;

const q = <T = Record<string, unknown>>(s: string, p: unknown[] = []) => db.query<T>(s, p).then((r) => r.rows);

function migrationsUpTo(lastTag: string): string {
  const dir = mkdtempSync(join(tmpdir(), "sf-mig-"));
  mkdirSync(join(dir, "meta"));
  const journal = JSON.parse(readFileSync(join(MIGRATIONS, "meta", "_journal.json"), "utf8")) as { entries: Array<{ tag: string }> };
  journal.entries = journal.entries.slice(0, journal.entries.findIndex((e) => e.tag === lastTag) + 1);
  writeFileSync(join(dir, "meta", "_journal.json"), JSON.stringify(journal));
  for (const e of journal.entries) copyFileSync(join(MIGRATIONS, `${e.tag}.sql`), join(dir, `${e.tag}.sql`));
  return dir;
}

const migration0013 = () => readFileSync(join(MIGRATIONS, "0013_template_legacy_migration.sql"), "utf8");
const runMigration = () => db.exec(migration0013());

type Store = { tenant: string; store: string };
let stores: Record<string, Store>;
const legacy: Record<string, LegacyTemplateSettings> = {};

async function addLegacy(name: string, s: Omit<LegacyTemplateSettings, "heroImagePath"> & { heroImagePath?: string | null }, path?: (tenant: string) => string | null) {
  const { tenant, store } = stores[name];
  const heroImagePath = path ? path(tenant) : (s.heroImagePath ?? null);
  await q(
    "insert into store_template_settings (store_id, tenant_id, template_key, accent_color, hero_heading, hero_subheading, hero_image_path) values ($1,$2,$3,$4,$5,$6,$7)",
    [store, tenant, s.templateKey, s.accentColor, s.heroHeading, s.heroSubheading, heroImagePath],
  );
  legacy[name] = { ...s, heroImagePath };
}

beforeAll(async () => {
  db = await createDb({ migrationsFolder: migrationsUpTo("0012_template_engine") });
  stores = {};
  for (const name of ["full-spot", "plain-classic", "accent-only", "unknown-key", "no-row", "padded"]) {
    const u = await createUser(db, `${name}@example.test`);
    const p = await onboard(db, u, `${name}-shop`);
    stores[name] = { tenant: p.tenant_id, store: p.store_id };
  }
  await addLegacy("full-spot", { templateKey: "spotlight", accentColor: "#ff8800", heroHeading: "Summer sale", heroSubheading: "Up to 40% off", heroImagePath: null }, (t) => `${t}/store/hero.webp`);
  await addLegacy("plain-classic", { templateKey: "classic", accentColor: null, heroHeading: null, heroSubheading: null });
  await addLegacy("accent-only", { templateKey: "classic", accentColor: "#0a1b2c", heroHeading: null, heroSubheading: null });
  await addLegacy("unknown-key", { templateKey: "retired-theme", accentColor: null, heroHeading: "Hello", heroSubheading: null });
  await addLegacy("padded", { templateKey: "spotlight", accentColor: null, heroHeading: "  Padded  ", heroSubheading: " sub ", heroImagePath: null });
  // "no-row" intentionally has no legacy row.
});
afterAll(async () => db.close());

type TemplateRow = { id: string; store_id: string; kind: string; name: string; status: string; is_default: boolean; revision: number; draft: unknown; published_version_id: string };
type VersionRow = { template_id: string; version_number: number; source: string; published_by: string | null; rolled_back_from: string | null; document: unknown };

describe("before 0013", () => {
  it("[AC-DB-014] has the template tables and the legacy rows, and no templates yet", async () => {
    expect((await q("select 1 from templates")).length).toBe(0);
    expect((await q("select 1 from store_template_settings")).length).toBe(5);
  });
});

describe("running 0013", () => {
  let before: Array<Record<string, unknown>>;

  beforeAll(async () => {
    before = await q("select * from store_template_settings order by store_id");
    await runMigration();
  });

  it("[AC-DB-014] creates exactly one default homepage template per store with a legacy row, and nothing for stores without one", async () => {
    const rows = await q<TemplateRow>("select * from templates order by store_id");
    expect(rows.length).toBe(5);
    expect(new Set(rows.map((r) => r.store_id)).size).toBe(5);
    expect(rows.map((r) => r.store_id)).not.toContain(stores["no-row"].store);
    for (const r of rows) expect(r).toMatchObject({ kind: "index", status: "active", is_default: true, revision: 1 });
    expect((await q("select 1 from template_versions v join templates t on t.id = v.template_id where t.store_id = $1", [stores["no-row"].store])).length).toBe(0);
  });

  it("[AC-DB-014] publishes version 1 with source 'migration' and no acting user, and the draft equals the published document", async () => {
    const versions = await q<VersionRow>("select * from template_versions order by template_id");
    expect(versions.length).toBe(5);
    for (const v of versions) expect(v).toMatchObject({ version_number: 1, source: "migration", published_by: null, rolled_back_from: null });
    const joined = await q<{ pointer_ok: boolean; same: boolean; state: string }>(
      "select t.published_version_id = v.id as pointer_ok, t.draft = v.document as same, public.template_publication_state(t.id) as state from templates t join template_versions v on v.id = t.published_version_id",
    );
    expect(joined.length).toBe(5);
    for (const j of joined) expect(j).toEqual({ pointer_ok: true, same: true, state: "published" });
  });

  it("[AC-DB-014] drift: the SQL snapshot equals applyLegacyToPreset() for every store", async () => {
    for (const name of ["full-spot", "plain-classic", "accent-only", "unknown-key", "padded"]) {
      const [t] = await q<TemplateRow>("select * from templates where store_id = $1", [stores[name].store]);
      const expected = applyLegacyToPreset(legacy[name]);
      expect(t.draft, name).toEqual(expected.document);
      expect(t.name, name).toBe(expected.name);
    }
  });

  it("[AC-DB-014] preserves the legacy values: Spotlight hero, accent, trimmed text, image path; unknown keys render classic", async () => {
    const [full] = await q<{ draft: { layout: string; sections: Record<string, { type: string; settings: Record<string, unknown> }>; order: string[] } }>(
      "select draft from templates where store_id = $1", [stores["full-spot"].store],
    );
    expect(full.draft.layout).toBe("spotlight");
    expect(full.draft.order).toEqual(["hero", "products"]);
    expect(full.draft.sections.hero).toMatchObject({
      type: "hero",
      settings: { variant: "spotlight", heading: "Summer sale", subheading: "Up to 40% off", accentColor: "#ff8800", image: { path: `${stores["full-spot"].tenant}/store/hero.webp`, alt: "" } },
    });
    expect(full.draft.sections.products).toMatchObject({ type: "product-grid", settings: { accentColor: "#ff8800" } });

    const [plain] = await q<{ draft: { sections: Record<string, { settings: Record<string, unknown> }> } }>("select draft from templates where store_id = $1", [stores["plain-classic"].store]);
    expect(plain.draft.sections.hero.settings).toEqual({ variant: "classic" }); // unset values are absent, so the defaults apply
    expect(plain.draft.sections.products.settings).toEqual({});

    const [unknown] = await q<{ name: string; draft: { layout: string } }>("select name, draft from templates where store_id = $1", [stores["unknown-key"].store]);
    expect(unknown).toMatchObject({ name: "Classic", draft: { layout: "classic" } });

    const [padded] = await q<{ draft: { sections: { hero: { settings: Record<string, unknown> } } } }>("select draft from templates where store_id = $1", [stores["padded"].store]);
    expect(padded.draft.sections.hero.settings).toMatchObject({ heading: "Padded", subheading: "sub" });
  });

  it("[AC-DB-014] every migrated document is structurally valid: version 1, order matches sections, unique ids, within the size limit", async () => {
    const docs = await q<{ draft: { schemaVersion: number; sections: Record<string, { type: string; blocks: object; block_order: unknown[] }>; order: string[] }; bytes: number }>(
      "select draft, octet_length(draft::text) as bytes from templates",
    );
    for (const { draft, bytes } of docs) {
      expect(draft.schemaVersion).toBe(1);
      expect([...draft.order].sort()).toEqual(Object.keys(draft.sections).sort());
      expect(new Set(draft.order).size).toBe(draft.order.length);
      for (const s of Object.values(draft.sections)) {
        expect(s.blocks).toEqual({});
        expect(s.block_order).toEqual([]);
      }
      expect(bytes).toBeLessThan(262_144);
    }
  });

  it("[AC-ENG-018] [AC-ENG-016] every migrated document passes the shared Zod validator, validated as its owning tenant (Phase 2)", async () => {
    const docs = await q<{ tenant_id: string; draft: unknown }>("select tenant_id, draft from templates");
    const registry = getRegistry();
    expect(docs.length).toBeGreaterThan(0);
    for (const { tenant_id: tenantId, draft } of docs) {
      const res = validateDocument("index", draft, registry, { tenantId });
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.issues.filter((i) => i.level === "error")).toHaveLength(0);
      }
    }
  });

  it("[AC-ENG-016] a migrated document with an image path is rejected without a tenant and under another tenant", async () => {
    const docs = await q<{ tenant_id: string; draft: unknown }>("select tenant_id, draft from templates");
    const registry = getRegistry();
    const withImage = docs.filter((d) => JSON.stringify(d.draft).includes('"path"'));
    expect(withImage.length).toBeGreaterThan(0);
    for (const { tenant_id: tenantId, draft } of withImage) {
      const none = validateDocument("index", draft, registry);
      expect(none.ok).toBe(false);
      expect(none.issues.map((i) => i.code)).toContain("TENANT_REQUIRED");

      const other = validateDocument("index", draft, registry, { tenantId: `${tenantId}-other` });
      expect(other.ok).toBe(false);
      expect(other.issues.map((i) => i.code)).toContain("CROSS_TENANT_PATH");
    }
  });

  it("[AC-DB-014] leaves the legacy table and its data untouched", async () => {
    expect(await q("select * from store_template_settings order by store_id")).toEqual(before);
  });
});

describe("re-running 0013", () => {
  it("[AC-DB-015] creates no duplicate templates or versions, and changes nothing", async () => {
    const snapshot = async () => ({
      templates: await q("select id, store_id, name, draft, revision, published_version_id, updated_at from templates order by id"),
      versions: await q("select id, template_id, version_number, source, document, published_at from template_versions order by id"),
    });
    const first = await snapshot();
    await runMigration();
    await runMigration();
    expect(await snapshot()).toEqual(first);
    expect(first.templates.length).toBe(5);
    expect(first.versions.length).toBe(5);
  });

  it("[AC-DB-015] skips a store that already has a default homepage template, even if its legacy row changes later", async () => {
    const u = await createUser(db, "late@example.test");
    const p = await onboard(db, u, "late-shop");
    await insertTemplate(db, { tenantId: p.tenant_id, storeId: p.store_id, kind: "index", isDefault: true, name: "Mine" });
    await q("insert into store_template_settings (store_id, tenant_id, template_key, hero_heading) values ($1,$2,'spotlight','Legacy only')", [p.store_id, p.tenant_id]);
    await runMigration();
    const rows = await q<{ name: string }>("select name from templates where store_id = $1", [p.store_id]);
    expect(rows).toEqual([{ name: "Mine" }]);
    expect((await q("select 1 from template_versions v join templates t on t.id = v.template_id where t.store_id = $1", [p.store_id])).length).toBe(0);
  });

  it("[AC-DB-015] a store with a legacy row but only a non-default homepage template still gets its migrated default", async () => {
    const u = await createUser(db, "nondefault@example.test");
    const p = await onboard(db, u, "nondefault-shop");
    await insertTemplate(db, { tenantId: p.tenant_id, storeId: p.store_id, kind: "index", isDefault: false, name: "Extra" });
    await q("insert into store_template_settings (store_id, tenant_id, template_key) values ($1,$2,'classic')", [p.store_id, p.tenant_id]);
    await runMigration();
    expect((await q<{ name: string; is_default: boolean }>("select name, is_default from templates where store_id = $1 order by name", [p.store_id]))).toEqual([
      { name: "Classic", is_default: true },
      { name: "Extra", is_default: false },
    ]);
  });
});

describe("the full migration chain", () => {
  it("[AC-DB-015] applies 0010 through 0015 on a fresh database with legacy-free data and keeps the V1 table", async () => {
    const fresh = await createDb();
    try {
      const [r] = (await fresh.query<{ templates: number; legacy: number }>(
        "select (select count(*)::int from templates) as templates, (select count(*)::int from store_template_settings) as legacy",
      )).rows;
      expect(r).toEqual({ templates: 0, legacy: 0 });
    } finally {
      await fresh.close();
    }
  });

  it("[AC-DB-015] the real Drizzle migrator applies 0013 and 0014 over a database that already has legacy rows (the deploy path)", async () => {
    const live = await createDb({ migrationsFolder: migrationsUpTo("0012_template_engine") });
    try {
      const u = await createUser(live, "deploy@example.test");
      const p = await onboard(live, u, "deploy-shop");
      await live.query("insert into store_template_settings (store_id, tenant_id, template_key, accent_color, hero_heading) values ($1,$2,'spotlight','#112233','Deployed')", [p.store_id, p.tenant_id]);
      await migrate(drizzle(live), { migrationsFolder: MIGRATIONS });
      const [t] = (await live.query<{ draft: unknown; version_number: number; source: string; fn: boolean }>(
        "select t.draft, v.version_number, v.source, (select count(*) = 4 from pg_proc where proname in ('get_public_collections','get_public_collection','get_public_product','get_public_template_layout')) as fn from templates t join template_versions v on v.id = t.published_version_id where t.store_id = $1",
        [p.store_id],
      )).rows;
      expect(t.draft).toEqual(applyLegacyToPreset({ templateKey: "spotlight", accentColor: "#112233", heroHeading: "Deployed", heroSubheading: null, heroImagePath: null }).document);
      expect(t).toMatchObject({ version_number: 1, source: "migration", fn: true });
      await migrate(drizzle(live), { migrationsFolder: MIGRATIONS }); // already applied: a no-op
      expect((await live.query("select 1 from templates")).rows.length).toBe(1);
    } finally {
      await live.close();
    }
  });
});
