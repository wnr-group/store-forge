import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, createDb, createPlatformAdmin, createUser, provision } from "./harness";

/**
 * Platform Admin phase 2 (drizzle/0014): edit organization and store, store status, team member status and removal,
 * and ownership change. Every function is called as an authenticated user, the way the app does.
 */
let db: PGlite;
let admin: string;
let alice: string; // owner of A
let bob: string; // owner of B
let mia: string; // manager in A
let dan: string; // disabled in A
let shared: string; // member of A and B
let tenantA: string;
let tenantB: string;
let storeA: string;
let storeB: string;

const MANAGER = { products: "write", orders: "read", customers: "write", settings: "write" };
const q = <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => db.query<T>(sql, params).then((r) => r.rows);
const as = <T>(user: string | null, fn: () => Promise<T>) => asUser(db, user, fn);
const one = async <T>(user: string | null, sql: string, params: unknown[] = []) => as(user, async () => (await q<T>(sql, params))[0]);
const rejects = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return (e as Error).message;
  }
  throw new Error("expected the statement to fail");
};
const tenantRow = async () => (await q<{ name: string; slug: string; status: string; contact_phone: string | null; address: string | null }>("select name, slug, status, contact_phone, address from tenants where id=$1", [tenantA]))[0];
const storeRow = async () => (await q<Record<string, string | null>>("select name, slug, description, currency, timezone, status, contact_email, contact_phone from stores where id=$1", [storeA]))[0];
const member = async (tenant: string, user: string) => (await q<{ role: string; status: string; permissions: Record<string, string> }>("select role, status, permissions from memberships where tenant_id=$1 and user_id=$2", [tenant, user]))[0];
const owners = async (tenant: string) => (await q<{ user_id: string }>("select user_id from memberships where tenant_id=$1 and role='owner'", [tenant])).map((r) => r.user_id);

const updateTenant = (user: string | null, name: string | null, phone: string | null, address: string | null, tenant = tenantA) =>
  one<{ ok: boolean }>(user, "select public.platform_update_tenant($1,$2,$3,$4) as ok", [tenant, name, phone, address]);
const updateStore = (user: string | null, over: Partial<Record<string, string | null>> = {}, tenant = tenantA, store = storeA) => {
  const v = { name: "New Store", description: "A shop", email: "shop@example.test", phone: "+91 98765 43210", currency: "INR", tz: "Asia/Kolkata", ...over };
  return one<{ ok: boolean }>(user, "select public.platform_update_store($1,$2,$3,$4,$5,$6,$7,$8) as ok", [tenant, store, v.name, v.description, v.email, v.phone, v.currency, v.tz]);
};
const setStoreStatus = (user: string | null, status: string, tenant = tenantA, store = storeA) => one<{ ok: boolean }>(user, "select public.platform_set_store_status($1,$2,$3) as ok", [tenant, store, status]);
const setMemberStatus = (user: string | null, target: string, status: string, tenant = tenantA) => one<{ ok: boolean }>(user, "select public.platform_set_member_status($1,$2,$3) as ok", [tenant, target, status]);
const removeMember = (user: string | null, target: string, tenant = tenantA) => one<{ orphaned: boolean }>(user, "select public.platform_remove_member($1,$2) as orphaned", [tenant, target]);
const assignOwner = (user: string | null, target: string, previous = "active", tenant = tenantA) =>
  one<{ r: { previous_owner_id: string | null; new_owner_id: string; created_membership: boolean } }>(user, "select public.platform_assign_owner($1,$2,$3) as r", [tenant, target, previous]);

beforeAll(async () => {
  db = await createDb();
  admin = await createPlatformAdmin(db);
  [alice, bob, mia, dan, shared] = await Promise.all(["alice", "bob", "mia", "dan", "shared"].map((n) => createUser(db, `${n}@example.test`, n)));
  const a = await provision(db, admin, alice, "alpha-shop", { tenant: "Alpha Inc", store: "Alpha Store" });
  const b = await provision(db, admin, bob, "beta-shop", { tenant: "Beta Inc", store: "Beta Store" });
  [tenantA, storeA, tenantB, storeB] = [a.tenant_id, a.store_id, b.tenant_id, b.store_id];
  const perms = JSON.stringify(MANAGER);
  await q("insert into memberships (tenant_id, user_id, role, status, permissions) values ($1,$2,'admin','active',$5::jsonb), ($1,$3,'admin','disabled',$5::jsonb), ($1,$4,'admin','active',$5::jsonb), ($6,$4,'admin','active',$5::jsonb)", [tenantA, mia, dan, shared, perms, tenantB]);
});

afterAll(async () => {
  await db.close();
});

describe("edit organization", () => {
  it("updates name, phone and address, trims them, and clears blanks to null", async () => {
    expect((await updateTenant(admin, "  Alpha Renamed  ", " +91 98765 43210 ", " 12 Market Road ")).ok).toBe(true);
    expect(await tenantRow()).toMatchObject({ name: "Alpha Renamed", slug: "alpha-shop", status: "active", contact_phone: "+91 98765 43210", address: "12 Market Road" });
    expect((await updateTenant(admin, "Alpha Inc", "", "   ")).ok).toBe(true);
    expect(await tenantRow()).toMatchObject({ name: "Alpha Inc", contact_phone: null, address: null });
  });

  it("never changes the slug or status, and reports an unknown organization as not found", async () => {
    await updateTenant(admin, "Alpha Inc", null, null);
    expect(await tenantRow()).toMatchObject({ slug: "alpha-shop", status: "active" });
    expect((await updateTenant(admin, "Ghost", null, null, crypto.randomUUID())).ok).toBe(false);
  });

  it("rejects values the table would not accept", async () => {
    for (const [name, phone, address] of [["", null, null], ["A", null, null], ["x".repeat(81), null, null], ["Fine", "123", null], ["Fine", null, "x".repeat(301)]] as const) {
      expect(await rejects(updateTenant(admin, name, phone, address)), `${name.length}/${phone}/${address?.length}`).toMatch(/invalid_input/);
    }
    expect(await tenantRow()).toMatchObject({ name: "Alpha Inc" });
  });

  it("is refused for everyone but a Platform Admin, the organization's own Owner included", async () => {
    for (const user of [alice, mia, bob]) expect(await rejects(updateTenant(user, "Hacked", null, null))).toMatch(/not_platform_admin/);
    expect(await rejects(updateTenant(null, "Hacked", null, null))).toMatch(/permission denied|not_platform_admin/);
    expect(await tenantRow()).toMatchObject({ name: "Alpha Inc" });
  });
});

describe("store details and editing", () => {
  it("returns the store with its details and whether prices already exist", async () => {
    const s = await one<{ name: string; slug: string; status: string; has_money_data: boolean; currency: string }>(admin, "select * from public.platform_get_tenant_store($1)", [tenantA]);
    expect(s).toMatchObject({ name: "Alpha Store", slug: "alpha-shop", status: "active", currency: "INR", has_money_data: false });
    expect(await rejects(one(alice, "select * from public.platform_get_tenant_store($1)", [tenantA]))).toMatch(/not_platform_admin/);
  });

  it("updates name, description, contact details, currency and timezone, but not the address", async () => {
    expect((await updateStore(admin, { name: "  Alpha Shop  ", description: "Fine goods", email: "hello@alpha.test", phone: "+1 415 555 0100", currency: "usd", tz: "America/New_York" })).ok).toBe(true);
    expect(await storeRow()).toMatchObject({ name: "Alpha Shop", slug: "alpha-shop", description: "Fine goods", contact_email: "hello@alpha.test", contact_phone: "+1 415 555 0100", currency: "USD", timezone: "America/New_York" });
    expect((await updateStore(admin, { description: "", email: null, phone: " " })).ok).toBe(true);
    expect(await storeRow()).toMatchObject({ description: null, contact_email: null, contact_phone: null, currency: "INR", timezone: "Asia/Kolkata" });
  });

  it("locks the currency once products or orders exist, but still allows other changes", async () => {
    await q("insert into products (tenant_id, name, slug, price_minor) values ($1,'Tee','tee',100)", [tenantA]);
    expect((await one<{ has_money_data: boolean }>(admin, "select * from public.platform_get_tenant_store($1)", [tenantA])).has_money_data).toBe(true);
    expect(await rejects(updateStore(admin, { currency: "USD" }))).toMatch(/currency_locked/);
    expect((await updateStore(admin, { name: "Still Editable", currency: "INR" })).ok).toBe(true);
    expect(await storeRow()).toMatchObject({ name: "Still Editable", currency: "INR" });
    await q("delete from products where tenant_id=$1", [tenantA]);
  });

  it("rejects bad input and unknown timezones", async () => {
    for (const over of [{ name: "" }, { name: "A" }, { currency: "US" }, { currency: "" }, { tz: "Mars/Olympus" }, { tz: "" }, { email: "not-an-email" }, { phone: "12" }, { description: "x".repeat(501) }]) {
      expect(await rejects(updateStore(admin, over)), JSON.stringify(over)).toMatch(/invalid_input/);
    }
    expect(await storeRow()).toMatchObject({ name: "Still Editable" });
  });

  it("only edits a store that belongs to the organization named, and only for Platform Admins", async () => {
    expect((await updateStore(admin, { name: "Cross tenant" }, tenantA, storeB)).ok).toBe(false);
    expect((await q<{ name: string }>("select name from stores where id=$1", [storeB]))[0].name).toBe("Beta Store");
    for (const user of [alice, mia, bob]) expect(await rejects(updateStore(user, { name: "Hacked" }))).toMatch(/not_platform_admin/);
  });
});

describe("store status is separate from organization status", () => {
  it("changes the store status without touching the organization, and the other way round", async () => {
    for (const status of ["inactive", "suspended", "active"]) {
      expect((await setStoreStatus(admin, status)).ok).toBe(true);
      expect((await storeRow()).status).toBe(status);
      expect((await tenantRow()).status).toBe("active");
    }
    await as(admin, () => q("select public.platform_set_tenant_status($1,'suspended')", [tenantA]));
    expect((await tenantRow()).status).toBe("suspended");
    expect((await storeRow()).status).toBe("active"); // suspending the organization did not touch the store
    await as(admin, () => q("select public.platform_set_tenant_status($1,'active')", [tenantA]));
  });

  it("rejects unknown statuses, another organization's store and non-admins", async () => {
    expect(await rejects(setStoreStatus(admin, "deleted"))).toMatch(/invalid_input/);
    expect((await setStoreStatus(admin, "suspended", tenantA, storeB)).ok).toBe(false);
    expect((await q<{ status: string }>("select status from stores where id=$1", [storeB]))[0].status).toBe("active");
    for (const user of [alice, mia]) expect(await rejects(setStoreStatus(user, "suspended"))).toMatch(/not_platform_admin/);
  });
});

describe("team member status and removal", () => {
  it("disables and reactivates a member, who loses and regains access", async () => {
    const can = (user: string) => as(user, async () => (await q<{ ok: boolean }>("select public.is_tenant_member($1) as ok", [tenantA]))[0].ok);
    expect(await can(mia)).toBe(true);
    expect((await setMemberStatus(admin, mia, "disabled")).ok).toBe(true);
    expect((await member(tenantA, mia)).status).toBe("disabled");
    expect(await can(mia)).toBe(false);
    expect((await setMemberStatus(admin, mia, "active")).ok).toBe(true);
    expect(await can(mia)).toBe(true);
  });

  it("never disables or removes the Owner, and reports an unknown member", async () => {
    expect(await rejects(setMemberStatus(admin, alice, "disabled"))).toMatch(/cannot_change_owner/);
    expect(await rejects(removeMember(admin, alice))).toMatch(/cannot_change_owner/);
    expect(await member(tenantA, alice)).toMatchObject({ role: "owner", status: "active" });
    expect((await setMemberStatus(admin, bob, "disabled")).ok).toBe(false); // a member of another organization only
    expect(await rejects(removeMember(admin, crypto.randomUUID()))).toMatch(/not_found/);
    expect(await rejects(setMemberStatus(admin, mia, "gone"))).toMatch(/invalid_input/);
  });

  it("removes a member and reports whether they now belong to no organization", async () => {
    expect((await removeMember(admin, dan)).orphaned).toBe(true); // only in A
    expect(await member(tenantA, dan)).toBeUndefined();
    expect((await removeMember(admin, shared)).orphaned).toBe(false); // still in B
    expect(await member(tenantB, shared)).toMatchObject({ role: "admin" });
  });

  it("is refused for everyone but a Platform Admin, the Owner and the member themselves included", async () => {
    for (const user of [alice, mia, bob]) {
      expect(await rejects(setMemberStatus(user, mia, "disabled")), "disable").toMatch(/not_platform_admin/);
      expect(await rejects(removeMember(user, mia)), "remove").toMatch(/not_platform_admin/);
    }
    expect(await member(tenantA, mia)).toMatchObject({ status: "active" });
  });
});

describe("ownership change", () => {
  it("rejects what it should without changing anything", async () => {
    const before = await owners(tenantA);
    expect(await rejects(assignOwner(admin, alice))).toMatch(/already_owner/);
    expect(await rejects(assignOwner(admin, bob))).toMatch(/not_eligible|not_found/); // owner elsewhere, not a member here
    await q("update memberships set status='disabled' where tenant_id=$1 and user_id=$2", [tenantA, mia]);
    expect(await rejects(assignOwner(admin, mia))).toMatch(/not_eligible/); // disabled members are not eligible
    await q("update memberships set status='active' where tenant_id=$1 and user_id=$2", [tenantA, mia]);
    expect(await rejects(assignOwner(admin, crypto.randomUUID()))).toMatch(/not_found/);
    expect(await rejects(assignOwner(admin, mia, "gone"))).toMatch(/invalid_input/);
    expect(await rejects(assignOwner(admin, mia, "active", crypto.randomUUID()))).toMatch(/not_found/);
    expect(await owners(tenantA)).toEqual(before);
    expect(await member(tenantA, alice)).toMatchObject({ role: "owner", status: "active" }); // nothing half-done
  });

  it("transfers ownership to an active member: the old owner becomes a Manager, there is exactly one owner", async () => {
    const res = await assignOwner(admin, mia, "active");
    expect(res.r).toEqual({ previous_owner_id: alice, new_owner_id: mia, created_membership: false });
    expect(await owners(tenantA)).toEqual([mia]);
    expect(await member(tenantA, mia)).toMatchObject({ role: "owner", status: "active", permissions: {} });
    expect(await member(tenantA, alice)).toMatchObject({ role: "admin", status: "active", permissions: MANAGER });
    // the new owner now has owner powers, the old owner does not
    const hasOwner = (user: string) => as(user, async () => (await q<{ ok: boolean }>("select public.has_tenant_role($1, array['owner']) as ok", [tenantA]))[0].ok);
    expect(await hasOwner(mia)).toBe(true);
    expect(await hasOwner(alice)).toBe(false);
  });

  it("can disable the previous owner as part of a recovery", async () => {
    await assignOwner(admin, alice, "disabled"); // hand it back, disabling mia
    expect(await owners(tenantA)).toEqual([alice]);
    expect(await member(tenantA, mia)).toMatchObject({ role: "admin", status: "disabled" });
    await q("update memberships set status='active' where tenant_id=$1 and user_id=$2", [tenantA, mia]);
  });

  it("recovers an organization that has no owner, with an existing member or a brand-new account", async () => {
    const orphanOwner = await createUser(db, "lost@example.test");
    const c = await provision(db, admin, orphanOwner, "orphan-shop");
    await q("delete from memberships where tenant_id=$1", [c.tenant_id]); // the owner's account is gone
    expect(await owners(c.tenant_id)).toEqual([]);
    const replacement = await createUser(db, "replacement@example.test");
    const res = await assignOwner(admin, replacement, "active", c.tenant_id);
    expect(res.r).toEqual({ previous_owner_id: null, new_owner_id: replacement, created_membership: true });
    expect(await owners(c.tenant_id)).toEqual([replacement]);
    expect(await member(c.tenant_id, replacement)).toMatchObject({ role: "owner", status: "active", permissions: {} });
  });

  it("never allows two owners, and a Platform Admin can never become one", async () => {
    expect(await rejects(q("insert into memberships (tenant_id, user_id, role) values ($1,$2,'owner')", [tenantA, bob]))).toMatch(/memberships_one_owner_idx|duplicate key/);
    expect(await rejects(assignOwner(admin, admin))).toMatch(/platform_admin_cannot_be_member/);
    expect(await owners(tenantA)).toEqual([alice]);
  });

  it("is refused for everyone but a Platform Admin", async () => {
    for (const user of [alice, mia, bob]) expect(await rejects(assignOwner(user, mia))).toMatch(/not_platform_admin/);
    expect(await rejects(assignOwner(null, mia))).toMatch(/permission denied|not_platform_admin/);
    expect(await owners(tenantA)).toEqual([alice]);
  });
});
