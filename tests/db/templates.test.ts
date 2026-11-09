import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, createDb, createUser, onboard } from "./harness";
import { doc, failure, insertTemplate, publish } from "./template-fixtures";

/** Template engine tables (0012): integrity, status semantics, assignments, roles, RLS, tenant isolation, immutability. */
let db: PGlite;
let owner: string, manager: string, staff: string, ownerB: string;
let tenantA: string, tenantB: string, storeA: string, storeB: string;
let productA1: string, productA2: string, productB1: string, collectionA1: string, collectionB1: string;

const q = <T = Record<string, unknown>>(s: string, p: unknown[] = []) => db.query<T>(s, p).then((r) => r.rows);
const mk = (kind: string, extra: Partial<Parameters<typeof insertTemplate>[1]> = {}) => insertTemplate(db, { tenantId: tenantA, storeId: storeA, kind, ...extra });
const clean = async () => {
  await q("delete from template_assignments");
  await q("update templates set published_version_id = null");
  await q("delete from templates");
};

beforeAll(async () => {
  db = await createDb();
  [owner, manager, staff, ownerB] = await Promise.all(["olivia", "mia", "sam", "bob"].map((n) => createUser(db, `${n}@example.test`)));
  const a = await onboard(db, owner, "alpha-shop");
  const b = await onboard(db, ownerB, "beta-shop");
  [tenantA, storeA, tenantB, storeB] = [a.tenant_id, a.store_id, b.tenant_id, b.store_id];
  await q("insert into memberships (tenant_id, user_id, role) values ($1,$2,'admin'), ($1,$3,'staff')", [tenantA, manager, staff]);
  const prod = async (tenant: string, slug: string) =>
    (await q<{ id: string }>("insert into products (tenant_id, name, slug, price_minor, status) values ($1,$2,$2,100,'active') returning id", [tenant, slug]))[0].id;
  const coll = async (tenant: string, slug: string) =>
    (await q<{ id: string }>("insert into collections (tenant_id, name, slug, status) values ($1,$2,$2,'active') returning id", [tenant, slug]))[0].id;
  [productA1, productA2, productB1] = [await prod(tenantA, "a1"), await prod(tenantA, "a2"), await prod(tenantB, "b1")];
  [collectionA1, collectionB1] = [await coll(tenantA, "ca1"), await coll(tenantB, "cb1")];
});
afterAll(async () => db.close());

describe("schema", () => {
  it("[AC-DB-001] creates three RLS-enabled tables with the agreed policies", async () => {
    const rls = await q<{ relname: string; relrowsecurity: boolean }>(
      "select relname, relrowsecurity from pg_class where oid in ('public.templates'::regclass,'public.template_versions'::regclass,'public.template_assignments'::regclass) order by 1",
    );
    expect(rls).toEqual([
      { relname: "template_assignments", relrowsecurity: true },
      { relname: "template_versions", relrowsecurity: true },
      { relname: "templates", relrowsecurity: true },
    ]);
    const policies = (await q<{ policyname: string }>("select policyname from pg_policies where tablename like 'template%' order by 1")).map((r) => r.policyname);
    expect(policies).toEqual([
      "template_assignments_delete_admins", "template_assignments_insert_admins", "template_assignments_select_members", "template_assignments_update_admins",
      "template_versions_insert_admins", "template_versions_select_members",
      "templates_delete_never_published", "templates_insert_admins", "templates_select_members", "templates_update_admins",
    ]);
    // Immutability: there is no UPDATE or DELETE policy on versions at all.
    expect(policies.filter((p) => p.startsWith("template_versions_"))).toEqual(["template_versions_insert_admins", "template_versions_select_members"]);
  });

  it("[AC-DB-001] [AC-DB-003] grants exactly the intended table and column privileges", async () => {
    const [r] = await q<Record<string, boolean>>(`select
      has_table_privilege('anon','public.templates','select') or has_table_privilege('anon','public.template_versions','select') or has_table_privilege('anon','public.template_assignments','select') as anon_any,
      has_table_privilege('authenticated','public.template_versions','update') as ver_update,
      has_table_privilege('authenticated','public.template_versions','delete') as ver_delete,
      has_table_privilege('authenticated','public.templates','delete') as tpl_delete,
      has_column_privilege('authenticated','public.templates','draft','update') as upd_draft,
      has_column_privilege('authenticated','public.templates','published_version_id','update') as upd_pointer,
      has_column_privilege('authenticated','public.templates','revision','update') as upd_revision,
      has_column_privilege('authenticated','public.templates','kind','update') as upd_kind,
      has_column_privilege('authenticated','public.templates','tenant_id','update') as upd_tenant,
      has_column_privilege('authenticated','public.templates','store_id','update') as upd_store,
      has_column_privilege('authenticated','public.templates','revision','insert') as ins_revision,
      has_column_privilege('authenticated','public.template_versions','version_number','insert') as ins_vernum,
      has_column_privilege('authenticated','public.template_versions','published_by','insert') as ins_by,
      has_column_privilege('authenticated','public.template_assignments','template_kind','insert') as ins_kind,
      has_column_privilege('authenticated','public.template_assignments','product_id','update') as upd_resource`);
    expect(r).toEqual({
      anon_any: false, ver_update: false, ver_delete: false, tpl_delete: true,
      upd_draft: true, upd_pointer: true, upd_revision: false, upd_kind: false, upd_tenant: false, upd_store: false,
      ins_revision: false, ins_vernum: false, ins_by: false, ins_kind: false, upd_resource: false,
    });
  });
});

describe("document and name constraints", () => {
  it("[AC-DB-006] accepts a valid document and rejects malformed ones", async () => {
    await clean();
    await mk("index");
    for (const bad of [[], "text", 5, { layout: "x" }, { schemaVersion: 0 }, { schemaVersion: "1" }, { schemaVersion: 1.5 }]) {
      expect(await failure(mk("index", { draft: bad })), JSON.stringify(bad)).toContain("templates_draft_check");
    }
  });

  it("[AC-DB-006] enforces the 256 KB document size in the database", async () => {
    await clean();
    await mk("product", { draft: doc({ pad: "x".repeat(262_000) }) });
    expect(await failure(mk("product", { draft: doc({ pad: "x".repeat(262_144) }) }))).toContain("templates_draft_check");
    const id = await mk("product");
    expect(await failure(q("update templates set draft = $2::jsonb where id = $1", [id, JSON.stringify(doc({ pad: "x".repeat(262_144) }))]))).toContain("templates_draft_check");
    expect(await failure(publish(db, { tenantId: tenantA, storeId: storeA, templateId: id, document: doc({ pad: "x".repeat(262_144) }) }))).toContain("template_versions_document_check");
  });

  it("[AC-DB-006] [AC-DB-007] rejects unknown kinds, bad names, bad status and bad revision", async () => {
    await clean();
    expect(await failure(mk("page"))).toContain("templates_kind_check");
    expect(await failure(mk("index", { name: "   " }))).toContain("templates_name_check");
    expect(await failure(mk("index", { name: "x".repeat(81) }))).toContain("templates_name_check");
    await mk("index", { name: "x".repeat(80) });
    expect(await failure(mk("index", { status: "published" }))).toContain("templates_status_check");
  });
});

describe("defaults and shared kinds", () => {
  it("[AC-DB-007] allows one default per page kind per store, and defaults must be active page templates", async () => {
    await clean();
    await mk("product", { isDefault: true });
    expect(await failure(mk("product", { isDefault: true }))).toContain("templates_one_default_idx");
    await mk("product");
    await mk("collection", { isDefault: true });
    expect(await failure(mk("theme_settings", { isDefault: true }))).toContain("templates_default_kind_check");
    expect(await failure(mk("product", { isDefault: true, status: "archived" }))).toContain("templates_default_active_check");
    // Another store may have its own default of the same kind.
    await insertTemplate(db, { tenantId: tenantB, storeId: storeB, kind: "product", isDefault: true });
  });

  it("[AC-DB-007] allows one document per shared kind per store", async () => {
    await clean();
    for (const kind of ["theme_settings", "group_header", "group_footer", "group_announcement"]) {
      await mk(kind);
      expect(await failure(mk(kind)), kind).toContain("templates_one_shared_idx");
    }
    await insertTemplate(db, { tenantId: tenantB, storeId: storeB, kind: "theme_settings" });
  });
});

describe("revision and updated_at", () => {
  it("[AC-DB-002] bumps revision exactly when the draft changes, and refreshes updated_at", async () => {
    await clean();
    const id = await mk("product");
    const rev = async () => (await q<{ revision: number }>("select revision from templates where id = $1", [id]))[0].revision;
    expect(await rev()).toBe(1);
    await q("update templates set draft = $2::jsonb where id = $1", [id, JSON.stringify(doc({ order: ["a"] }))]);
    expect(await rev()).toBe(2);
    await q("update templates set name = 'Renamed' where id = $1", [id]);
    expect(await rev()).toBe(2);
    await q("update templates set draft = $2::jsonb where id = $1", [id, JSON.stringify(doc({ order: ["a"] }))]);
    expect(await rev()).toBe(2); // same content, no bump
    await q("update templates set draft = $2::jsonb where id = $1", [id, JSON.stringify(doc({ order: ["b"] }))]);
    expect(await rev()).toBe(3);
    const [t] = await q<{ moved: boolean }>("select updated_at > created_at as moved from templates where id = $1", [id]);
    expect(t.moved).toBe(true);
  });

  it("[AC-DB-002] cannot be set by the app, even directly (column privilege) and optimistic updates detect staleness", async () => {
    await clean();
    const id = await mk("product");
    expect(await failure(asUser(db, owner, () => q("update templates set revision = 99 where id = $1", [id])))).toContain("permission denied");
    const seen = 1;
    const first = await asUser(db, owner, () => db.query("update templates set draft = $2::jsonb where id = $1 and revision = $3 returning revision", [id, JSON.stringify(doc({ order: ["x"] })), seen]));
    expect(first.rows).toEqual([{ revision: 2 }]);
    const stale = await asUser(db, owner, () => db.query("update templates set draft = $2::jsonb where id = $1 and revision = $3 returning revision", [id, JSON.stringify(doc({ order: ["y"] })), seen]));
    expect(stale.rows).toEqual([]); // stale revision: nothing written
    expect((await q<{ draft: { order: string[] } }>("select draft from templates where id = $1", [id]))[0].draft.order).toEqual(["x"]);
  });
});

describe("versions", () => {
  it("[AC-DB-004] numbers versions 1, 2, 3 per template, independently, and records the acting user", async () => {
    await clean();
    const t1 = await mk("product");
    const t2 = await mk("product");
    const nums = async (id: string) => (await q<{ version_number: number }>("select version_number from template_versions where template_id = $1 order by 1", [id])).map((r) => r.version_number);
    await publish(db, { tenantId: tenantA, storeId: storeA, templateId: t1 });
    await publish(db, { tenantId: tenantA, storeId: storeA, templateId: t1 });
    await publish(db, { tenantId: tenantA, storeId: storeA, templateId: t2 });
    await publish(db, { tenantId: tenantA, storeId: storeA, templateId: t1 });
    expect(await nums(t1)).toEqual([1, 2, 3]);
    expect(await nums(t2)).toEqual([1]);
    expect((await q<{ published_by: string | null }>("select published_by from template_versions where template_id = $1 limit 1", [t1]))[0].published_by).toBeNull();

    const byManager = await asUser(db, manager, () =>
      db.query<{ version_number: number; published_by: string }>(
        "insert into template_versions (tenant_id, store_id, template_id, document, source, label) values ($1,$2,$3,$4::jsonb,'publish','v4') returning version_number, published_by",
        [tenantA, storeA, t1, JSON.stringify(doc())],
      ),
    );
    expect(byManager.rows[0]).toEqual({ version_number: 4, published_by: manager });
  });

  it("[AC-DB-004] only rollbacks carry a source version, and it must belong to the same template", async () => {
    await clean();
    const t1 = await mk("product");
    const t2 = await mk("product");
    const v1 = await publish(db, { tenantId: tenantA, storeId: storeA, templateId: t1 });
    const other = await publish(db, { tenantId: tenantA, storeId: storeA, templateId: t2 });
    await publish(db, { tenantId: tenantA, storeId: storeA, templateId: t1, source: "rollback", rolledBackFrom: v1 });
    expect(await failure(publish(db, { tenantId: tenantA, storeId: storeA, templateId: t1, source: "rollback", rolledBackFrom: other }))).toContain("template_versions_rolled_back_from_fk");
    expect(await failure(publish(db, { tenantId: tenantA, storeId: storeA, templateId: t1, source: "rollback" }))).toContain("template_versions_rollback_source_check");
    expect(await failure(publish(db, { tenantId: tenantA, storeId: storeA, templateId: t1, source: "publish", rolledBackFrom: v1 }))).toContain("template_versions_rollback_source_check");
    expect(await failure(publish(db, { tenantId: tenantA, storeId: storeA, templateId: t1, source: "other" }))).toContain("template_versions_source_check");
  });

  it("[AC-DB-005] the published pointer can only name a version of the same template", async () => {
    await clean();
    const t1 = await mk("product");
    const t2 = await mk("product");
    const foreign = await publish(db, { tenantId: tenantA, storeId: storeA, templateId: t2 });
    expect(await failure(q("update templates set published_version_id = $2 where id = $1", [t1, foreign]))).toContain("templates_published_version_fk");
  });

  it("[AC-DB-005] a version cannot point at a template of another tenant or store", async () => {
    await clean();
    const t1 = await mk("product");
    expect(await failure(q("insert into template_versions (tenant_id, store_id, template_id, document, source) values ($1,$2,$3,$4::jsonb,'publish')", [tenantB, storeB, t1, JSON.stringify(doc())]))).toContain("template_versions_template_fk");
  });

  it("[AC-DB-004] label is limited to 80 characters", async () => {
    await clean();
    const t = await mk("product");
    expect(await failure(q("insert into template_versions (tenant_id, store_id, template_id, document, source, label) values ($1,$2,$3,$4::jsonb,'publish',$5)", [tenantA, storeA, t, JSON.stringify(doc()), "x".repeat(81)]))).toContain("template_versions_label_check");
  });
});

describe("immutability (D3, D16)", () => {
  it("[AC-DB-003] no role can update or delete a version, and draft edits never touch history", async () => {
    await clean();
    const t = await mk("product");
    const v = await publish(db, { tenantId: tenantA, storeId: storeA, templateId: t });
    for (const user of [owner, manager, staff]) {
      expect(await failure(asUser(db, user, () => q("update template_versions set label = 'x' where id = $1", [v])))).toContain("permission denied");
      expect(await failure(asUser(db, user, () => q("delete from template_versions where id = $1", [v])))).toContain("permission denied");
    }
    expect((await q("select 1 from template_versions where id = $1", [v])).length).toBe(1);
    await q("update templates set draft = $2::jsonb where id = $1", [t, JSON.stringify(doc({ order: ["z"] }))]);
    expect((await q<{ document: { order: string[] } }>("select document from template_versions where id = $1", [v]))[0].document.order).toEqual([]);
  });

  it("[AC-DB-009] a template that was ever published cannot be deleted by the app (archive it instead)", async () => {
    await clean();
    const published = await mk("product");
    await publish(db, { tenantId: tenantA, storeId: storeA, templateId: published });
    const never = await mk("product");
    const r1 = await asUser(db, owner, () => db.query("delete from templates where id = $1 returning id", [published]));
    expect(r1.rows).toEqual([]);
    const r2 = await asUser(db, owner, () => db.query("delete from templates where id = $1 returning id", [never]));
    expect(r2.rows.length).toBe(1);
  });
});

describe("publication state (D3, D16)", () => {
  const state = async (id: string) => (await q<{ s: string }>("select public.template_publication_state($1) as s", [id]))[0].s;

  it("[AC-DB-019] moves draft > published > published_with_changes > draft (unpublish) and archived, without touching the other axis", async () => {
    await clean();
    const id = await mk("product", { draft: doc({ order: ["a"] }) });
    expect(await state(id)).toBe("draft");
    await publish(db, { tenantId: tenantA, storeId: storeA, templateId: id, document: doc({ order: ["a"] }) });
    expect(await state(id)).toBe("published");
    const revisionBefore = (await q<{ revision: number }>("select revision from templates where id = $1", [id]))[0].revision;
    expect(revisionBefore).toBe(1); // publishing does not change the draft revision

    await q("update templates set draft = $2::jsonb where id = $1", [id, JSON.stringify(doc({ order: ["a", "b"] }))]);
    expect(await state(id)).toBe("published_with_changes");
    // The draft edit did not move the published pointer or change the published document.
    const [p] = await q<{ order: string[]; n: number }>("select v.document -> 'order' as order, v.version_number as n from templates t join template_versions v on v.id = t.published_version_id where t.id = $1", [id]);
    expect(p).toEqual({ order: ["a"], n: 1 });

    await q("update templates set draft = $2::jsonb where id = $1", [id, JSON.stringify(doc({ order: ["a"] }))]);
    expect(await state(id)).toBe("published"); // reverting the edit makes them equal again

    await q("update templates set published_version_id = null where id = $1", [id]);
    expect(await state(id)).toBe("draft"); // unpublish keeps the versions
    expect((await q("select 1 from template_versions where template_id = $1", [id])).length).toBe(1);

    await q("update templates set status = 'archived' where id = $1", [id]);
    expect(await state(id)).toBe("archived");
    expect(await state("00000000-0000-0000-0000-000000000000")).toBeNull();
  });

  it("[AC-DB-004] a rollback publishes an older document and leaves the draft untouched", async () => {
    await clean();
    const id = await mk("product", { draft: doc({ order: ["new"] }) });
    const v1 = await publish(db, { tenantId: tenantA, storeId: storeA, templateId: id, document: doc({ order: ["old"] }) });
    await publish(db, { tenantId: tenantA, storeId: storeA, templateId: id, document: doc({ order: ["new"] }) });
    expect(await state(id)).toBe("published");
    await publish(db, { tenantId: tenantA, storeId: storeA, templateId: id, document: doc({ order: ["old"] }), source: "rollback", rolledBackFrom: v1 });
    expect(await state(id)).toBe("published_with_changes");
    const [t] = await q<{ draft: { order: string[] }; revision: number }>("select draft, revision from templates where id = $1", [id]);
    expect(t).toEqual({ draft: expect.objectContaining({ order: ["new"] }), revision: 1 });
    expect((await q<{ n: number }>("select max(version_number) n from template_versions where template_id = $1", [id]))[0].n).toBe(3);
  });
});

describe("assignments: referential integrity (polymorphic)", () => {
  const assign = (templateId: string, target: { product?: string; collection?: string }, tenant = tenantA, store = storeA) =>
    q("insert into template_assignments (tenant_id, store_id, template_id, product_id, collection_id) values ($1,$2,$3,$4,$5)", [tenant, store, templateId, target.product ?? null, target.collection ?? null]);

  it("[AC-DB-008] links a product to a product template and a collection to a collection template, exactly one resource per row", async () => {
    await clean();
    const pt = await mk("product");
    const ct = await mk("collection");
    await assign(pt, { product: productA1 });
    await assign(ct, { collection: collectionA1 });
    const rows = await q<{ resource_type: string; template_kind: string }>("select resource_type, template_kind from template_assignments order by 1");
    expect(rows).toEqual([{ resource_type: "collection", template_kind: "collection" }, { resource_type: "product", template_kind: "product" }]);
    expect(await failure(assign(pt, { product: productA2, collection: collectionA1 }))).toContain("template_assignments_one_resource_check");
    expect(await failure(assign(pt, {}))).toMatch(/template_assignments_(one_resource|kind_matches_resource)_check/);
  });

  it("[AC-DB-008] rejects a template of the wrong kind", async () => {
    await clean();
    const pt = await mk("product");
    const ct = await mk("collection");
    const idx = await mk("index");
    const theme = await mk("theme_settings");
    expect(await failure(assign(ct, { product: productA1 }))).toContain("template_assignments_kind_matches_resource_check");
    expect(await failure(assign(pt, { collection: collectionA1 }))).toContain("template_assignments_kind_matches_resource_check");
    expect(await failure(assign(idx, { product: productA1 }))).toContain("template_assignments_kind_matches_resource_check");
    expect(await failure(assign(theme, { collection: collectionA1 }))).toContain("template_assignments_kind_matches_resource_check");
  });

  it("[AC-DB-008] [AC-DB-010] enforces tenant and store ownership of the resource and the template", async () => {
    await clean();
    const pt = await mk("product");
    const ptB = await insertTemplate(db, { tenantId: tenantB, storeId: storeB, kind: "product" });
    // another tenant's product or collection
    expect(await failure(assign(pt, { product: productB1 }))).toContain("template_assignments_product_fk");
    expect(await failure(assign(await mk("collection"), { collection: collectionB1 }))).toContain("template_assignments_collection_fk");
    // another tenant's template
    expect(await failure(assign(ptB, { product: productA1 }))).toContain("template does not belong to this store");
    // claiming another tenant's ids for the store
    expect(await failure(assign(pt, { product: productA1 }, tenantB, storeB))).toContain("template does not belong to this store");
    // a second store of the same tenant: its template cannot be used for this store
    const [s2] = await q<{ id: string }>("insert into stores (tenant_id, name, slug) values ($1,'Second','second-store') returning id", [tenantA]);
    const ptS2 = await insertTemplate(db, { tenantId: tenantA, storeId: s2.id, kind: "product" });
    expect(await failure(assign(ptS2, { product: productA1 }))).toContain("template does not belong to this store");
    await assign(ptS2, { product: productA1 }, tenantA, s2.id); // but the same product may use it in that store
    expect((await q("select 1 from template_assignments")).length).toBe(1);
  });

  it("[AC-DB-008] allows one assignment per resource per store, and reassigning keeps the kind rule", async () => {
    await clean();
    const p1 = await mk("product");
    const p2 = await mk("product");
    const c1 = await mk("collection");
    await assign(p1, { product: productA1 });
    expect(await failure(assign(p2, { product: productA1 }))).toContain("template_assignments_store_product_key");
    await q("update template_assignments set template_id = $1 where product_id = $2", [p2, productA1]);
    expect((await q<{ template_id: string }>("select template_id from template_assignments where product_id = $1", [productA1]))[0].template_id).toBe(p2);
    expect(await failure(q("update template_assignments set template_id = $1 where product_id = $2", [c1, productA1]))).toContain("template_assignments_kind_matches_resource_check");
  });

  it("[AC-DB-008] deleting a product or collection deletes its assignment", async () => {
    await clean();
    const [extraProduct] = await q<{ id: string }>("insert into products (tenant_id, name, slug, price_minor, status) values ($1,'tmp','tmp',1,'active') returning id", [tenantA]);
    const [extraCollection] = await q<{ id: string }>("insert into collections (tenant_id, name, slug, status) values ($1,'tmp','tmp','active') returning id", [tenantA]);
    await assign(await mk("product"), { product: extraProduct.id });
    await assign(await mk("collection"), { collection: extraCollection.id });
    await q("delete from products where id = $1", [extraProduct.id]);
    await q("delete from collections where id = $1", [extraCollection.id]);
    expect((await q("select 1 from template_assignments")).length).toBe(0);
  });

  it("[AC-DB-009] deleting a template is blocked while it has assignments; archiving keeps them", async () => {
    await clean();
    const pt = await mk("product");
    await assign(pt, { product: productA1 });
    expect(await failure(q("delete from templates where id = $1", [pt]))).toContain("template_assignments_template_fk");
    await q("update templates set status = 'archived' where id = $1", [pt]);
    expect((await q("select 1 from template_assignments where template_id = $1", [pt])).length).toBe(1);
    await q("update templates set status = 'active' where id = $1", [pt]);
    expect((await q("select 1 from template_assignments where template_id = $1", [pt])).length).toBe(1);
    await q("delete from template_assignments where template_id = $1", [pt]);
    await q("delete from templates where id = $1", [pt]);
  });

  it("[AC-DB-008] a template's kind cannot change while assignments depend on it", async () => {
    await clean();
    const pt = await mk("product");
    await assign(pt, { product: productA1 });
    expect(await failure(q("update templates set kind = 'collection' where id = $1", [pt]))).toContain("template_assignments_template_fk");
  });

  it("[AC-DB-001] deleting a store removes its templates, versions and assignments in one statement", async () => {
    const owner3 = await createUser(db, "gamma@example.test");
    const g = await onboard(db, owner3, "gamma-shop");
    const [pr] = await q<{ id: string }>("insert into products (tenant_id, name, slug, price_minor, status) values ($1,'gamma-prod','gamma-prod',1,'active') returning id", [g.tenant_id]);
    const t = await insertTemplate(db, { tenantId: g.tenant_id, storeId: g.store_id, kind: "product" });
    await publish(db, { tenantId: g.tenant_id, storeId: g.store_id, templateId: t });
    await q("insert into template_assignments (tenant_id, store_id, template_id, product_id) values ($1,$2,$3,$4)", [g.tenant_id, g.store_id, t, pr.id]);
    await q("delete from stores where id = $1", [g.store_id]);
    for (const table of ["templates", "template_versions", "template_assignments"]) {
      expect((await q(`select 1 from ${table} where store_id = $1`, [g.store_id])).length, table).toBe(0);
    }
  });
});

describe("roles and RLS", () => {
  const insertAs = (user: string, tenant: string, store: string, kind = "product") =>
    asUser(db, user, () =>
      db.query("insert into templates (tenant_id, store_id, kind, name, draft) values ($1,$2,$3,'T',$4::jsonb) returning id", [tenant, store, kind, JSON.stringify(doc())]),
    );

  it("[AC-DB-013] Owner and Manager can create, edit, assign and publish; Staff can only read", async () => {
    await clean();
    for (const user of [owner, manager]) {
      const t = (await insertAs(user, tenantA, storeA)).rows[0] as { id: string };
      const upd = await asUser(db, user, () => db.query("update templates set name = 'N', draft = $2::jsonb where id = $1 returning revision", [t.id, JSON.stringify(doc({ order: ["q"] }))]));
      expect(upd.rows).toEqual([{ revision: 2 }]);
      await asUser(db, user, () => db.query("insert into template_versions (tenant_id, store_id, template_id, document, source) values ($1,$2,$3,$4::jsonb,'publish')", [tenantA, storeA, t.id, JSON.stringify(doc())]));
      await asUser(db, user, () => db.query("insert into template_assignments (tenant_id, store_id, template_id, product_id) values ($1,$2,$3,$4)", [tenantA, storeA, t.id, user === owner ? productA1 : productA2]));
    }
    const seen = await asUser(db, staff, () => db.query("select id from templates"));
    expect(seen.rows.length).toBe(2);
    expect((await asUser(db, staff, () => db.query("select 1 from template_versions"))).rows.length).toBe(2);
    expect((await asUser(db, staff, () => db.query("select 1 from template_assignments"))).rows.length).toBe(2);
  });

  it("[AC-DB-013] Staff cannot insert, update, delete, publish or assign", async () => {
    await clean();
    const t = await mk("product");
    const v = await publish(db, { tenantId: tenantA, storeId: storeA, templateId: t });
    expect(await failure(insertAs(staff, tenantA, storeA))).toContain("row-level security");
    expect((await asUser(db, staff, () => db.query("update templates set name = 'x' where id = $1 returning id", [t]))).rows).toEqual([]);
    expect((await asUser(db, staff, () => db.query("update templates set published_version_id = null where id = $1 returning id", [t]))).rows).toEqual([]);
    expect((await asUser(db, staff, () => db.query("delete from templates where id = $1 returning id", [t]))).rows).toEqual([]);
    expect(await failure(asUser(db, staff, () => q("insert into template_versions (tenant_id, store_id, template_id, document, source) values ($1,$2,$3,$4::jsonb,'publish')", [tenantA, storeA, t, JSON.stringify(doc())])))).toContain("row-level security");
    expect(await failure(asUser(db, staff, () => q("insert into template_assignments (tenant_id, store_id, template_id, product_id) values ($1,$2,$3,$4)", [tenantA, storeA, t, productA1])))).toContain("row-level security");
    expect(v).toBeTruthy();
  });

  it("[AC-DB-013] anonymous callers have no table access", async () => {
    await clean();
    await mk("product");
    for (const table of ["templates", "template_versions", "template_assignments"]) {
      expect(await failure(asUser(db, null, () => q(`select * from ${table}`))), table).toContain("permission denied");
    }
  });

  it("[AC-DB-010] another tenant's Owner cannot read, write, publish or assign across tenants", async () => {
    await clean();
    const t = await mk("product");
    const v = await publish(db, { tenantId: tenantA, storeId: storeA, templateId: t });
    await q("insert into template_assignments (tenant_id, store_id, template_id, product_id) values ($1,$2,$3,$4)", [tenantA, storeA, t, productA1]);

    for (const table of ["templates", "template_versions", "template_assignments"]) {
      expect((await asUser(db, ownerB, () => db.query(`select 1 from ${table}`))).rows.length, table).toBe(0);
    }
    expect((await asUser(db, ownerB, () => db.query("update templates set name = 'hijack' where id = $1 returning id", [t]))).rows).toEqual([]);
    expect((await asUser(db, ownerB, () => db.query("delete from templates where id = $1 returning id", [t]))).rows).toEqual([]);
    expect((await asUser(db, ownerB, () => db.query("delete from template_assignments returning id"))).rows).toEqual([]);
    // writing rows that claim tenant A, or tenant B's id with store A
    expect(await failure(insertAs(ownerB, tenantA, storeA))).toContain("row-level security");
    expect(await failure(insertAs(ownerB, tenantB, storeA))).toMatch(/row-level security|templates_store_fk/);
    expect(await failure(asUser(db, ownerB, () => q("insert into template_versions (tenant_id, store_id, template_id, document, source) values ($1,$2,$3,$4::jsonb,'publish')", [tenantA, storeA, t, JSON.stringify(doc())])))).toContain("row-level security");
    expect(await failure(asUser(db, ownerB, () => q("insert into template_versions (tenant_id, store_id, template_id, document, source) values ($1,$2,$3,$4::jsonb,'publish')", [tenantB, storeB, t, JSON.stringify(doc())])))).toMatch(/row-level security|template_versions_template_fk/);
    expect(await failure(asUser(db, ownerB, () => q("insert into template_assignments (tenant_id, store_id, template_id, product_id) values ($1,$2,$3,$4)", [tenantB, storeB, t, productB1])))).toContain("template does not belong to this store");
    expect(v).toBeTruthy();
  });

  it("[AC-DB-013] identity columns cannot be changed by the app", async () => {
    await clean();
    const t = await mk("product");
    for (const col of ["tenant_id", "store_id", "kind"]) {
      expect(await failure(asUser(db, owner, () => q(`update templates set ${col} = ${col} where id = $1`, [t]))), col).toContain("permission denied");
    }
    expect(await failure(asUser(db, owner, () => q("update templates set created_at = now() where id = $1", [t])))).toContain("permission denied");
  });

  it("[AC-DB-013] a disabled membership or a suspended company loses write access", async () => {
    await clean();
    await q("update memberships set status = 'disabled' where user_id = $1", [manager]);
    expect(await failure(insertAs(manager, tenantA, storeA))).toContain("row-level security");
    await q("update memberships set status = 'active' where user_id = $1", [manager]);
  });
});
