import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/pglite";
import type { PGlite } from "@electric-sql/pglite";
import { assertSeedAllowed, DEMO_USERS, ensureDemoUsers, seedDemoData, verifyDemoData, type SeedSummary } from "../../scripts/lib/demo-seed";
import { asUser, createDb, createUser, onboard } from "./harness";

let pg: PGlite;
let db: ReturnType<typeof drizzle>;
let demoUser: string;
let otherUser: string;
let otherTenant: string;
let first: SeedSummary;
let second: SeedSummary;
const count = async (table: string, tenant: string) =>
  Number((await pg.query<{ n: number }>(`select count(*)::int n from ${table} where tenant_id = $1`, [tenant])).rows[0].n);

beforeAll(async () => {
  pg = await createDb({ fullAuth: true });
  db = drizzle(pg);
  await ensureDemoUsers(drizzle(pg) as never);
  await ensureDemoUsers(drizzle(pg) as never); // idempotent
  demoUser = DEMO_USERS[0].id;
  otherUser = await createUser(pg, "other@example.com");
  otherTenant = (await onboard(pg, otherUser, "other-shop")).tenant_id;
  first = await seedDemoData(db as never, demoUser, new Date(), [{ userId: DEMO_USERS[1].id, role: "admin" }, { userId: DEMO_USERS[2].id, role: "staff" }]);
  second = await seedDemoData(db as never, demoUser, new Date(), [{ userId: DEMO_USERS[1].id, role: "admin" }, { userId: DEMO_USERS[2].id, role: "staff" }]);
});
afterAll(async () => pg.close());

describe("demo seed", () => {
  it("creates the expected volume through the onboarding function", () => {
    expect(first.tenantCreated).toBe(true);
    const c = first.counts;
    expect(c.categories.inserted).toBe(8);
    expect(c.collections.inserted).toBe(6);
    expect(c.customers.inserted).toBe(28);
    expect(c.orders.inserted).toBe(46);
    expect(c.products.inserted).toBeGreaterThanOrEqual(20);
    expect(c.productVariants.inserted).toBeGreaterThan(30);
  });

  it("is idempotent: a second run inserts nothing", async () => {
    expect(second.tenantId).toBe(first.tenantId);
    expect(second.tenantCreated).toBe(false);
    for (const [k, v] of Object.entries(second.counts)) expect(v.inserted, k).toBe(0);
    expect(await count("orders", first.tenantId)).toBe(46);
    expect(await count("customers", first.tenantId)).toBe(28);
  });

  it("is internally consistent (totals, variants, ledger)", async () => {
    expect(await verifyDemoData(db as never, first.tenantId)).toEqual([]);
  });

  it("covers healthy, low and out-of-stock units plus draft and active products", async () => {
    const q = async (s: string) => Number((await pg.query<{ n: number }>(s, [first.tenantId])).rows[0].n);
    expect(await q("select count(*)::int n from products where tenant_id=$1 and status='draft'")).toBeGreaterThan(0);
    expect(await q("select count(*)::int n from products where tenant_id=$1 and not has_variants and quantity = 0")).toBeGreaterThan(0);
    expect(await q("select count(*)::int n from products where tenant_id=$1 and not has_variants and quantity between 1 and low_stock_threshold")).toBeGreaterThan(0);
    expect(await q("select count(*)::int n from product_variants where tenant_id=$1 and quantity = 0")).toBeGreaterThan(0);
  });

  it("spreads orders over the previous 90 days with revenue and non-revenue statuses", async () => {
    const r = (await pg.query<{ lo: number; hi: number; statuses: string[] }>(
      "select extract(epoch from now()-min(placed_at))/86400 lo, extract(epoch from now()-max(placed_at))/86400 hi, array_agg(distinct status) statuses from orders where tenant_id=$1",
      [first.tenantId],
    )).rows[0];
    expect(Number(r.lo)).toBeLessThanOrEqual(90);
    expect(Number(r.lo)).toBeGreaterThan(80);
    expect(Number(r.hi)).toBeLessThan(2);
    expect(r.statuses).toEqual(expect.arrayContaining(["fulfilled", "paid"]));
  });

  it("never touches another tenant and keeps tenants isolated under RLS", async () => {
    expect(await count("products", otherTenant)).toBe(0);
    expect(await count("customers", otherTenant)).toBe(0);
    const seen = await asUser(pg, otherUser, async () => (await pg.query("select 1 from products")).rows.length);
    expect(seen).toBe(0);
    const own = await asUser(pg, demoUser, async () => (await pg.query("select 1 from products")).rows.length);
    expect(own).toBeGreaterThan(20);
  });

  it("refuses to write when the demo slug belongs to a different owner", async () => {
    const u = await createUser(pg, "intruder@example.com");
    const err = await seedDemoData(db as never, u).catch((e: Error & { cause?: Error }) => e);
    expect(String((err as { cause?: Error }).cause?.message ?? err)).toMatch(/slug_taken/);
    expect(await count("products", first.tenantId)).toBe(first.counts.products.inserted);
  });
});

describe("demo team", () => {
  it("creates three users with profiles and owner/admin/staff memberships, once", async () => {
    expect((await pg.query("select 1 from auth.users where email like '%@demo.test'")).rows).toHaveLength(3);
    const roles = (await pg.query<{ email: string; role: string }>("select u.email, m.role from memberships m join auth.users u on u.id = m.user_id where m.tenant_id = $1 order by 2", [first.tenantId])).rows;
    expect(roles.map((r) => r.role)).toEqual(["admin", "owner", "staff"]);
    const seen = await asUser(pg, DEMO_USERS[2].id, async () => (await pg.query("select 1 from customers")).rows.length);
    expect(seen).toBe(28);
  });
});

describe("assertSeedAllowed", () => {
  const ok = { SEED_DEMO_DATA: "true", DIRECT_URL: "postgres://x", SEED_DEMO_USER_EMAIL: "a@example.com" };
  it("accepts a complete development environment", () => expect(assertSeedAllowed(ok).userEmail).toBe("a@example.com"));
  it("refuses production", () => {
    expect(() => assertSeedAllowed({ ...ok, NODE_ENV: "production" })).toThrow(/production/);
    expect(() => assertSeedAllowed({ ...ok, VERCEL_ENV: "production" })).toThrow(/production/);
  });
  it("requires the explicit flag and DIRECT_URL, and defaults the owner", () => {
    expect(() => assertSeedAllowed({ ...ok, SEED_DEMO_DATA: undefined })).toThrow(/SEED_DEMO_DATA/);
    expect(() => assertSeedAllowed({ ...ok, SEED_DEMO_DATA: "1" })).toThrow(/SEED_DEMO_DATA/);
    expect(() => assertSeedAllowed({ ...ok, DIRECT_URL: undefined })).toThrow(/DIRECT_URL/);
    expect(assertSeedAllowed({ ...ok, SEED_DEMO_USER_EMAIL: undefined }).userEmail).toBe("owner@demo.test");
  });
});
