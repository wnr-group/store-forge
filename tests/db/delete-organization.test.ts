import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, createDb, createPlatformAdmin, createUser, provision } from "./harness";

/** platform_delete_tenant() (drizzle/0012): removes an organization and reports who is left with no membership. */
let db: PGlite;
let platform: string;
let owner: string;
let member: string; // only in the doomed organization
let shared: string; // also a member of another organization
let otherOwner: string;
let doomed: string;
let kept: string;

const q = <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => db.query<T>(sql, params).then((r) => r.rows);
const as = <T>(user: string, fn: () => Promise<T>) => asUser(db, user, fn);
const n = async (sql: string, params: unknown[] = []) => (await q<{ n: number }>(sql, params))[0].n;
const del = (user: string, tenant: string | null) =>
  as(user, async () => (await q<{ r: string[] }>("select public.platform_delete_tenant($1) as r", [tenant]))[0].r);
const rejects = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return (e as Error).message;
  }
  throw new Error("expected the statement to fail");
};

beforeAll(async () => {
  db = await createDb();
  platform = await createPlatformAdmin(db);
  [owner, member, shared, otherOwner] = await Promise.all(["own", "mem", "shared", "other"].map((x) => createUser(db, `${x}@example.test`)));
  doomed = (await provision(db, platform, owner, "doomed-shop")).tenant_id;
  kept = (await provision(db, platform, otherOwner, "kept-shop")).tenant_id;
  const perms = '{"products":"write","orders":"read","customers":"write","settings":"read"}';
  await q("insert into memberships (tenant_id, user_id, role, permissions) values ($1,$2,'admin',$4::jsonb), ($1,$3,'admin',$4::jsonb), ($5,$3,'admin',$4::jsonb)", [doomed, member, shared, perms, kept]);
  // data in every table family that must go with the organization
  const [{ id: product }] = await q<{ id: string }>("insert into products (tenant_id, name, slug, price_minor) values ($1,'Tee','tee',100) returning id", [doomed]);
  await q("insert into categories (tenant_id, name, slug) values ($1,'Cat','cat')", [doomed]);
  await q("insert into product_variants (tenant_id, product_id, title, options) values ($1,$2,'Tee M','{\"Size\":\"M\"}')", [doomed, product]);
  const [{ id: customer }] = await q<{ id: string }>("insert into customers (tenant_id, email, full_name) values ($1,'c@example.test','Cee') returning id", [doomed]);
  const [{ id: order }] = await q<{ id: string }>("insert into orders (tenant_id, customer_id, order_number, currency, subtotal_minor, total_minor) values ($1,$2,1,'INR',100,100) returning id", [doomed, customer]);
  await q("insert into order_items (tenant_id, order_id, product_id, name, quantity, unit_price_minor, total_minor) values ($1,$2,$3,'Tee',1,100,100)", [doomed, order, product]);
  await q("insert into products (tenant_id, name, slug, price_minor) values ($1,'Keep','keep',100)", [kept]);
});

afterAll(async () => {
  await db.close();
});

describe("platform_delete_tenant", () => {
  it("is refused for owners, members and unknown tenants, and deletes nothing", async () => {
    for (const user of [owner, member, shared, otherOwner]) {
      expect(await rejects(del(user, doomed)), user).toMatch(/not_platform_admin/);
    }
    expect(await rejects(del(platform, crypto.randomUUID()))).toMatch(/not_found/);
    expect(await rejects(del(platform, null))).toMatch(/invalid_input/);
    expect(await n("select count(*)::int n from tenants where id=$1", [doomed])).toBe(1);
  });

  it("deletes the organization and everything under it, and returns only people with no other membership", async () => {
    const orphans = await del(platform, doomed);
    expect([...orphans].sort()).toEqual([owner, member].sort()); // `shared` also belongs to `kept`
    for (const table of ["tenants", "stores", "memberships", "products", "categories", "product_variants", "customers", "orders", "order_items"]) {
      const col = table === "tenants" ? "id" : "tenant_id";
      expect(await n(`select count(*)::int n from ${table} where ${col}=$1`, [doomed]), table).toBe(0);
    }
  });

  it("leaves other organizations, and a shared member's access to them, untouched", async () => {
    expect(await n("select count(*)::int n from tenants where id=$1", [kept])).toBe(1);
    expect(await n("select count(*)::int n from products where tenant_id=$1", [kept])).toBe(1);
    expect(await n("select count(*)::int n from memberships where tenant_id=$1", [kept])).toBe(2); // owner + shared
    expect(await n("select count(*)::int n from memberships where user_id=$1", [shared])).toBe(1);
    expect(await as(shared, async () => (await q<{ n: number }>("select count(*)::int n from products"))[0].n)).toBe(1);
  });

  it("a second delete of the same organization reports it as not found", async () => {
    expect(await rejects(del(platform, doomed))).toMatch(/not_found/);
  });
});
