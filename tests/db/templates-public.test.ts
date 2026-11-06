/* eslint-disable @typescript-eslint/no-explicit-any -- the public functions return untyped JSON that the tests navigate */
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, createPlatformAdmin, createUser, provision } from "./harness";
import { doc, failure, insertTemplate, publish } from "./template-fixtures";

/** The four public read functions (0014): active-only, tenant-isolated, published-only, no internal fields. */
let db: PGlite;
let tenantA: string, storeA: string, tenantB: string, storeB: string;
const ids: Record<string, string> = {};

const q = <T = Record<string, unknown>>(s: string, p: unknown[] = []) => db.query<T>(s, p).then((r) => r.rows);
/** Same shape as the app: request role, no identity. */
async function call<T = unknown>(sql: string, params: unknown[]): Promise<T | null> {
  await db.exec("begin; set local role authenticated");
  try {
    return ((await db.query<{ r: T | null }>(`select ${sql} as r`, params)).rows[0].r) ?? null;
  } finally {
    await db.exec("rollback");
  }
}
const collections = (slug: string) => call<Array<Record<string, unknown>>>("public.get_public_collections($1)", [slug]);
const collection = (slug: string, c: string) => call<Record<string, any>>("public.get_public_collection($1,$2)", [slug, c]);
const product = (slug: string, p: string) => call<Record<string, any>>("public.get_public_product($1,$2)", [slug, p]);
const layout = (slug: string, kind: string, resource?: string) => call<Record<string, any>>("public.get_public_template_layout($1,$2,$3)", [slug, kind, resource ?? null]);

const prod = async (tenant: string, slug: string, extra: { status?: string; category?: string | null; price?: number } = {}) =>
  (await q<{ id: string }>("insert into products (tenant_id, name, slug, price_minor, status, category_id, sku, cost_minor, quantity) values ($1,$2,$2,$3,$4,$5,'SKU-' || $2, 7654321, 9) returning id", [tenant, slug, extra.price ?? 1000, extra.status ?? "active", extra.category ?? null]))[0].id;
const coll = async (tenant: string, slug: string, status = "active") =>
  (await q<{ id: string }>("insert into collections (tenant_id, name, slug, status, description) values ($1,$2,$2,$3,'about ' || $2) returning id", [tenant, slug, status]))[0].id;
const link = (tenant: string, c: string, p: string, position = 0) => q("insert into collection_products (tenant_id, collection_id, product_id, position) values ($1,$2,$3,$4)", [tenant, c, p, position]);

beforeAll(async () => {
  db = await createDb();
  const admin = await createPlatformAdmin(db);
  const [a, b] = await Promise.all([createUser(db, "a@example.test"), createUser(db, "b@example.test")]);
  const pa = await provision(db, admin, a, "urban-nest");
  const pb = await provision(db, admin, b, "other-shop");
  [tenantA, storeA, tenantB, storeB] = [pa.tenant_id, pa.store_id, pb.tenant_id, pb.store_id];

  const [catShoes] = await q<{ id: string }>("insert into categories (tenant_id, name, slug) values ($1,'Shoes','shoes') returning id", [tenantA]);
  const [catHats] = await q<{ id: string }>("insert into categories (tenant_id, name, slug) values ($1,'Hats','hats') returning id", [tenantA]);

  ids.lamp = await prod(tenantA, "lamp", { category: catShoes.id, price: 129900 });
  ids.sameCat = await prod(tenantA, "same-category", { category: catShoes.id });
  ids.sameColl = await prod(tenantA, "same-collection");
  ids.otherCat = await prod(tenantA, "other-category", { category: catHats.id });
  ids.draftSameCat = await prod(tenantA, "draft-same-category", { category: catShoes.id, status: "draft" });
  ids.draftOnlyColl = await prod(tenantA, "only-in-draft-collection");
  ids.unrelated = await prod(tenantA, "unrelated");
  ids.bProduct = await prod(tenantB, "b-product");

  ids.cActive = await coll(tenantA, "summer");
  ids.cActive2 = await coll(tenantA, "autumn");
  ids.cDraft = await coll(tenantA, "secret-collection", "draft");
  ids.cB = await coll(tenantB, "b-collection");
  await link(tenantA, ids.cActive, ids.lamp, 1);
  await link(tenantA, ids.cActive, ids.sameColl, 0);
  await link(tenantA, ids.cActive, ids.draftSameCat, 2);
  await link(tenantA, ids.cDraft, ids.lamp);
  await link(tenantA, ids.cDraft, ids.draftOnlyColl);
  await link(tenantA, ids.cActive2, ids.lamp);
  await link(tenantB, ids.cB, ids.bProduct);

  await q("insert into product_options (tenant_id, product_id, name, position, values) values ($1,$2,'Size',0,array['S','M'])", [tenantA, ids.lamp]);
  const [img1] = await q<{ id: string }>("insert into product_images (tenant_id, product_id, storage_path, alt_text, mime_type, size_bytes, position, is_primary) values ($1,$2,$3,'Main','image/png',10,1,true) returning id", [tenantA, ids.lamp, `${tenantA}/${ids.lamp}/a.png`]);
  await q("insert into product_images (tenant_id, product_id, storage_path, mime_type, size_bytes, position) values ($1,$2,$3,'image/png',10,0)", [tenantA, ids.lamp, `${tenantA}/${ids.lamp}/b.png`]);
  ids.img1 = img1.id;
  await q("insert into product_variants (tenant_id, product_id, title, options, sku, price_minor, quantity, image_id, position) values ($1,$2,'S','{\"Size\":\"S\"}','V-S',1000,5,$3,0)", [tenantA, ids.lamp, ids.img1]);
  await q("insert into product_variants (tenant_id, product_id, title, options, sku, price_minor, quantity, is_active, position) values ($1,$2,'M','{\"Size\":\"M\"}','V-M',2000,0,false,1)", [tenantA, ids.lamp]);
});
afterAll(async () => db.close());

describe("access", () => {
  it("is executable by authenticated only, never by anon or public", async () => {
    for (const fn of ["get_public_collections(text)", "get_public_collection(text,text)", "get_public_product(text,text)", "get_public_template_layout(text,text,text)"]) {
      const [r] = await q<{ anon: boolean; auth: boolean }>(`select has_function_privilege('anon','public.${fn}','execute') as anon, has_function_privilege('authenticated','public.${fn}','execute') as auth`);
      expect(r, fn).toEqual({ anon: false, auth: true });
    }
    await db.exec("begin; set local role anon");
    try {
      expect(await failure(db.query("select public.get_public_collections('urban-nest')"))).toContain("permission denied");
    } finally {
      await db.exec("rollback");
    }
  });

  it("returns null for unknown, invalid, inactive and suspended stores, identically", async () => {
    for (const slug of ["no-such-shop", "BAD SLUG", "x"]) {
      expect(await collections(slug), slug).toBeNull();
      expect(await collection(slug, "summer")).toBeNull();
      expect(await product(slug, "lamp")).toBeNull();
      expect(await layout(slug, "index")).toBeNull();
    }
    await q("update stores set status = 'inactive' where id = $1", [storeB]);
    expect(await collections("other-shop")).toBeNull();
    await q("update stores set status = 'active' where id = $1", [storeB]);
    await q("update tenants set status = 'suspended' where id = $1", [tenantB]);
    expect(await product("other-shop", "b-product")).toBeNull();
    expect(await layout("other-shop", "index")).toBeNull();
    await q("update tenants set status = 'active' where id = $1", [tenantB]);
    expect(await product("other-shop", "b-product")).not.toBeNull();
  });
});

describe("get_public_collections()", () => {
  it("returns only active collections of that store, with the agreed fields and an active-only product count", async () => {
    const list = (await collections("urban-nest"))!;
    expect(list.map((c) => c.slug)).toEqual(["autumn", "summer"]);
    const summer = list.find((c) => c.slug === "summer")!;
    expect(Object.keys(summer).sort()).toEqual(["description", "id", "image_path", "name", "product_count", "slug"]);
    expect(summer).toMatchObject({ id: ids.cActive, name: "summer", description: "about summer", image_path: null, product_count: 2 }); // draft product excluded
    expect(list.find((c) => c.slug === "autumn")!.product_count).toBe(1);
    expect(JSON.stringify(list)).not.toContain(tenantA);
  });

  it("never mixes tenants and returns [] for a store without collections", async () => {
    expect((await collections("other-shop"))!.map((c) => c.slug)).toEqual(["b-collection"]);
    const owner = await createUser(db, "empty@example.test");
    await provision(db, await createPlatformAdmin(db), owner, "empty-shop");
    expect(await collections("empty-shop")).toEqual([]);
  });

  it("stops listing a collection when it is set to draft", async () => {
    await q("update collections set status = 'draft' where id = $1", [ids.cActive2]);
    expect((await collections("urban-nest"))!.map((c) => c.slug)).toEqual(["summer"]);
    await q("update collections set status = 'active' where id = $1", [ids.cActive2]);
  });
});

describe("get_public_collection()", () => {
  it("returns an active collection with its active products in the collection's order", async () => {
    const r = (await collection("urban-nest", "summer"))!;
    expect(r.store).toMatchObject({ name: "urban-nest Store", slug: "urban-nest", currency: "INR" });
    expect(r.collection).toMatchObject({ id: ids.cActive, name: "summer", slug: "summer" });
    expect(r.products.map((p: { slug: string }) => p.slug)).toEqual(["same-collection", "lamp"]); // position 0, 1; the draft product is excluded
    expect(Object.keys(r.products[0]).sort()).toEqual(["compare_at_price_minor", "created_at", "image_path", "name", "position", "price_minor", "short_description", "slug"]);
  });

  it("is null for draft collections, unknown slugs and another tenant's collection", async () => {
    expect(await collection("urban-nest", "secret-collection")).toBeNull();
    expect(await collection("urban-nest", "nope")).toBeNull();
    expect(await collection("urban-nest", "b-collection")).toBeNull();
    expect(await collection("other-shop", "summer")).toBeNull();
  });

  it("exposes no costs, stock, tenant or store ids", async () => {
    const text = JSON.stringify(await collection("urban-nest", "summer"));
    // Image paths embed the tenant id by design (as in get_public_storefront), so check fields and the other tenant instead.
    for (const secret of ["tenant_id", "store_id", storeA, tenantB, "cost_minor", "quantity", "SKU-"]) expect(text).not.toContain(secret);
  });
});

describe("get_public_product()", () => {
  it("returns an active product with images, options, active variants and the category name", async () => {
    const r = (await product("urban-nest", "lamp"))!;
    expect(r.product).toMatchObject({ name: "lamp", slug: "lamp", price_minor: 129900, sku: "SKU-lamp", category_name: "Shoes", has_variants: false });
    expect(r.images.map((i: { path: string }) => i.path.split("/").pop())).toEqual(["a.png", "b.png"]); // primary first
    expect(r.images[0]).toMatchObject({ id: ids.img1, alt: "Main", is_primary: true });
    expect(r.options).toEqual([{ name: "Size", values: ["S", "M"] }]);
    expect(r.variants.map((v: { title: string }) => v.title)).toEqual(["S"]); // the inactive variant is hidden
    expect(r.variants[0]).toMatchObject({ options: { Size: "S" }, sku: "V-S", price_minor: 1000, image_id: ids.img1 });
    expect(Object.keys(r.variants[0]).sort()).toEqual(["compare_at_price_minor", "id", "image_id", "options", "price_minor", "sku", "title"]);
  });

  it("is null for draft products, unknown slugs and another tenant's product", async () => {
    expect(await product("urban-nest", "draft-same-category")).toBeNull();
    expect(await product("urban-nest", "nope")).toBeNull();
    expect(await product("urban-nest", "b-product")).toBeNull();
  });

  it("exposes no costs, stock, tenant or store ids", async () => {
    const text = JSON.stringify(await product("urban-nest", "lamp"));
    for (const secret of ["tenant_id", "store_id", storeA, tenantB, "cost_minor", "quantity", "7654321"]) expect(text).not.toContain(secret);
  });

  it("related products are active products with the same category or a shared active collection, never itself", async () => {
    const r = (await product("urban-nest", "lamp"))!;
    const slugs = r.related.map((p: { slug: string }) => p.slug).sort();
    expect(slugs).toEqual(["same-category", "same-collection"]);
    // draft products, products only linked through a draft collection, other categories and other tenants are excluded
    for (const excluded of ["lamp", "draft-same-category", "only-in-draft-collection", "other-category", "unrelated", "b-product"]) expect(slugs).not.toContain(excluded);
  });

  it("related is [] for a product with no category and no collection", async () => {
    expect((await product("urban-nest", "unrelated"))!.related).toEqual([]);
  });

  it("limits related products to 8", async () => {
    const [cat] = await q<{ id: string }>("insert into categories (tenant_id, name, slug) values ($1,'Bulk','bulk') returning id", [tenantA]);
    const anchor = await prod(tenantA, "bulk-anchor", { category: cat.id });
    for (let i = 0; i < 10; i++) await prod(tenantA, `bulk-${i}`, { category: cat.id });
    expect((await product("urban-nest", "bulk-anchor"))!.related.length).toBe(8);
    expect(anchor).toBeTruthy();
  });
});

describe("get_public_template_layout()", () => {
  const MARK = "DRAFT-ONLY-MARKER";
  const published = (extra: Record<string, unknown> = {}) => doc({ order: ["pub"], ...extra });
  async function reset() {
    await q("delete from template_assignments");
    await q("update templates set published_version_id = null");
    await q("delete from templates");
  }

  it("returns nothing when no template is published, so the app falls back to the registry default", async () => {
    await reset();
    expect(await layout("urban-nest", "index")).toEqual({ source: null, template: null, theme: null, groups: { header: null, footer: null, announcement: null } });
    await insertTemplate(db, { tenantId: tenantA, storeId: storeA, kind: "index", isDefault: true, draft: doc({ marker: MARK }) }); // never published
    const r = await layout("urban-nest", "index");
    expect(r!.template).toBeNull();
    expect(JSON.stringify(r)).not.toContain(MARK);
  });

  it("returns the PUBLISHED document of the default template and never the draft", async () => {
    await reset();
    const t = await insertTemplate(db, { tenantId: tenantA, storeId: storeA, kind: "index", isDefault: true, name: "Home", draft: doc({ marker: MARK }) });
    await publish(db, { tenantId: tenantA, storeId: storeA, templateId: t, document: published() });
    await q("update templates set draft = $2::jsonb where id = $1", [t, JSON.stringify(doc({ marker: MARK, newer: true }))]);
    const r = (await layout("urban-nest", "index"))!;
    expect(r.source).toBe("default");
    expect(r.template).toEqual({ name: "Home", version_number: 1, document: published() });
    expect(JSON.stringify(r)).not.toContain(MARK);
    // publishing again shows the new document immediately
    await publish(db, { tenantId: tenantA, storeId: storeA, templateId: t, document: published({ v: 2 }) });
    expect((await layout("urban-nest", "index"))!.template).toMatchObject({ version_number: 2, document: published({ v: 2 }) });
  });

  it("follows the fallback chain: assigned, then default, each only when active and published", async () => {
    await reset();
    const def = await insertTemplate(db, { tenantId: tenantA, storeId: storeA, kind: "product", isDefault: true, name: "Default" });
    const special = await insertTemplate(db, { tenantId: tenantA, storeId: storeA, kind: "product", name: "Special" });
    await publish(db, { tenantId: tenantA, storeId: storeA, templateId: def, document: published({ who: "default" }) });
    await q("insert into template_assignments (tenant_id, store_id, template_id, product_id) values ($1,$2,$3,$4)", [tenantA, storeA, special, ids.lamp]);

    // assigned but not yet published: falls through to the default
    expect((await layout("urban-nest", "product", "lamp"))).toMatchObject({ source: "default", template: { name: "Default" } });
    await publish(db, { tenantId: tenantA, storeId: storeA, templateId: special, document: published({ who: "special" }) });
    expect(await layout("urban-nest", "product", "lamp")).toMatchObject({ source: "assigned", template: { name: "Special", document: published({ who: "special" }) } });
    // other products are not affected by the assignment
    expect(await layout("urban-nest", "product", "same-category")).toMatchObject({ source: "default", template: { name: "Default" } });
    // an unknown resource slug just means no assignment
    expect(await layout("urban-nest", "product", "no-such-product")).toMatchObject({ source: "default" });
    expect(await layout("urban-nest", "product")).toMatchObject({ source: "default" });
    // archived: the assignment is kept but ignored
    await q("update templates set status = 'archived' where id = $1", [special]);
    expect(await layout("urban-nest", "product", "lamp")).toMatchObject({ source: "default", template: { name: "Default" } });
    expect((await q("select 1 from template_assignments where template_id = $1", [special])).length).toBe(1);
    await q("update templates set status = 'active' where id = $1", [special]);
    expect(await layout("urban-nest", "product", "lamp")).toMatchObject({ source: "assigned" });
    // unpublished default and unpublished assignment: nothing, so the registry default applies
    await q("update templates set published_version_id = null where id in ($1, $2)", [def, special]);
    expect(await layout("urban-nest", "product", "lamp")).toMatchObject({ source: null, template: null });
  });

  it("applies collection assignments to collections only", async () => {
    await reset();
    const cDefault = await insertTemplate(db, { tenantId: tenantA, storeId: storeA, kind: "collection", isDefault: true, name: "C-Default" });
    const cSale = await insertTemplate(db, { tenantId: tenantA, storeId: storeA, kind: "collection", name: "Sale" });
    await publish(db, { tenantId: tenantA, storeId: storeA, templateId: cDefault });
    await publish(db, { tenantId: tenantA, storeId: storeA, templateId: cSale });
    await q("insert into template_assignments (tenant_id, store_id, template_id, collection_id) values ($1,$2,$3,$4)", [tenantA, storeA, cSale, ids.cActive]);
    expect(await layout("urban-nest", "collection", "summer")).toMatchObject({ source: "assigned", template: { name: "Sale" } });
    expect(await layout("urban-nest", "collection", "autumn")).toMatchObject({ source: "default", template: { name: "C-Default" } });
    expect(await layout("urban-nest", "collection", "secret-collection")).toMatchObject({ source: "default" }); // draft collection: no assignment lookup
    expect(await layout("urban-nest", "product", "summer")).toMatchObject({ source: null }); // a collection slug is not a product
  });

  it("returns the published theme and groups, each published independently, never their drafts", async () => {
    await reset();
    const theme = await insertTemplate(db, { tenantId: tenantA, storeId: storeA, kind: "theme_settings", draft: doc({ marker: MARK }) });
    const header = await insertTemplate(db, { tenantId: tenantA, storeId: storeA, kind: "group_header", draft: doc({ marker: MARK }) });
    await insertTemplate(db, { tenantId: tenantA, storeId: storeA, kind: "group_footer", draft: doc({ marker: MARK }) }); // never published
    await publish(db, { tenantId: tenantA, storeId: storeA, templateId: theme, document: doc({ part: "theme" }) });
    await publish(db, { tenantId: tenantA, storeId: storeA, templateId: header, document: doc({ part: "header" }) });
    const r = (await layout("urban-nest", "index"))!;
    expect(r.theme).toEqual(doc({ part: "theme" }));
    expect(r.groups).toEqual({ header: doc({ part: "header" }), footer: null, announcement: null });
    expect(JSON.stringify(r)).not.toContain(MARK);
    // the same shared documents apply to every page kind
    for (const [kind, resource] of [["product", "lamp"], ["collection", "summer"]] as const) {
      expect((await layout("urban-nest", kind, resource))!.groups.header).toEqual(doc({ part: "header" }));
    }
    // archiving a group hides it
    await q("update templates set status = 'archived' where id = $1", [header]);
    expect((await layout("urban-nest", "index"))!.groups.header).toBeNull();
  });

  it("never returns another tenant's templates, theme or groups", async () => {
    await reset();
    const tB = await insertTemplate(db, { tenantId: tenantB, storeId: storeB, kind: "index", isDefault: true, name: "B-Home" });
    const themeB = await insertTemplate(db, { tenantId: tenantB, storeId: storeB, kind: "theme_settings" });
    await publish(db, { tenantId: tenantB, storeId: storeB, templateId: tB, document: doc({ owner: "B" }) });
    await publish(db, { tenantId: tenantB, storeId: storeB, templateId: themeB, document: doc({ owner: "B" }) });
    expect(await layout("urban-nest", "index")).toMatchObject({ source: null, template: null, theme: null });
    expect(await layout("other-shop", "index")).toMatchObject({ source: "default", template: { name: "B-Home" }, theme: doc({ owner: "B" }) });
    const text = JSON.stringify(await layout("other-shop", "index"));
    for (const secret of [tenantA, tenantB, storeA, storeB]) expect(text).not.toContain(secret);
  });

  it("rejects unknown kinds and exposes no internal ids", async () => {
    expect(await layout("urban-nest", "page")).toBeNull();
    expect(await layout("urban-nest", "theme_settings")).toBeNull();
    expect(await layout("urban-nest", "")).toBeNull();
    await reset();
    const t = await insertTemplate(db, { tenantId: tenantA, storeId: storeA, kind: "index", isDefault: true });
    await publish(db, { tenantId: tenantA, storeId: storeA, templateId: t });
    const text = JSON.stringify(await layout("urban-nest", "index"));
    for (const secret of [t, tenantA, storeA, "published_by", "draft"]) expect(text).not.toContain(secret);
  });
});

describe("get_public_storefront() is unchanged", () => {
  it("still returns the V1 payload and ignores the new tables", async () => {
    const s = (await call<Record<string, unknown>>("public.get_public_storefront($1)", ["urban-nest"]))!;
    expect(Object.keys(s).sort()).toEqual(["currency", "description", "logo_path", "name", "products", "slug", "template"]);
    expect(s.template).toBeNull();
    expect(JSON.stringify(s)).not.toContain("SKU-"); // SKUs stay out of the homepage payload
  });
});
