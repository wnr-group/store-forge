import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, createDb, createPlatformAdmin, createUser, onboard, provision } from "./harness";

/**
 * Platform Admin management, usage analytics and platform settings (drizzle/0015, with the removals in 0017).
 * Everything is called through the real SQL functions as an authenticated user, the way the app does.
 */
let db: PGlite;
let boss: string; // super admin
let second: string; // super admin
let helper: string; // admin (not super)
let alice: string; // an organization owner
let tenantA: string;
let tenantB: string;

const q = <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => db.query<T>(sql, params).then((r) => r.rows);
const as = <T>(user: string | null, fn: () => Promise<T>) => asUser(db, user, fn);
const one = <T>(user: string | null, sql: string, params: unknown[] = []) => as(user, async () => (await q<T>(sql, params))[0]);
const many = <T>(user: string | null, sql: string, params: unknown[] = []) => as(user, () => q<T>(sql, params));
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
  boss = await createPlatformAdmin(db, "boss@example.test", "super_admin");
  second = await createPlatformAdmin(db, "second@example.test", "super_admin");
  helper = await createPlatformAdmin(db, "helper@example.test", "admin");
  alice = await createUser(db, "alice@example.test");
  tenantA = (await provision(db, boss, alice, "alpha-shop", { tenant: "Alpha Inc", store: "Alpha Store" })).tenant_id;
  const bob = await createUser(db, "bob@example.test");
  tenantB = (await provision(db, boss, bob, "beta-shop", { tenant: "Beta Inc", store: "Beta Store" })).tenant_id;
});

afterAll(async () => {
  await db.close();
});

describe("platform admin levels", () => {
  const add = (user: string | null, target: string, role: string) => one<void>(user, "select public.platform_add_admin($1,$2)", [target, role]);
  const setRole = (user: string | null, target: string, role: string) => one<{ r: string }>(user, "select public.platform_set_admin_role($1,$2) as r", [target, role]);
  const remove = (user: string | null, target: string) => one<{ r: string }>(user, "select public.platform_remove_admin($1) as r", [target]);
  const roles = async () => Object.fromEntries((await q<{ user_id: string; role: string }>("select user_id, role from platform_admins")).map((r) => [r.user_id, r.role]));

  it("tells every admin their own level, and non-admins nothing", async () => {
    expect((await one<{ r: string }>(boss, "select public.platform_admin_role() as r")).r).toBe("super_admin");
    expect((await one<{ r: string }>(helper, "select public.platform_admin_role() as r")).r).toBe("admin");
    expect((await one<{ r: string | null }>(alice, "select public.platform_admin_role() as r")).r).toBeNull();
    expect((await one<{ r: boolean }>(helper, "select public.is_super_admin() as r")).r).toBe(false);
    expect((await one<{ r: boolean }>(boss, "select public.is_super_admin() as r")).r).toBe(true);
  });

  it("lists admins with who added them, for any admin, and not for anyone else", async () => {
    const rows = await many<{ email: string; role: string; created_by_email: string | null }>(helper, "select * from public.platform_list_admins()");
    expect(rows.map((r) => r.email).sort()).toEqual(["boss@example.test", "helper@example.test", "second@example.test"]);
    expect(rows[0].role).toBe("super_admin"); // super admins first
    expect(await rejects(many(alice, "select * from public.platform_list_admins()"))).toMatch(/not_platform_admin/);
  });

  it("adds an admin at a chosen level, recording who added them, but only for a super admin", async () => {
    const newbie = await createUser(db, "newbie@example.test", "Newbie");
    await add(boss, newbie, "admin");
    expect((await roles())[newbie]).toBe("admin");
    expect((await q<{ created_by: string }>("select created_by from platform_admins where user_id=$1", [newbie]))[0].created_by).toBe(boss);
    const other = await createUser(db, "other@example.test");
    for (const user of [helper, newbie, alice]) expect(await rejects(add(user, other, "admin"))).toMatch(/not_super_admin/);
    expect(await rejects(add(null, other, "admin"))).toMatch(/permission denied|not_super_admin/);
    expect((await roles())[other]).toBeUndefined();
  });

  it("rejects an unknown person, a duplicate, a bad level, and anyone who belongs to an organization", async () => {
    expect(await rejects(add(boss, crypto.randomUUID(), "admin"))).toMatch(/not_found/);
    expect(await rejects(add(boss, helper, "admin"))).toMatch(/already_admin/);
    const fresh = await createUser(db, "fresh@example.test");
    expect(await rejects(add(boss, fresh, "owner"))).toMatch(/invalid_input/);
    expect(await rejects(add(boss, alice, "admin"))).toMatch(/member_cannot_be_platform_admin/); // an organization owner
  });

  it("changes a level and returns the previous one, but never demotes the last super admin", async () => {
    expect((await setRole(boss, helper, "super_admin")).r).toBe("admin");
    expect((await roles())[helper]).toBe("super_admin");
    expect((await setRole(boss, helper, "admin")).r).toBe("super_admin"); // three supers: fine
    // demote down to a single super admin, then the last one is protected
    expect((await setRole(boss, second, "admin")).r).toBe("super_admin");
    expect(await rejects(setRole(boss, boss, "admin"))).toMatch(/last_super_admin/);
    expect((await roles())[boss]).toBe("super_admin");
    await setRole(boss, second, "super_admin");
  });

  it("refuses level changes from anyone but a super admin, and for unknown people or levels", async () => {
    for (const user of [helper, alice]) expect(await rejects(setRole(user, helper, "super_admin"))).toMatch(/not_super_admin/);
    expect(await rejects(setRole(boss, crypto.randomUUID(), "admin"))).toMatch(/not_found/);
    expect(await rejects(setRole(boss, helper, "owner"))).toMatch(/invalid_input/);
    expect((await roles())[helper]).toBe("admin");
  });

  it("removes admins, including yourself when another super admin remains, but never the last one", async () => {
    const temp = await createUser(db, "temp@example.test");
    await add(boss, temp, "admin");
    expect((await remove(boss, temp)).r).toBe("admin");
    expect((await roles())[temp]).toBeUndefined();
    expect(await rejects(remove(boss, temp))).toMatch(/not_found/);
    for (const user of [helper, alice]) expect(await rejects(remove(user, second))).toMatch(/not_super_admin/);
    // two super admins: one may remove themselves; the remaining one is then protected, even from themselves
    expect((await remove(second, second)).r).toBe("super_admin");
    expect(await rejects(remove(boss, boss))).toMatch(/last_super_admin/);
    expect((await roles())[boss]).toBe("super_admin");
    await q("insert into platform_admins (user_id, role) values ($1,'super_admin')", [second]); // restore for the other tests
  });

  it("keeps platform authority separate: an admin of either level can do admin work, an organization owner cannot", async () => {
    for (const user of [boss, helper]) expect((await many(user, "select * from public.platform_list_tenants_page()")).length).toBeGreaterThan(0);
    expect(await rejects(many(alice, "select * from public.platform_list_tenants_page()"))).toMatch(/not_platform_admin/);
  });
});

describe("usage (aggregates only)", () => {
  type Usage = { products: string | number; customers: string | number; orders: string | number; storage_bytes: string | number | null; last_activity: string | null; created_at: string; status: string };
  const usage = (user: string | null, tenant: string) => one<Usage>(user, "select * from public.platform_tenant_usage($1)", [tenant]);

  beforeAll(async () => {
    await q("insert into products (tenant_id, name, slug, price_minor) values ($1,'A','prod-a',1), ($1,'B','prod-b',1), ($1,'C','prod-c',1)", [tenantA]);
    await q("insert into customers (tenant_id, email, full_name) values ($1,'c1@example.test','One'), ($1,'c2@example.test','Two')", [tenantA]);
    await q("insert into orders (tenant_id, order_number, currency, subtotal_minor, total_minor) values ($1,1,'INR',100,100)", [tenantA]);
  });

  it("counts products, customers and orders and reports the last activity", async () => {
    const u = await usage(boss, tenantA);
    expect([Number(u.products), Number(u.customers), Number(u.orders)]).toEqual([3, 2, 1]);
    expect(u.last_activity).not.toBeNull();
    expect(u.status).toBe("active");
    const empty = await usage(boss, tenantB);
    expect([Number(empty.products), Number(empty.customers), Number(empty.orders)]).toEqual([0, 0, 0]); // a real zero
    expect(empty.last_activity).toBeNull(); // no activity at all is NULL, not a made-up date
  });

  it("reports storage as unavailable (null), never as zero, where Storage does not exist", async () => {
    expect((await usage(boss, tenantA)).storage_bytes).toBeNull();
    expect((await one<{ storage_total_bytes: number | null }>(boss, "select * from public.platform_usage_summary(30)")).storage_total_bytes).toBeNull();
  });

  it("is available to Platform Admins only, and returns nothing a merchant record could identify", async () => {
    expect(await rejects(usage(alice, tenantA))).toMatch(/not_platform_admin/);
    expect(await rejects(usage(boss, crypto.randomUUID()))).toMatch(/not_found/);
    const cols = Object.keys(await usage(boss, tenantA)).sort();
    expect(cols).toEqual(["created_at", "customers", "last_activity", "orders", "products", "status", "storage_bytes"]);
  });

  it("pages organizations with their usage, using the same search, status and sort rules", async () => {
    type Row = { id: string; name: string; products: string | number; total_count: string | number };
    const page = (args: { search?: string | null; status?: string | null; sort?: string; limit?: number; offset?: number } = {}, user: string | null = boss) =>
      many<Row>(user, "select * from public.platform_usage_page($1,$2,$3,$4,$5)", [args.search ?? null, args.status ?? null, args.sort ?? "created_desc", args.limit ?? 20, args.offset ?? 0]);
    const rows = await page({ sort: "name_asc" });
    expect(rows.map((r) => r.name)).toEqual(["Alpha Inc", "Beta Inc"]);
    expect(Number(rows[0].products)).toBe(3);
    expect(Number(rows[0].total_count)).toBe(2);
    expect((await page({ limit: 1, offset: 1, sort: "name_asc" })).map((r) => r.name)).toEqual(["Beta Inc"]);
    expect((await page({ search: "alp" })).map((r) => r.name)).toEqual(["Alpha Inc"]);
    expect(await page({ status: "suspended" })).toHaveLength(0);
    expect(await rejects(page({ sort: "products_desc" }))).toMatch(/invalid_input/);
    expect(await rejects(page({}, alice))).toMatch(/not_platform_admin/);
  });

  it("counts organizations with no recent merchant activity, and a brand-new one is not inactive", async () => {
    const oldQuiet = (await onboard(db, await createUser(db, "quiet@example.test"), "old-quiet", { tenant: "Old Quiet" })).tenant_id;
    const oldBusy = (await onboard(db, await createUser(db, "busy@example.test"), "old-busy", { tenant: "Old Busy" })).tenant_id;
    await q("update tenants set created_at = now() - interval '200 days' where id = any($1::uuid[])", [[oldQuiet, oldBusy]]);
    await q("insert into products (tenant_id, name, slug, price_minor) values ($1,'Fresh','fresh',1)", [oldBusy]); // activity now
    const summary = await one<{ total_orgs: string | number; active_orgs: string | number; suspended_orgs: string | number; inactive_orgs: string | number }>(boss, "select * from public.platform_usage_summary(30)");
    expect([Number(summary.total_orgs), Number(summary.active_orgs), Number(summary.suspended_orgs)]).toEqual([4, 4, 0]); // Alpha, Beta and the two old ones
    expect(Number(summary.inactive_orgs)).toBe(1); // only "Old Quiet": old and silent
    const idle = await many<{ name: string; last_activity: string | null; total_count: string | number }>(boss, "select * from public.platform_inactive_organizations(30, 10, 0)");
    expect(idle.map((r) => r.name)).toEqual(["Old Quiet"]);
    expect(idle[0].last_activity).toBeNull();
    expect(Number(idle[0].total_count)).toBe(1);
    // a window longer than the organization has existed: it is not "inactive", it is simply too new to judge
    const wide = await many<{ name: string }>(boss, "select * from public.platform_inactive_organizations(3650, 10, 0)");
    expect(wide).toEqual([]);
    // the updated_at trigger resets the column on UPDATE, so recreate the product with an old timestamp
    await q("delete from products where tenant_id = $1", [oldBusy]);
    await q("insert into products (tenant_id, name, slug, price_minor, updated_at) values ($1,'Stale','stale',1, now() - interval '100 days')", [oldBusy]);
    const mid = await many<{ name: string }>(boss, "select * from public.platform_inactive_organizations(30, 10, 0)");
    expect(mid.map((r) => r.name)).toEqual(["Old Quiet", "Old Busy"]); // never active first, then the least recent
    expect(await rejects(many(alice, "select * from public.platform_inactive_organizations(30,10,0)"))).toMatch(/not_platform_admin/);
    expect(await rejects(many(alice, "select * from public.platform_usage_summary(30)"))).toMatch(/not_platform_admin/);
  });

  it("builds a zero-filled series of new organizations per day, week or month", async () => {
    await q("update tenants set created_at = '2025-01-15 10:00:00+00' where id not in ($1, $2)", [tenantA, tenantB]); // keep the other organizations out of the range
    await q("update tenants set created_at = '2026-03-02 10:00:00+00' where id = $1", [tenantA]); // a Monday
    await q("update tenants set created_at = '2026-03-04 10:00:00+00' where id = $1", [tenantB]);
    const series = (bucket: string, from: string, to: string, user: string | null = boss) =>
      many<{ bucket_start: string; created: string | number }>(user, "select to_char(bucket_start, 'YYYY-MM-DD') bucket_start, created from public.platform_new_organizations_series($1::date,$2::date,$3)", [from, to, bucket]);
    const days = await series("day", "2026-03-01", "2026-03-05");
    expect(days.map((d) => [d.bucket_start, Number(d.created)])).toEqual([["2026-03-01", 0], ["2026-03-02", 1], ["2026-03-03", 0], ["2026-03-04", 1], ["2026-03-05", 0]]);
    expect((await series("week", "2026-03-01", "2026-03-15")).map((d) => [d.bucket_start, Number(d.created)])).toEqual([["2026-02-23", 0], ["2026-03-02", 2], ["2026-03-09", 0]]);
    expect((await series("month", "2026-02-10", "2026-04-10")).map((d) => [d.bucket_start, Number(d.created)])).toEqual([["2026-02-01", 0], ["2026-03-01", 2], ["2026-04-01", 0]]);
    expect(await rejects(series("day", "2026-03-05", "2026-03-01"))).toMatch(/invalid_input/);
    expect(await rejects(series("year", "2026-03-01", "2026-03-05"))).toMatch(/invalid_input/);
    expect(await rejects(series("day", "2020-01-01", "2026-01-01"))).toMatch(/invalid_input/); // far too many buckets
    expect(await rejects(series("day", "2026-03-01", "2026-03-05", alice))).toMatch(/not_platform_admin/);
  });
});

describe("platform settings", () => {
  type Settings = { platform_name: string; support_email: string | null; default_currency: string; default_timezone: string; default_store_status: string; updated_by_email: string | null };
  const get = (user: string | null) => one<Settings>(user, "select * from public.get_platform_settings()");
  const update = (user: string | null, over: Partial<{ name: string; email: string | null; currency: string; tz: string; status: string }> = {}) => {
    const v = { name: "StoreForge", email: null as string | null, currency: "INR", tz: "Asia/Kolkata", status: "active", ...over };
    return one<{ ok: boolean }>(user, "select public.platform_update_settings($1,$2,$3,$4,$5) as ok", [v.name, v.email, v.currency, v.tz, v.status]);
  };

  it("starts with the values that used to be hardcoded", async () => {
    expect(await get(helper)).toMatchObject({ platform_name: "StoreForge", support_email: null, default_currency: "INR", default_timezone: "Asia/Kolkata", default_store_status: "active" });
    expect(await rejects(get(alice))).toMatch(/not_platform_admin/);
  });

  it("exposes only the name and support e-mail publicly", async () => {
    const pub = await one<Record<string, unknown>>(alice, "select * from public.get_public_platform_settings()");
    expect(Object.keys(pub).sort()).toEqual(["platform_name", "support_email"]);
  });

  it("is writable by a super admin only, and records who changed it", async () => {
    expect((await update(boss, { name: "  Acme Commerce ", email: " help@acme.test ", currency: "usd", tz: "America/New_York", status: "inactive" })).ok).toBe(true);
    expect(await get(boss)).toMatchObject({ platform_name: "Acme Commerce", support_email: "help@acme.test", default_currency: "USD", default_timezone: "America/New_York", default_store_status: "inactive", updated_by_email: "boss@example.test" });
    for (const user of [helper, alice]) expect(await rejects(update(user, { name: "Hacked" }))).toMatch(/not_super_admin/);
    expect(await rejects(update(null, { name: "Hacked" }))).toMatch(/permission denied|not_super_admin/);
    expect((await get(boss)).platform_name).toBe("Acme Commerce");
  });

  it("rejects values it should not accept", async () => {
    for (const over of [{ name: "A" }, { name: "x".repeat(61) }, { email: "not-an-email" }, { currency: "US" }, { currency: "" }, { tz: "Mars/Olympus" }, { status: "suspended" }]) {
      expect(await rejects(update(boss, over)), JSON.stringify(over).slice(0, 60)).toMatch(/invalid_input/);
    }
    expect((await get(boss)).platform_name).toBe("Acme Commerce");
  });

  it("cannot be read or written directly", async () => {
    for (const user of [alice, boss]) {
      expect(await rejects(many(user, "select * from platform_settings"))).toMatch(/permission denied/);
      expect(await rejects(many(user, "update platform_settings set platform_name = 'x'"))).toMatch(/permission denied/);
    }
  });

  it("keeps the built-in reserved store addresses, and nothing else is reserved", async () => {
    const valid = (slug: string) => one<{ ok: boolean }>(alice, "select public.is_valid_store_slug($1) as ok", [slug]);
    for (const reserved of ["admin", "www", "api", "login", "dashboard", "storeforge"]) expect((await valid(reserved)).ok, reserved).toBe(false);
    for (const free of ["promo", "shop-now", "fresh-name"]) expect((await valid(free)).ok, free).toBe(true);
    expect(await rejects(provision(db, boss, await createUser(db, "p@example.test"), "admin"))).toMatch(/invalid_slug/);
    // the settings no longer carry any list of reserved names
    expect(Object.keys(await get(boss)).sort()).toEqual(["default_currency", "default_store_status", "default_timezone", "platform_name", "support_email", "updated_at", "updated_by_email"]);
  });

  it("starts new stores with the platform defaults, and leaves existing stores alone", async () => {
    const before = (await q<{ currency: string; timezone: string; status: string }>("select currency, timezone, status from stores where tenant_id=$1", [tenantA]))[0];
    expect(before).toEqual({ currency: "INR", timezone: "Asia/Kolkata", status: "active" });
    const owner = await createUser(db, "defaults@example.test");
    const created = await provision(db, boss, owner, "defaults-shop");
    expect((await q("select currency, timezone, status from stores where id=$1", [created.store_id]))[0]).toEqual({ currency: "USD", timezone: "America/New_York", status: "inactive" });
    const again = await provision(db, boss, owner, "defaults-shop"); // idempotent retry
    expect(again).toMatchObject({ store_id: created.store_id, created: false });
    expect((await q<{ currency: string }>("select currency from stores where tenant_id=$1", [tenantA]))[0].currency).toBe("INR");
    await update(boss); // restore the original defaults for any later test
    const plain = await provision(db, boss, await createUser(db, "plain@example.test"), "plain-shop");
    expect((await q("select currency, timezone, status from stores where id=$1", [plain.store_id]))[0]).toEqual({ currency: "INR", timezone: "Asia/Kolkata", status: "active" });
  });
});
