import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, createPlatformAdmin, createUser, provision } from "./harness";

/** The public storefront reads through ONE definer function; anonymous visitors get no table access. */
let db: PGlite;
let admin: string;
let tenantA: string;
let tenantB: string;

const q = <T = Record<string, unknown>>(s: string, p: unknown[] = []) => db.query<T>(s, p).then((r) => r.rows);
/** Same shape as the app: request role, no identity. */
async function storefront(slug: string) {
  await db.exec("begin; set local role authenticated");
  try {
    const [row] = (await db.query<{ s: Record<string, unknown> | null }>("select public.get_public_storefront($1) s", [slug])).rows;
    return row.s;
  } finally {
    await db.exec("rollback");
  }
}

beforeAll(async () => {
  db = await createDb();
  admin = await createPlatformAdmin(db);
  const a = await createUser(db, "a@example.test");
  const b = await createUser(db, "b@example.test");
  tenantA = (await provision(db, admin, a, "urban-nest", { store: "Urban Nest" })).tenant_id;
  tenantB = (await provision(db, admin, b, "other-shop")).tenant_id;
  await q("update stores set description = 'Home goods', currency = 'INR' where tenant_id = $1", [tenantA]);
  const [live] = await q<{ id: string }>(
    "insert into products (tenant_id, name, slug, price_minor, compare_at_price_minor, status, cost_minor, sku, quantity, short_description) values ($1,'Lamp','lamp',129900,159900,'active',50000,'SECRET-SKU',7,'Warm light') returning id",
    [tenantA],
  );
  await q("insert into products (tenant_id, name, slug, price_minor, status) values ($1,'Secret draft','draft','100','draft')", [tenantA]);
  await q("insert into products (tenant_id, name, slug, price_minor, status) values ($1,'Other tenant item','other','100','active')", [tenantB]);
  await q(
    "insert into product_images (tenant_id, product_id, storage_path, mime_type, size_bytes, position, is_primary) values ($1,$2,$3,'image/png',10,0,true)",
    [tenantA, live.id, `${tenantA}/${live.id}/a.png`],
  );
});
afterAll(async () => db.close());

describe("get_public_storefront()", () => {
  it("returns public store fields and only ACTIVE products of that store", async () => {
    const s = await storefront("urban-nest");
    expect(s).toMatchObject({ name: "Urban Nest", slug: "urban-nest", description: "Home goods", currency: "INR", logo_path: null });
    const products = s!.products as Array<Record<string, unknown>>;
    expect(products.map((p) => p.slug)).toEqual(["lamp"]);
    expect(products[0]).toMatchObject({ name: "Lamp", price_minor: 129900, compare_at_price_minor: 159900, short_description: "Warm light" });
    expect(String(products[0].image_path)).toMatch(new RegExp(`^${tenantA}/`));
  });

  it("never exposes costs, SKUs, stock, ids or tenant data", async () => {
    const json = JSON.stringify(await storefront("urban-nest"));
    for (const secret of ["SECRET-SKU", "cost_minor", "50000", "quantity", "tenant_id", tenantB, "Secret draft", "Other tenant item"]) {
      expect(json, secret).not.toContain(secret);
    }
    const keys = Object.keys((await storefront("urban-nest"))!.products ? ((await storefront("urban-nest"))!.products as object[])[0] : {});
    expect(keys.sort()).toEqual(["compare_at_price_minor", "created_at", "image_path", "name", "price_minor", "short_description", "slug"]);
  });

  it("returns null for unknown, reserved, malformed and injection-style slugs", async () => {
    for (const slug of ["nope-shop", "admin", "www", "Urban-Nest", "x", "a'; drop table stores;--", "", "urban nest"]) {
      expect(await storefront(slug), slug).toBeNull();
    }
  });

  it("a suspended company or an inactive store looks exactly like a missing one", async () => {
    await q("update tenants set status = 'suspended' where id = $1", [tenantA]);
    expect(await storefront("urban-nest")).toBeNull();
    await q("update tenants set status = 'active' where id = $1", [tenantA]);
    await q("update stores set status = 'inactive' where tenant_id = $1", [tenantA]);
    expect(await storefront("urban-nest")).toBeNull();
    await q("update stores set status = 'active' where tenant_id = $1", [tenantA]);
    expect(await storefront("urban-nest")).not.toBeNull();
  });

  it("anon cannot call it, and the identity-less request role still sees no table rows", async () => {
    await db.exec("set role anon");
    try {
      await expect(db.query("select public.get_public_storefront('urban-nest')")).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec("reset role");
    }
    await db.exec("begin; set local role authenticated");
    try {
      for (const t of ["products", "stores", "tenants", "customers", "memberships"]) {
        expect((await db.query<{ n: number }>(`select count(*)::int n from ${t}`)).rows[0].n, t).toBe(0);
      }
    } finally {
      await db.exec("rollback");
    }
  });

});
