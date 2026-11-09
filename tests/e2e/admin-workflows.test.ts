import type { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { asAppConnection, createDb, createPlatformAdmin, createUser, provision } from "../db/harness";

/**
 * Platform Admin workflows, end to end: the REAL server actions, services, tenant context, row level security, SQL functions,
 * audit log and rate limits on an in-memory Postgres. Only the outer edges are replaced: the Supabase session and sign-in, the
 * Admin Auth API (a fake that writes to auth.users like the real one), Storage, and Next.js's redirect / revalidate / headers.
 * Each test goes through the same functions the admin screens call.
 */
const h = vi.hoisted(() => ({
  user: null as { id: string } | null,
  orm: null as unknown,
  pg: null as unknown,
  ip: "203.0.113.7",
  adminCalls: [] as Array<{ fn: string; args: unknown }>,
  storageCalls: [] as unknown[][],
  signIn: null as unknown as (args: { email: string; password: string }) => Promise<{ error: { code?: string; status?: number; message?: string } | null }>,
  logs: [] as string[],
}));

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: async () => h.user, requireUser: async () => h.user }));
vi.mock("@/lib/db", async (orig) => ({ ...(await orig<typeof import("@/lib/db")>()), getDatabase: () => h.orm }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: vi.fn() }),
  headers: async () => new Headers({ "x-forwarded-for": h.ip }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;replace;${url};307;`, url });
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { signInWithPassword: (a: { email: string; password: string }) => h.signIn(a) } }) }));
vi.mock("@/lib/storage/server", () => ({ removeTenantObjects: (...args: unknown[]) => { h.storageCalls.push(args); return Promise.resolve(); } }));

/** auth.users is not reachable as storeforge_app, so the fake Admin API works on the privileged session and then restores the role. */
async function privileged<T>(fn: (pg: PGlite) => Promise<T>): Promise<T> {
  const pg = h.pg as PGlite;
  const { rows } = await pg.query<{ su: string }>("select session_user as su");
  await pg.exec("set session authorization postgres");
  try {
    return await fn(pg);
  } finally {
    await pg.exec(`set session authorization ${rows[0].su}`);
  }
}
vi.mock("@/lib/supabase/admin", () => ({
  getAdminAuthClient: () => ({
    auth: {
      admin: {
        createUser: async (args: { email: string; user_metadata?: { full_name?: string } }) => {
          h.adminCalls.push({ fn: "createUser", args });
          return privileged(async (pg) => {
            if ((await pg.query("select 1 from auth.users where email = $1", [args.email])).rows.length)
              return { data: { user: null }, error: { code: "email_exists", status: 422, message: "already registered" } };
            const { rows } = await pg.query<{ id: string }>("insert into auth.users (email, raw_user_meta_data) values ($1, $2::jsonb) returning id", [args.email, JSON.stringify(args.user_metadata ?? {})]);
            return { data: { user: { id: rows[0].id, email: args.email } }, error: null };
          });
        },
        updateUserById: async () => ({ data: {}, error: null }),
        deleteUser: async (id: string) => {
          h.adminCalls.push({ fn: "deleteUser", args: { id } });
          await privileged((pg) => pg.query("delete from auth.users where id = $1", [id]));
          return { data: {}, error: null };
        },
      },
    },
  }),
}));

import * as adminActions from "@/app/(admin)/admin/actions";
import { loginAction } from "@/app/(auth)/actions";
import { requirePlatformAdminPage } from "@/lib/auth/platform";
import { dbSchema, type Database } from "@/lib/db";
import { listAuditAdmins, listAuditLogs } from "@/services/admin-audit.service";
import { getCompany, listCompaniesPage } from "@/services/platform.service";
import { getPlatformOverview } from "@/services/platform.service";

let pg: PGlite;
let boss: string; // super admin used by the main workflow
let limiter: string; // super admin used only by the rate-limit tests
let alice: string; // an organization owner, never an admin
const READ_ONLY = { products: "read", orders: "read", customers: "read", settings: "read" } as const;

const as = async <T>(user: string | null, fn: () => Promise<T>): Promise<T> => {
  h.user = user ? { id: user } : null;
  return asAppConnection(pg, fn);
};
const q = <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => privileged(async (p) => (await p.query<T>(sql, params)).rows);
const calls = (fn: string) => h.adminCalls.filter((c) => c.fn === fn);
const redirectedTo = (p: Promise<unknown>) => p.then(() => null, (e: { url?: string }) => e.url ?? "(other error)");
type Result<T = unknown> = { ok: true; data?: T } | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string> };
const ok = <T>(r: Result<T>) => {
  expect(r, JSON.stringify(r)).toMatchObject({ ok: true });
  return (r as { ok: true; data: T }).data;
};

const newOrg = (slug: string, over: Record<string, unknown> = {}) => ({
  companyName: `${slug} Trading`,
  storeName: `${slug} Store`,
  storeSlug: slug,
  storeDescription: "",
  contactPhone: "",
  address: "",
  ownerName: `${slug} Owner`,
  ownerEmail: `owner@${slug}.test`,
  ownerPassword: "initial-pass-1",
  ...over,
});
const auditActions = async (orgId: string) => (await q<{ action: string }>("select action from admin_audit_logs where organization_id = $1 order by created_at, id", [orgId])).map((r) => r.action);

beforeAll(async () => {
  pg = await createDb();
  h.pg = pg;
  h.orm = drizzle(pg, { schema: dbSchema }) as unknown as Database;
  boss = await createPlatformAdmin(pg, "boss@example.test", "super_admin");
  limiter = await createPlatformAdmin(pg, "limiter@example.test", "super_admin");
  alice = await createUser(pg, "alice@example.test", "Alice");
  await provision(pg, boss, alice, "alpha-shop", { tenant: "Alpha Inc" });
});
afterAll(async () => pg.close());
beforeEach(() => {
  h.adminCalls.length = 0;
  h.storageCalls.length = 0;
  h.ip = "203.0.113.7";
  h.logs.length = 0;
});

describe("signing in and the admin area", () => {
  it("keeps signed-out visitors and ordinary users out of the admin area, and lets an admin in", async () => {
    expect(await redirectedTo(as(null, () => requirePlatformAdminPage()))).toBe("/login");
    expect(await redirectedTo(as(alice, () => requirePlatformAdminPage()))).toBe("/dashboard"); // an organization owner is not an admin
    expect(await as(boss, () => requirePlatformAdminPage())).toEqual({ id: boss });
  });

  it("signs in with the right password, and refuses the wrong one without saying which part was wrong", async () => {
    h.signIn = async ({ password }) => (password === "right-pass-1" ? { error: null } : { error: { code: "invalid_credentials", status: 400, message: "Invalid login credentials" } });
    expect(await redirectedTo(as(null, () => loginAction({ email: "boss@example.test", password: "right-pass-1" })))).toBe("/dashboard");
    const bad = await as(null, () => loginAction({ email: "boss@example.test", password: "wrong-pass-1" }));
    expect(bad).toMatchObject({ ok: false, code: "UNAUTHENTICATED", error: "Incorrect email or password." });
  });

  it("slows down guessing: 8 attempts per address and e-mail, then refuses even the right password, and stores no raw address or e-mail", async () => {
    const signIn = vi.fn(async ({ password }: { password: string }) => (password === "right-pass-1" ? { error: null } : { error: { code: "invalid_credentials", status: 400, message: "bad" } }));
    h.signIn = signIn;
    h.ip = "198.51.100.20";
    const attempt = (email: string, password: string) => as(null, () => loginAction({ email, password }));
    const results = [];
    for (let i = 0; i < 8; i++) results.push((await attempt("victim@example.test", "guess-pass-1")) as { code?: string });
    expect(results.every((r) => r.code === "UNAUTHENTICATED")).toBe(true);
    signIn.mockClear();
    const blocked = (await attempt("victim@example.test", "right-pass-1")) as { ok: boolean; code?: string; error?: string };
    expect(blocked).toMatchObject({ ok: false, code: "RATE_LIMITED" });
    expect(blocked.error).toMatch(/Too many requests\. Please wait about \d+ (minutes|seconds)/);
    expect(signIn).not.toHaveBeenCalled(); // the password was never even checked
    // another e-mail from the same address is still allowed (the address allowance is 40), and the same e-mail from another address too
    expect(await redirectedTo(attempt("someone.else@example.test", "right-pass-1"))).toBe("/dashboard");
    h.ip = "198.51.100.21";
    expect(await redirectedTo(attempt("victim@example.test", "right-pass-1"))).toBe("/dashboard");

    const keys = await q<{ key: string }>("select key from rate_limits where key like 'login:%'");
    expect(keys.length).toBeGreaterThan(0);
    for (const k of keys) expect(k.key).toMatch(/^login:(email|ip):[0-9a-f]{64}$/);
    expect(JSON.stringify(keys)).not.toMatch(/198\.51|victim|example\.test/);
  });

  it("starts again in the next window", async () => {
    h.ip = "198.51.100.22";
    h.signIn = async () => ({ error: { code: "invalid_credentials", status: 400, message: "bad" } });
    for (let i = 0; i < 9; i++) await as(null, () => loginAction({ email: "window@example.test", password: "guess-pass-1" }));
    expect(await as(null, () => loginAction({ email: "window@example.test", password: "guess-pass-1" }))).toMatchObject({ code: "RATE_LIMITED" });
    await q("update rate_limits set window_start = window_start - interval '1 hour' where key like 'login:%'");
    expect(await as(null, () => loginAction({ email: "window@example.test", password: "guess-pass-1" }))).toMatchObject({ code: "UNAUTHENTICATED" });
  });
});

describe("an organization from creation to deletion", () => {
  let tenantId: string;
  let ownerId: string;

  it("creates an organization with its store and owner, which then appears in the list and the overview", async () => {
    const before = (await as(boss, () => getPlatformOverview())).totalOrganizations;
    const data = ok(await as(boss, () => adminActions.createCompanyAction(newOrg("flow-shop"))));
    tenantId = (data as { tenantId: string }).tenantId;
    expect((data as { ownerEmail: string }).ownerEmail).toBe("owner@flow-shop.test");
    ownerId = (await q<{ id: string }>("select id from auth.users where email = 'owner@flow-shop.test'"))[0].id;
    const found = (await as(boss, () => getCompany(tenantId)))!;
    expect(found.company).toMatchObject({ name: "flow-shop Trading", status: "active", ownerEmail: "owner@flow-shop.test" });
    expect(found.store).toMatchObject({ name: "flow-shop Store", status: "active", currency: "INR" });
    expect((await as(boss, () => getPlatformOverview())).totalOrganizations).toBe(before + 1);
    expect(await auditActions(tenantId)).toEqual(["organization.created"]);
  });

  it("rejects a bad form without creating anything", async () => {
    const r = await as(boss, () => adminActions.createCompanyAction(newOrg("bad-form", { ownerPassword: "short", storeSlug: "admin" })));
    expect(r).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(await q("select 1 from tenants where slug = 'bad-form'")).toHaveLength(0);
    expect(calls("createUser")).toHaveLength(0);
  });

  it("finds organizations by search and pages through them, with the filters kept", async () => {
    for (let i = 1; i <= 24; i++) await provision(pg, boss, await createUser(pg, `p${i}@paging.test`), `page-shop-${String(i).padStart(2, "0")}`, { tenant: `Paging Shop ${String(i).padStart(2, "0")}` });
    await q("update tenants set status = 'suspended' where name like 'Paging Shop 0%'"); // 9 suspended
    const base = { q: "", status: "all", sort: "name", dir: "asc", page: 1, pageSize: 10 } as const;
    const p1 = await as(boss, () => listCompaniesPage({ ...base, q: "Paging" }));
    const p3 = await as(boss, () => listCompaniesPage({ ...base, q: "Paging", page: 3 }));
    expect(p1.total).toBe(24);
    expect([p1.items.length, p3.items.length]).toEqual([10, 4]);
    expect(p1.items.map((o) => o.name)).toEqual([...p1.items.map((o) => o.name)].sort());
    const suspended = await as(boss, () => listCompaniesPage({ ...base, q: "Paging", status: "suspended", pageSize: 100 }));
    expect(suspended.total).toBe(9);
    expect(suspended.items.every((o) => o.status === "suspended")).toBe(true);
    const clamped = await as(boss, () => listCompaniesPage({ ...base, q: "Paging", page: 99 }));
    expect(clamped.page).toBe(3); // an old link past the end shows the last real page
    expect((await as(boss, () => listCompaniesPage({ ...base, q: "page-shop-07" }))).items.map((o) => o.name)).toEqual(["Paging Shop 07"]); // by address too
  });

  it("edits the organization and its store through the forms' actions", async () => {
    ok(await as(boss, () => adminActions.updateCompanyAction(tenantId, { companyName: "Flow Trading Ltd", contactPhone: "+91 98765 43210", address: "12 Market Road" })));
    ok(await as(boss, () => adminActions.updateCompanyStoreAction(tenantId, { name: "Flow Shop", description: "Fine goods", contactEmail: "hello@flow.test", contactPhone: "", currency: "USD", timezone: "America/New_York" })));
    const after = (await as(boss, () => getCompany(tenantId)))!;
    expect(after.company).toMatchObject({ name: "Flow Trading Ltd", contactPhone: "+91 98765 43210", address: "12 Market Road" });
    expect(after.store).toMatchObject({ name: "Flow Shop", currency: "USD", timezone: "America/New_York", contactEmail: "hello@flow.test" });
    // a bad edit is refused and changes nothing
    expect(await as(boss, () => adminActions.updateCompanyAction(tenantId, { companyName: "X", contactPhone: "", address: "" }))).toMatchObject({ ok: false, code: "VALIDATION" });
    expect((await as(boss, () => getCompany(tenantId)))!.company.name).toBe("Flow Trading Ltd");
  });

  it("suspends and reactivates the organization, and its members lose and regain access", async () => {
    const member = ok(await as(boss, () => adminActions.addCompanyMemberAction(tenantId, { fullName: "Mia Member", email: "mia@flow.test", password: "initial-pass-1", permissions: READ_ONLY }))) as { email: string };
    expect(member.email).toBe("mia@flow.test");
    const hasAccess = async () => (await as(ownerId, async () => (await q("select 1")).length, )) && (await q<{ ok: boolean }>("select exists (select 1 from memberships m join tenants t on t.id = m.tenant_id where m.user_id = $1 and m.status = 'active' and t.status = 'active') ok", [ownerId]))[0].ok;
    expect(await hasAccess()).toBe(true);
    ok(await as(boss, () => adminActions.setCompanyStatusAction(tenantId, "suspended")));
    expect(await hasAccess()).toBe(false);
    ok(await as(boss, () => adminActions.setCompanyStatusAction(tenantId, "active")));
    expect(await hasAccess()).toBe(true);
    expect(await auditActions(tenantId)).toEqual(expect.arrayContaining(["organization.suspended", "organization.reactivated"]));
  });

  it("disables, reactivates and removes a team member, and refuses to touch the owner", async () => {
    const miaId = (await q<{ id: string }>("select id from auth.users where email = 'mia@flow.test'"))[0].id;
    ok(await as(boss, () => adminActions.setCompanyMemberStatusAction(tenantId, miaId, "disabled")));
    expect((await q<{ status: string }>("select status from memberships where user_id = $1", [miaId]))[0].status).toBe("disabled");
    ok(await as(boss, () => adminActions.setCompanyMemberStatusAction(tenantId, miaId, "active")));
    expect(await as(boss, () => adminActions.setCompanyMemberStatusAction(tenantId, ownerId, "disabled"))).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(await as(boss, () => adminActions.removeCompanyMemberAction(tenantId, ownerId))).toMatchObject({ ok: false, code: "VALIDATION" });
    ok(await as(boss, () => adminActions.removeCompanyMemberAction(tenantId, miaId)));
    expect(await q("select 1 from auth.users where id = $1", [miaId])).toHaveLength(0); // her only organization: sign-in deleted too
    expect((await q("select 1 from memberships where tenant_id = $1 and role = 'owner'", [tenantId])).length).toBe(1);
  });

  it("transfers ownership to another member atomically, and recovers an organization that lost its owner", async () => {
    ok(await as(boss, () => adminActions.addCompanyMemberAction(tenantId, { fullName: "Nia Next", email: "nia@flow.test", password: "initial-pass-1", permissions: READ_ONLY })));
    const niaId = (await q<{ id: string }>("select id from auth.users where email = 'nia@flow.test'"))[0].id;
    ok(await as(boss, () => adminActions.transferCompanyOwnershipAction(tenantId, { userId: niaId, previousOwner: "keep" })));
    expect((await q<{ user_id: string }>("select user_id from memberships where tenant_id = $1 and role = 'owner'", [tenantId])).map((r) => r.user_id)).toEqual([niaId]);
    expect((await q<{ role: string }>("select role from memberships where user_id = $1", [ownerId]))[0].role).toBe("admin"); // the old owner stays on as a member
    // the owner's account disappears: nobody owns the organization, and a new owner is appointed
    await q("delete from memberships where tenant_id = $1 and role = 'owner'", [tenantId]);
    const recovered = ok(await as(boss, () => adminActions.recoverCompanyOwnerAction(tenantId, { ownerName: "Rae Recovery", ownerEmail: "rae@flow.test", ownerPassword: "recover-pass-123", previousOwner: "keep" }))) as { email: string };
    expect(recovered.email).toBe("rae@flow.test");
    expect(await q("select 1 from memberships m join auth.users u on u.id = m.user_id where m.tenant_id = $1 and m.role = 'owner' and u.email = 'rae@flow.test'", [tenantId])).toHaveLength(1);
  });

  it("recorded every one of those steps in the audit log, newest first, with filters, and never a password", async () => {
    const all = await as(boss, () => listAuditLogs({ action: "all", admin: "all", org: tenantId, q: "", from: "", to: "", page: 1, pageSize: 100 }));
    const actions = all.rows.map((r) => r.action);
    for (const expected of ["organization.created", "organization.updated", "store.updated", "organization.suspended", "organization.reactivated", "team_member.added", "team_member.disabled", "team_member.reactivated", "team_member.removed", "ownership.transferred"]) {
      expect(actions, expected).toContain(expected);
    }
    const times = all.rows.map((r) => r.createdAt.getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a)); // newest first
    expect(all.rows.every((r) => r.adminUserId === boss)).toBe(true);
    const one = await as(boss, () => listAuditLogs({ action: "ownership.transferred", admin: boss, org: "", q: "Flow", from: "", to: "", page: 1, pageSize: 10 }));
    expect(one.rows.map((r) => r.action)).toEqual(["ownership.transferred", "ownership.transferred"]); // the transfer and the recovery
    const today = new Date().toISOString().slice(0, 10);
    expect((await as(boss, () => listAuditLogs({ action: "all", admin: "all", org: tenantId, q: "", from: today, to: today, page: 1, pageSize: 100 }))).total).toBe(all.total);
    expect((await as(boss, () => listAuditLogs({ action: "all", admin: "all", org: tenantId, q: "", from: "2020-01-01", to: "2020-01-02", page: 1, pageSize: 100 }))).total).toBe(0);
    expect((await as(boss, () => listAuditAdmins())).map((a) => a.id)).toContain(boss);
    expect(JSON.stringify(all.rows)).not.toMatch(/initial-pass|recover-pass|password/i);
  });

  it("deletes the organization exactly as before: its data and the accounts that belonged only to it go, and deletion is not audited", async () => {
    const auditBefore = (await auditActions(tenantId)).length;
    h.adminCalls.length = 0;
    ok(await as(boss, () => adminActions.deleteCompanyAction(tenantId)));
    expect(await q("select 1 from tenants where id = $1", [tenantId])).toHaveLength(0);
    expect(await q("select 1 from memberships where tenant_id = $1", [tenantId])).toHaveLength(0);
    expect(calls("deleteUser").length).toBeGreaterThanOrEqual(2); // the people who belonged only to this organization
    expect(h.storageCalls).toEqual([[tenantId]]);
    expect((await auditActions(tenantId)).length).toBe(auditBefore); // unchanged behaviour: its earlier entries survive, none was added
    expect(await q("select 1 from admin_audit_logs where organization_id = $1", [tenantId])).not.toHaveLength(0);
  });
});

describe("rate limits on sensitive actions", () => {
  it("allows 10 organization creations per 10 minutes, then refuses the next with a clear message and creates nothing", async () => {
    const results = [];
    for (let i = 1; i <= 11; i++) results.push((await as(limiter, () => adminActions.createCompanyAction(newOrg(`rl-shop-${i}`)))) as Result);
    expect(results.slice(0, 10).every((r) => r.ok)).toBe(true);
    const refused = results[10] as { ok: false; code: string; error: string };
    expect(refused).toMatchObject({ ok: false, code: "RATE_LIMITED" });
    expect(refused.error).toMatch(/^Too many requests\. Please wait about \d+ (minutes|seconds) and try again\.$/);
    expect(await q("select 1 from tenants where slug = 'rl-shop-11'")).toHaveLength(0);
    expect(calls("createUser")).toHaveLength(10); // the refused attempt never created an account
  });

  it("keeps each admin and each kind of operation separate", async () => {
    // `limiter` is out of organization creations, but not out of anything else
    expect(await as(limiter, () => adminActions.createCompanyAction(newOrg("rl-shop-x")))).toMatchObject({ code: "RATE_LIMITED" });
    const tenant = (await q<{ id: string }>("select id from tenants where slug = 'rl-shop-1'"))[0].id;
    ok(await as(limiter, () => adminActions.updateCompanyAction(tenant, { companyName: "Still Editable", contactPhone: "", address: "" })));
    // another admin is not affected by it
    ok(await as(boss, () => adminActions.createCompanyAction(newOrg("rl-other-admin"))));
  });

  it("limits deletion to 5 per 10 minutes without changing what deletion does", async () => {
    const ids: string[] = [];
    for (let i = 1; i <= 6; i++) ids.push((await q<{ id: string }>("select id from tenants where slug = $1", [`rl-shop-${i}`]))[0].id);
    const results = [];
    for (const id of ids) results.push((await as(limiter, () => adminActions.deleteCompanyAction(id))) as Result);
    expect(results.slice(0, 5).every((r) => r.ok)).toBe(true);
    expect(results[5]).toMatchObject({ ok: false, code: "RATE_LIMITED" });
    expect(await q("select 1 from tenants where id = $1", [ids[5]])).toHaveLength(1); // the refused one is still there
    expect(await q("select 1 from tenants where id = any($1::uuid[])", [ids.slice(0, 5)])).toHaveLength(0);
  });

  it("starts fresh in the next window", async () => {
    expect(await as(limiter, () => adminActions.createCompanyAction(newOrg("rl-after-window")))).toMatchObject({ code: "RATE_LIMITED" });
    await q("update rate_limits set window_start = window_start - interval '1 hour' where key like 'org.create:%'");
    ok(await as(limiter, () => adminActions.createCompanyAction(newOrg("rl-after-window"))));
  });

  it("writes one structured log line per action, and a warning when it refuses, without any input in it", async () => {
    const lines: string[] = [];
    const spies = (["log", "warn", "error"] as const).map((m) => vi.spyOn(console, m).mockImplementation((l: string) => void lines.push(String(l))));
    const target = crypto.randomUUID();
    try {
      await as(limiter, () => adminActions.deleteCompanyAction(target)); // this admin has used up their deletions above
      await as(boss, () => adminActions.setCompanyStatusAction(target, "suspended")); // an allowed attempt that then fails (no such organization)
    } finally {
      spies.forEach((s) => s.mockRestore());
    }
    const events = lines.map((l) => JSON.parse(l) as Record<string, unknown>);
    expect(events.map((e) => e.event)).toEqual(["rate_limited", "action", "action"]);
    expect(events[0]).toMatchObject({ level: "warn", bucket: "org.delete" });
    expect(events[1]).toMatchObject({ operation: "admin.org.delete", outcome: "failed", code: "RATE_LIMITED" });
    expect(events[2]).toMatchObject({ operation: "admin.org.set_status", outcome: "failed", code: "NOT_FOUND" });
    expect(lines.join(" ")).not.toContain(target); // the input (the organization id) is never logged
  });
});

describe("nobody but a Platform Admin can use any admin action", () => {
  const actionFns = Object.entries(adminActions).filter(([, fn]) => typeof fn === "function") as [string, (...a: unknown[]) => Promise<Result>][];

  it("covers every exported action (a new one is picked up automatically)", () => {
    expect(actionFns.length).toBeGreaterThanOrEqual(14);
  });

  it("refuses an organization owner from every action with FORBIDDEN, before doing anything or counting a limit", async () => {
    const before = (await q<{ n: number }>("select count(*)::int n from admin_audit_logs"))[0].n;
    const tenant = (await q<{ id: string }>("select id from tenants where slug = 'alpha-shop'"))[0].id;
    const failures: string[] = [];
    for (const [name, fn] of actionFns) {
      const r = await as(alice, () => fn(tenant, { any: "thing" }, "x"));
      if (r.ok || r.code !== "FORBIDDEN") failures.push(`${name}: ${JSON.stringify(r)}`);
    }
    expect(failures).toEqual([]);
    expect((await q<{ n: number }>("select count(*)::int n from admin_audit_logs"))[0].n).toBe(before);
    expect(await q("select 1 from rate_limits where key like $1", [`%:${alice}`])).toHaveLength(0);
    expect(calls("createUser")).toHaveLength(0);
  });

  it("refuses a signed-out caller from every action with UNAUTHENTICATED", async () => {
    const failures: string[] = [];
    for (const [name, fn] of actionFns) {
      const r = await as(null, () => fn(crypto.randomUUID(), {}, "x"));
      if (r.ok || r.code !== "UNAUTHENTICATED") failures.push(`${name}: ${JSON.stringify(r)}`);
    }
    expect(failures).toEqual([]);
  });

  it("only a super admin can manage admins and the settings; an ordinary admin is refused even though they are an admin", async () => {
    const plain = await createPlatformAdmin(pg, "plain@example.test", "admin");
    const settings = { platformName: "Hacked", supportEmail: "", defaultCurrency: "INR", defaultTimezone: "Asia/Kolkata", defaultStoreStatus: "active" };
    expect(await as(plain, () => adminActions.addPlatformAdminAction({ fullName: "New Admin", email: "na@example.test", password: "initial-pass-1", role: "admin" }))).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(await as(plain, () => adminActions.updatePlatformSettingsAction(settings))).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(await as(plain, () => adminActions.removePlatformAdminAction(boss))).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(await q("select 1 from platform_settings where platform_name = 'Hacked'")).toHaveLength(0);
    expect(await q("select 1 from auth.users where email = 'na@example.test'")).toHaveLength(0);
    // ...while a super admin can
    ok(await as(boss, () => adminActions.updatePlatformSettingsAction({ ...settings, platformName: "Acme Commerce" })));
    expect((await q<{ platform_name: string }>("select platform_name from platform_settings"))[0].platform_name).toBe("Acme Commerce");
  });
});
