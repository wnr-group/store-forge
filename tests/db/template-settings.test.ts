import type { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { errorChain } from "@/lib/db/errors";
import { storeTemplateSettings } from "@/lib/db/schema";
import { upsertTemplateSettings } from "@/lib/db/template-settings-upsert";
import { asUser, createDb, createUser, onboard } from "./harness";

let db: PGlite;
let owner: string, manager: string, staff: string, ownerB: string;
let tenantA: string, tenantB: string, storeA: string, storeB: string;

const q = <T = Record<string, unknown>>(s: string, p: unknown[] = []) => db.query<T>(s, p).then((r) => r.rows);
const fails = async (p: Promise<unknown>) => {
  try {
    await p;
    return "";
  } catch (e) {
    return errorChain(e);
  }
};
const orm = () => drizzle(db);
type Fields = { templateKey: string; accentColor?: string | null; heroHeading?: string | null; heroSubheading?: string | null; heroImagePath?: string | null };
/** The exact function the service uses (explicit SQL upsert), run through Drizzle on the same connection. */
const upsert = (storeId: string, tenantId: string, v: Fields) =>
  upsertTemplateSettings(orm() as never, {
    storeId, tenantId, templateKey: v.templateKey, accentColor: v.accentColor ?? null, heroHeading: v.heroHeading ?? null, heroSubheading: v.heroSubheading ?? null, heroImagePath: v.heroImagePath ?? null,
  });
const rowFor = async (storeId: string) => (await q("select * from store_template_settings where store_id = $1", [storeId]))[0];
const clear = () => q("delete from store_template_settings");

beforeAll(async () => {
  db = await createDb();
  [owner, manager, staff, ownerB] = await Promise.all(["olivia", "mia", "sam", "bob"].map((n) => createUser(db, `${n}@example.test`)));
  const a = await onboard(db, owner, "alpha-shop");
  const b = await onboard(db, ownerB, "beta-shop");
  [tenantA, storeA, tenantB, storeB] = [a.tenant_id, a.store_id, b.tenant_id, b.store_id];
  await q("insert into memberships (tenant_id, user_id, role) values ($1,$2,'admin'), ($1,$3,'staff')", [tenantA, manager, staff]);
});
afterAll(async () => db.close());

describe("schema and names", () => {
  it("creates the table with RLS enabled and the agreed constraint and policy names", async () => {
    const names = (await q<{ conname: string }>("select conname from pg_constraint where conrelid in ('public.store_template_settings'::regclass, 'public.stores'::regclass)")).map((r) => r.conname);
    for (const n of ["store_template_settings_pkey", "store_template_settings_store_fk", "store_template_settings_template_key_check", "store_template_settings_accent_color_check", "store_template_settings_hero_heading_check", "store_template_settings_hero_subheading_check", "store_template_settings_hero_image_path_check", "stores_tenant_id_id_key"]) {
      expect(names, n).toContain(n);
    }
    expect((await q<{ r: boolean }>("select relrowsecurity r from pg_class where oid = 'public.store_template_settings'::regclass"))[0].r).toBe(true);
    expect((await q<{ policyname: string }>("select policyname from pg_policies where tablename = 'store_template_settings' order by 1")).map((r) => r.policyname)).toEqual([
      "store_template_settings_insert_admins", "store_template_settings_select_members", "store_template_settings_update_admins",
    ]);
  });
});

describe("privileges", () => {
  it("grants exactly the intended table and column privileges", async () => {
    const [r] = await q<Record<string, boolean>>(`select
      has_table_privilege('anon','public.store_template_settings','select,insert,update,delete') as anon_any,
      has_table_privilege('authenticated','public.store_template_settings','select') as sel,
      has_table_privilege('authenticated','public.store_template_settings','insert') as table_insert,
      has_table_privilege('authenticated','public.store_template_settings','update') as table_update,
      has_table_privilege('authenticated','public.store_template_settings','delete') as del,
      has_column_privilege('authenticated','public.store_template_settings','template_key','update') as upd_key,
      has_column_privilege('authenticated','public.store_template_settings','hero_image_path','update') as upd_hero,
      has_column_privilege('authenticated','public.store_template_settings','tenant_id','update') as upd_tenant,
      has_column_privilege('authenticated','public.store_template_settings','store_id','update') as upd_store,
      has_column_privilege('authenticated','public.store_template_settings','updated_at','update') as upd_updated,
      has_column_privilege('authenticated','public.store_template_settings','tenant_id','insert') as ins_tenant,
      has_column_privilege('authenticated','public.store_template_settings','updated_at','insert') as ins_updated`);
    expect(r).toEqual({ anon_any: false, sel: true, table_insert: false, table_update: false, del: false, upd_key: true, upd_hero: true, upd_tenant: false, upd_store: false, upd_updated: false, ins_tenant: true, ins_updated: false });
  });
});

describe("roles and RLS", () => {
  it("Owner: first save inserts, second save updates, through the real Drizzle upsert", async () => {
    await clear();
    await asUser(db, owner, () => upsert(storeA, tenantA, { templateKey: "classic", heroHeading: "One" }));
    expect(await rowFor(storeA)).toMatchObject({ template_key: "classic", hero_heading: "One" });
    await asUser(db, owner, () => upsert(storeA, tenantA, { templateKey: "spotlight", accentColor: "#1a2b3c", heroHeading: "Two" }));
    expect(await rowFor(storeA)).toMatchObject({ template_key: "spotlight", accent_color: "#1a2b3c", hero_heading: "Two" });
    expect((await q("select 1 from store_template_settings where store_id = $1", [storeA])).length).toBe(1);
  });

  it("Manager can save; the insert path and the conflict-update path both work", async () => {
    await clear();
    await asUser(db, manager, () => upsert(storeA, tenantA, { templateKey: "spotlight" }));
    await asUser(db, manager, () => upsert(storeA, tenantA, { templateKey: "classic", heroHeading: "By manager" }));
    expect(await rowFor(storeA)).toMatchObject({ template_key: "classic", hero_heading: "By manager" });
  });

  it("Staff can read but cannot insert or update", async () => {
    await clear();
    await q("insert into store_template_settings (store_id, tenant_id, template_key) values ($1,$2,'classic')", [storeA, tenantA]);
    expect(await asUser(db, staff, () => q("select store_id from store_template_settings"))).toHaveLength(1);
    expect(await fails(asUser(db, staff, () => upsert(storeA, tenantA, { templateKey: "spotlight" })))).toMatch(/row-level security|permission denied/);
    const changed = await asUser(db, staff, () => q("update store_template_settings set template_key = 'spotlight' where store_id = $1 returning store_id", [storeA]));
    expect(changed).toEqual([]);
    expect((await rowFor(storeA))!.template_key).toBe("classic");
  });

  it("another tenant cannot read or write this tenant's settings", async () => {
    await clear();
    await q("insert into store_template_settings (store_id, tenant_id, template_key) values ($1,$2,'classic')", [storeA, tenantA]);
    expect(await asUser(db, ownerB, () => q("select store_id from store_template_settings"))).toEqual([]);
    expect(await fails(asUser(db, ownerB, () => upsert(storeA, tenantA, { templateKey: "spotlight" })))).toMatch(/row-level security|permission denied/);
    // tenant B's own id + tenant A's store: the RLS EXISTS check rejects it first; the composite FK is the backstop (next test).
    expect(await fails(asUser(db, ownerB, () => upsert(storeA, tenantB, { templateKey: "spotlight" })))).toMatch(/row-level security|store_template_settings_store_fk|foreign key/);
    expect(await asUser(db, ownerB, () => q("update store_template_settings set template_key = 'spotlight' returning store_id"))).toEqual([]);
    expect((await rowFor(storeA))!.template_key).toBe("classic");
  });

  it("Drizzle's insert builder names updated_at, which the strict column grants refuse (why the upsert is explicit SQL)", async () => {
    await clear();
    const err = await fails(asUser(db, owner, () => orm().insert(storeTemplateSettings).values({ storeId: storeA, tenantId: tenantA, templateKey: "classic" })));
    expect(err).toMatch(/permission denied/);
    expect(await rowFor(storeA)).toBeUndefined();
  });

  it("a row whose tenant does not own the store is rejected by the composite FK, even for a superuser", async () => {
    await clear();
    expect(await fails(q("insert into store_template_settings (store_id, tenant_id, template_key) values ($1,$2,'classic')", [storeA, tenantB]))).toMatch(/store_template_settings_store_fk|foreign key/);
  });

  it("identity columns cannot be updated and rows cannot be deleted", async () => {
    await clear();
    await q("insert into store_template_settings (store_id, tenant_id, template_key) values ($1,$2,'classic')", [storeA, tenantA]);
    for (const col of ["tenant_id", "store_id", "updated_at"]) {
      const value = col === "updated_at" ? "now()" : `'${col === "tenant_id" ? tenantB : storeB}'`;
      expect(await fails(asUser(db, owner, () => q(`update store_template_settings set ${col} = ${value}`))), col).toMatch(/permission denied/);
    }
    expect(await fails(asUser(db, owner, () => q("delete from store_template_settings")))).toMatch(/permission denied/);
    expect(await rowFor(storeA)).toBeDefined();
  });

  it("anonymous callers have no access", async () => {
    await db.exec("set role anon");
    try {
      expect(await fails(q("select * from store_template_settings"))).toMatch(/permission denied/);
      expect(await fails(q("insert into store_template_settings (store_id, tenant_id, template_key) values ($1,$2,'classic')", [storeA, tenantA]))).toMatch(/permission denied/);
    } finally {
      await db.exec("reset role");
    }
  });

  it("SELECT ... FOR UPDATE on stores works for Owner and Manager under column-level grants, and never returns the row to Staff", async () => {
    const lock = () => q<{ id: string }>("select id from stores where tenant_id = $1 for update", [tenantA]);
    expect(await asUser(db, owner, lock)).toHaveLength(1);
    expect(await asUser(db, manager, lock)).toHaveLength(1);
    const staffLock = await asUser(db, staff, () => lock().then((rows) => ({ rows: rows.length }), (e) => ({ error: errorChain(e) })));
    // Observed behavior is recorded in the test title/output for the closeout report.
    console.info("[V3] Staff SELECT ... FOR UPDATE on stores ->", JSON.stringify(staffLock));
    expect("error" in staffLock || staffLock.rows === 0, JSON.stringify(staffLock)).toBe(true);
  });
});

describe("CHECK constraints (database repeats the app rules)", () => {
  const insert = (col: string, val: unknown) =>
    fails(q(`insert into store_template_settings (store_id, tenant_id, template_key, ${col}) values ($1,$2,'classic',$3)`, [storeA, tenantA, val]));

  it("accepts valid values and NULLs", async () => {
    await clear();
    expect(await insert("accent_color", "#abcdef")).toBe("");
    await clear();
    expect(await insert("hero_heading", "a".repeat(80))).toBe("");
    await clear();
    expect(await insert("hero_subheading", "a".repeat(200))).toBe("");
    await clear();
    expect(await insert("hero_image_path", `${tenantA}/store/h.webp`)).toBe("");
    await clear();
    expect(await insert("accent_color", null)).toBe("");
    await clear();
  });

  it("rejects bad colors, lengths, blank text and foreign or traversing image paths", async () => {
    const cases: Array<[string, unknown]> = [
      ["accent_color", "#ABCDEF"], ["accent_color", "red"], ["accent_color", "#abc"], ["accent_color", "#abcdef; x"],
      ["hero_heading", "a".repeat(81)], ["hero_heading", "   "], ["hero_subheading", "a".repeat(201)],
      ["hero_image_path", `${tenantB}/store/h.webp`], ["hero_image_path", `${tenantA}/store/../x.webp`], ["hero_image_path", `${tenantA}/other/h.webp`],
    ];
    for (const [col, val] of cases) expect(await insert(col, val), `${col}=${String(val)}`).toMatch(/check constraint/);
  });

  it("rejects a malformed template key", async () => {
    for (const k of ["Bad Key", "x", "", "UPPER", "a".repeat(41)]) {
      expect(await fails(q("insert into store_template_settings (store_id, tenant_id, template_key) values ($1,$2,$3)", [storeA, tenantA, k])), k).toMatch(/check constraint/);
    }
  });
});

describe("trigger and cascade", () => {
  it("moves updated_at on update", async () => {
    await clear();
    await q("insert into store_template_settings (store_id, tenant_id, template_key) values ($1,$2,'classic')", [storeA, tenantA]);
    const before = (await rowFor(storeA))!.updated_at as Date;
    await q("select pg_sleep(0.05)");
    await asUser(db, owner, () => upsert(storeA, tenantA, { templateKey: "spotlight" }));
    expect(((await rowFor(storeA))!.updated_at as Date).getTime()).toBeGreaterThan(before.getTime());
  });

  it("deleting a store removes its settings", async () => {
    const g = await createUser(db, "gail@example.test");
    const c = await onboard(db, g, "gamma-shop");
    await q("insert into store_template_settings (store_id, tenant_id, template_key) values ($1,$2,'classic')", [c.store_id, c.tenant_id]);
    await q("delete from stores where id = $1", [c.store_id]);
    expect(await rowFor(c.store_id)).toBeUndefined();
  });
});

describe("get_public_storefront() with templates", () => {
  async function storefront(slug: string) {
    await db.exec("begin; set local role authenticated");
    try {
      return (await db.query<{ s: Record<string, unknown> | null }>("select public.get_public_storefront($1) s", [slug])).rows[0].s;
    } finally {
      await db.exec("rollback");
    }
  }

  it("keeps every existing field and returns template: null when there are no settings", async () => {
    await clear();
    const s = (await storefront("alpha-shop"))!;
    expect(Object.keys(s).sort()).toEqual(["currency", "description", "logo_path", "name", "products", "slug", "template"]);
    expect(s.template).toBeNull();
  });

  it("returns the saved template with exactly five public keys and no identifiers", async () => {
    await clear();
    await q("insert into store_template_settings (store_id, tenant_id, template_key, accent_color, hero_heading, hero_subheading, hero_image_path) values ($1,$2,'spotlight','#1a2b3c','Hello','World',$3)", [storeA, tenantA, `${tenantA}/store/h.webp`]);
    const s = (await storefront("alpha-shop"))!;
    expect(s.template).toEqual({ key: "spotlight", accent_color: "#1a2b3c", hero_heading: "Hello", hero_subheading: "World", hero_image_path: `${tenantA}/store/h.webp` });
    const json = JSON.stringify(s);
    for (const secret of ["store_id", "updated_at", storeA, tenantB, storeB]) expect(json, secret).not.toContain(secret);
  });

  it("does not leak another tenant's template and returns an unknown key as stored (the app falls back)", async () => {
    await clear();
    await q("insert into store_template_settings (store_id, tenant_id, template_key) values ($1,$2,'removed-template')", [storeB, tenantB]);
    expect(((await storefront("alpha-shop"))!).template).toBeNull();
    expect((((await storefront("beta-shop"))!).template as { key: string }).key).toBe("removed-template");
  });

  it("is still not executable by anon, and inactive stores still look missing", async () => {
    await db.exec("set role anon");
    try {
      expect(await fails(q("select public.get_public_storefront('alpha-shop')"))).toMatch(/permission denied/);
    } finally {
      await db.exec("reset role");
    }
    await q("update stores set status = 'inactive' where id = $1", [storeA]);
    expect(await storefront("alpha-shop")).toBeNull();
    await q("update stores set status = 'active' where id = $1", [storeA]);
  });
});

describe("applying only 0010 does not expose the table", () => {
  function partialMigrations(lastTag: string): string {
    const src = join(process.cwd(), "drizzle");
    const dir = mkdtempSync(join(tmpdir(), "sf-mig-"));
    mkdirSync(join(dir, "meta"));
    const journal = JSON.parse(readFileSync(join(src, "meta", "_journal.json"), "utf8")) as { entries: Array<{ tag: string }> };
    journal.entries = journal.entries.slice(0, journal.entries.findIndex((e) => e.tag === lastTag) + 1);
    writeFileSync(join(dir, "meta", "_journal.json"), JSON.stringify(journal));
    for (const e of journal.entries) copyFileSync(join(src, `${e.tag}.sql`), join(dir, `${e.tag}.sql`));
    return dir;
  }

  it("the table is default-deny and the public function is the old one", async () => {
    const partial = await createDb({ migrationsFolder: partialMigrations("0010_store_template_settings") });
    try {
      const [r] = (await partial.query<Record<string, boolean>>(`select
        has_table_privilege('authenticated','public.store_template_settings','select') as sel,
        has_table_privilege('anon','public.store_template_settings','select') as anon_sel,
        (select relrowsecurity from pg_class where oid = 'public.store_template_settings'::regclass) as rls,
        (select count(*)::int = 0 from pg_policies where tablename = 'store_template_settings') as no_policies,
        (select pg_get_functiondef('public.get_public_storefront(text)'::regprocedure) not like '%store_template_settings%') as old_function`)).rows;
      expect(r).toEqual({ sel: false, anon_sel: false, rls: true, no_policies: true, old_function: true });
    } finally {
      await partial.close();
    }
  });
});
