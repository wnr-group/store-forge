import type { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { asAppConnection, createDb, createPlatformAdmin, createUser, provision } from "./harness";

/**
 * Company and team provisioning end to end: the REAL services, tenant context, RLS and SQL
 * functions on PGlite. Only the edges are replaced: the Supabase session, Next.js, and the Admin
 * Auth API (a fake that writes to auth.users like the real one, so cleanup can be asserted).
 */
const h = vi.hoisted(() => ({
  user: null as { id: string } | null,
  orm: null as unknown,
  cookie: undefined as string | undefined,
  pg: null as unknown,
  adminCalls: [] as Array<{ fn: string; args: unknown }>,
  storageCalls: [] as unknown[][],
  createUserError: null as null | { code: string; status: number; message: string },
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: async () => h.user,
  requireUser: async () => h.user,
}));
vi.mock("@/lib/db", async (orig) => ({ ...(await orig<typeof import("@/lib/db")>()), getDatabase: () => h.orm }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (h.cookie ? { value: h.cookie } : undefined), set: vi.fn() }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;replace;${url};307;` });
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

/** Runs `fn` on the privileged session (auth.users is not reachable as storeforge_app), then restores the app role. */
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

vi.mock("@/lib/storage/server", () => ({ removeTenantObjects: (...args: unknown[]) => { h.storageCalls.push(args); return Promise.resolve(); } }));

vi.mock("@/lib/supabase/admin", () => ({
  getAdminAuthClient: () => ({
    auth: {
      admin: {
        createUser: async (args: { email: string; user_metadata?: { full_name?: string } }) => {
          h.adminCalls.push({ fn: "createUser", args });
          if (h.createUserError) return { data: { user: null }, error: h.createUserError };
          return privileged(async (pg) => {
            const dup = await pg.query("select 1 from auth.users where email = $1", [args.email]);
            if (dup.rows.length) return { data: { user: null }, error: { code: "email_exists", status: 422, message: "A user with this email address has already been registered" } };
            const { rows } = await pg.query<{ id: string }>(
              "insert into auth.users (email, raw_user_meta_data) values ($1, $2::jsonb) returning id",
              [args.email, JSON.stringify(args.user_metadata ?? {})],
            );
            return { data: { user: { id: rows[0].id, email: args.email } }, error: null };
          });
        },
        updateUserById: async (id: string, attrs: unknown) => {
          h.adminCalls.push({ fn: "updateUserById", args: { id, attrs } });
          return { data: {}, error: null };
        },
        deleteUser: async (id: string) => {
          h.adminCalls.push({ fn: "deleteUser", args: { id } });
          await privileged((pg) => pg.query("delete from auth.users where id = $1", [id]));
          return { data: {}, error: null };
        },
      },
    },
  }),
}));

import { dbSchema, type Database } from "@/lib/db";
import { addCompanyMember, createCompany, deleteCompany, getPlatformOverview, listCompaniesPage, setCompanyStatus } from "@/services/platform.service";
import { createMember, listTeam, removeMember, resetMemberPassword, setMemberStatus, updateMember } from "@/services/team.service";

let pg: PGlite;
let admin: string;
let alice: string; // owner of A
let bob: string; // owner of B
let manager: string; // Manager (admin role) in A
let staff: string; // Staff in A
let tenantA: string;
let tenantB: string;

const as = async <T>(user: string | null, fn: () => Promise<T>, cookie?: string): Promise<T> => {
  h.user = user ? { id: user } : null;
  h.cookie = cookie;
  return asAppConnection(pg, fn);
};
const calls = (fn: string) => h.adminCalls.filter((c) => c.fn === fn);
const q = <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => privileged(async (p) => (await p.query<T>(sql, params)).rows);

const ALL_ORGS = { q: "", status: "all", sort: "created", dir: "desc", page: 1, pageSize: 100 } as const;

const company = (slug: string, email: string) => ({
  companyName: "Gamma Trading", storeName: "Gamma Store", storeSlug: slug, storeDescription: null, contactPhone: null, address: null,
  ownerName: "Gita Owner", ownerEmail: email, ownerPassword: "initial-pass-1",
});

beforeAll(async () => {
  pg = await createDb();
  h.pg = pg;
  h.orm = drizzle(pg, { schema: dbSchema }) as unknown as Database;
  [alice, bob, manager, staff] = await Promise.all(["alice", "bob", "manager", "staff"].map((n) => createUser(pg, `${n}@example.test`, n)));
  admin = await createPlatformAdmin(pg);
  tenantA = (await provision(pg, admin, alice, "alpha-shop")).tenant_id;
  tenantB = (await provision(pg, admin, bob, "beta-shop")).tenant_id;
  await pg.query("insert into memberships (tenant_id, user_id, role, permissions) values ($1,$2,'admin','{\"products\":\"write\",\"orders\":\"write\",\"customers\":\"write\",\"settings\":\"write\"}'), ($1,$3,'staff','{\"products\":\"write\",\"orders\":\"read\",\"customers\":\"write\",\"settings\":\"read\"}')", [tenantA, manager, staff]);
});
afterAll(async () => pg.close());
beforeEach(() => {
  h.adminCalls.length = 0;
  h.createUserError = null;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("createCompany (Platform Admin)", () => {
  it("creates a confirmed owner account, the tenant, the store and the owner membership, linked together", async () => {
    const res = await as(admin, () => createCompany(company("gamma-shop", "gita@gamma.test")));

    const [create] = calls("createUser");
    expect(create.args).toMatchObject({ email: "gita@gamma.test", email_confirm: true, app_metadata: { provisioned: true }, user_metadata: { full_name: "Gita Owner" } });

    const [row] = await q<{ role: string; status: string; tenant: string; store_tenant: string; full_name: string; created_by: string }>(
      `select m.role, m.status, t.id tenant, s.tenant_id store_tenant, p.full_name, t.created_by
       from memberships m join tenants t on t.id = m.tenant_id join stores s on s.tenant_id = t.id
       join profiles p on p.id = m.user_id where m.user_id = $1`,
      [res.ownerId],
    );
    expect(row).toEqual({ role: "owner", status: "active", tenant: res.tenantId, store_tenant: res.tenantId, full_name: "Gita Owner", created_by: res.ownerId });
  });

  it("refuses a regular user, a tenant Owner and a signed-out caller before touching the Auth API", async () => {
    for (const user of [alice, manager, staff]) {
      await expect(as(user, () => createCompany(company("nope-shop", "nope@x.test")))).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    await expect(as(null, () => createCompany(company("nope-shop", "nope@x.test")))).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    expect(calls("createUser")).toHaveLength(0);
    expect(await q("select 1 from auth.users where email = 'nope@x.test'")).toHaveLength(0);
  });

  it("rejects a taken store address before creating any Auth user", async () => {
    await expect(as(admin, () => createCompany(company("alpha-shop", "dupe-store@x.test")))).rejects.toMatchObject({ code: "CONFLICT", fieldErrors: { storeSlug: expect.any(String) } });
    expect(calls("createUser")).toHaveLength(0);
  });

  it("reports a duplicate owner e-mail and creates nothing", async () => {
    const before = (await q<{ n: number }>("select count(*)::int n from tenants"))[0].n;
    await expect(as(admin, () => createCompany(company("dupe-owner-shop", "alice@example.test")))).rejects.toMatchObject({ code: "CONFLICT", fieldErrors: { email: expect.any(String) } });
    expect(calls("deleteUser")).toHaveLength(0); // nothing of ours to clean up: the existing account is never touched
    expect((await q<{ n: number }>("select count(*)::int n from tenants"))[0].n).toBe(before);
    expect(await q("select 1 from stores where slug = 'dupe-owner-shop'")).toHaveLength(0);
  });

  it("deletes the just-created Auth user when the database step fails (no orphaned account or tenant)", async () => {
    await pg.exec(`
      create function public.test_boom() returns trigger language plpgsql as $$ begin raise exception 'boom'; end $$;
      create trigger test_boom before insert on public.stores for each row execute function public.test_boom();
    `);
    try {
      await expect(as(admin, () => createCompany(company("boom-shop", "boom@x.test")))).rejects.toBeDefined();
    } finally {
      await pg.exec("drop trigger test_boom on public.stores; drop function public.test_boom();");
    }
    const [created] = calls("createUser");
    const [deleted] = calls("deleteUser");
    expect(created).toBeDefined();
    expect(deleted).toBeDefined();
    expect(await q("select 1 from auth.users where email = 'boom@x.test'")).toHaveLength(0);
    expect(await q("select 1 from profiles p join auth.users u on u.id = p.id where u.email = 'boom@x.test'")).toHaveLength(0);
    expect(await q("select 1 from tenants where slug = 'boom-shop'")).toHaveLength(0);
    expect(await q("select 1 from stores where slug = 'boom-shop'")).toHaveLength(0);
    // Retry after the failure now succeeds with the same e-mail (the address was released).
    await expect(as(admin, () => createCompany(company("boom-shop", "boom@x.test")))).resolves.toMatchObject({ ownerEmail: "boom@x.test" });
  });

  it("lists companies for the admin only", async () => {
    const list = (await as(admin, () => listCompaniesPage(ALL_ORGS))).items;
    expect(list.map((c) => c.storeSlug)).toEqual(expect.arrayContaining(["alpha-shop", "beta-shop", "gamma-shop"]));
    await expect(as(alice, () => listCompaniesPage(ALL_ORGS))).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

const READ_ONLY = { products: "read", orders: "read", customers: "read", settings: "read" } as const;
const FULL = { products: "write", orders: "read", customers: "write", settings: "write" } as const; // orders are read-only for now

describe("createMember (company Owner)", () => {
  // Deliberately loosely typed: several tests send values the browser could send but the type forbids.
  const input = (over: Record<string, unknown> = {}) => ({ fullName: "Nina New", email: "nina@alpha.test", password: "initial-pass-1", permissions: READ_ONLY, ...over }) as never;

  it("creates a confirmed account and links it to the Owner's tenant with the chosen role", async () => {
    const res = await as(alice, () => createMember(input()), tenantA);
    expect(calls("createUser")[0].args).toMatchObject({ email: "nina@alpha.test", email_confirm: true });
    const [m] = await q<{ tenant_id: string; role: string; status: string; full_name: string }>(
      "select m.tenant_id, m.role, m.status, p.full_name from memberships m join profiles p on p.id = m.user_id where m.user_id = $1",
      [res.userId],
    );
    expect(m).toEqual({ tenant_id: tenantA, role: "admin", status: "active", full_name: "Nina New" });
    const team = await as(alice, () => listTeam(), tenantA);
    expect(team.map((t) => t.email)).toContain("nina@alpha.test");
  });

  it("can create a Manager", async () => {
    const res = await as(alice, () => createMember(input({ email: "mia@alpha.test", fullName: "Mia Manager", permissions: FULL })), tenantA);
    expect((await q<{ role: string }>("select role from memberships where user_id = $1", [res.userId]))[0].role).toBe("admin");
  });

  it.each(["owner", "platform_admin", "superadmin"])("ignores a role (%s) sent from the browser: members are never owners", async (role) => {
    const res = await as(alice, () => createMember(input({ email: `r-${role}@alpha.test`, role })), tenantA);
    expect((await q<{ role: string }>("select role from memberships where user_id = $1", [res.userId]))[0].role).toBe("admin");
  });

  it.each([
    ["an unknown level", { ...READ_ONLY, products: "admin" }],
    ["write on orders", { ...READ_ONLY, orders: "write" }],
    ["no access level for a module", { products: "read", orders: "read", customers: "read" }],
    ["no store settings access", { ...READ_ONLY, settings: "none" }],
  ])("refuses permissions with %s", async (_label, permissions) => {
    await expect(as(alice, () => createMember(input({ email: "bad-perm@alpha.test", permissions })), tenantA)).rejects.toMatchObject({ code: "VALIDATION" });
    expect(calls("createUser")).toHaveLength(0);
  });

  it("refuses Managers, Staff, other companies' Owners' targets and outsiders from creating members for tenant A", async () => {
    for (const user of [manager, staff]) {
      await expect(as(user, () => createMember(input({ email: `by-${user}@alpha.test` })), tenantA)).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(calls("createUser")).toHaveLength(0);
  });

  it("ignores a tenant id supplied by the browser: members land only in the Owner's own tenant", async () => {
    const res = await as(alice, () => createMember(input({ email: "sneaky@alpha.test", tenantId: tenantB }) as never), tenantB /* forged active-tenant cookie */);
    const rows = await q<{ tenant_id: string }>("select tenant_id from memberships where user_id = $1", [res.userId]);
    expect(rows).toEqual([{ tenant_id: tenantA }]);
    expect(await q("select 1 from memberships where tenant_id = $1 and user_id = $2", [tenantB, res.userId])).toHaveLength(0);
  });

  it("reports a duplicate e-mail without creating or deleting anything", async () => {
    await expect(as(alice, () => createMember(input({ email: "bob@example.test" })), tenantA)).rejects.toMatchObject({ code: "CONFLICT", fieldErrors: { email: expect.any(String) } });
    expect(calls("deleteUser")).toHaveLength(0);
    expect(await q("select 1 from memberships where user_id = $1 and tenant_id = $2", [bob, tenantA])).toHaveLength(0);
  });

  it("deletes the new Auth user if linking it to the tenant fails", async () => {
    await pg.exec(`
      create function public.test_boom() returns trigger language plpgsql as $$ begin raise exception 'boom'; end $$;
      create trigger test_boom before insert on public.memberships for each row execute function public.test_boom();
    `);
    try {
      await expect(as(alice, () => createMember(input({ email: "ghost@alpha.test" })), tenantA)).rejects.toBeDefined();
    } finally {
      await pg.exec("drop trigger test_boom on public.memberships; drop function public.test_boom();");
    }
    expect(calls("deleteUser")).toHaveLength(1);
    expect(await q("select 1 from auth.users where email = 'ghost@alpha.test'")).toHaveLength(0);
  });

  it("a suspended company's Owner cannot create members", async () => {
    await pg.query("update tenants set status = 'suspended' where id = $1", [tenantA]);
    try {
      await expect(as(alice, () => createMember(input({ email: "late@alpha.test" })), tenantA)).rejects.toBeDefined();
      expect(calls("createUser")).toHaveLength(0);
    } finally {
      await pg.query("update tenants set status = 'active' where id = $1", [tenantA]);
    }
  });
});

describe("managing members (company Owner)", () => {
  it("edits name and role, deactivates and reactivates, and removes (deleting the orphaned account)", async () => {
    const { userId } = await as(alice, () => createMember({ fullName: "Edd Edit", email: "edd@alpha.test", password: "initial-pass-1", permissions: READ_ONLY }), tenantA);

    await as(alice, () => updateMember({ userId, fullName: "Edd Edited", permissions: FULL }), tenantA);
    expect((await q("select m.role, p.full_name from memberships m join profiles p on p.id = m.user_id where m.user_id = $1", [userId]))[0]).toEqual({ role: "admin", full_name: "Edd Edited" });
    expect((await q<{ permissions: unknown }>("select permissions from memberships where user_id = $1", [userId]))[0].permissions).toEqual(FULL);
    expect(calls("updateUserById").length).toBeGreaterThan(0);

    await as(alice, () => setMemberStatus(userId, "disabled"), tenantA);
    expect((await q<{ status: string }>("select status from memberships where user_id = $1", [userId]))[0].status).toBe("disabled");
    expect((await as(alice, () => listTeam(), tenantA)).find((m) => m.userId === userId)?.status).toBe("disabled");
    await as(alice, () => setMemberStatus(userId, "active"), tenantA);

    await as(alice, () => resetMemberPassword(userId, "brand-new-pass-1"), tenantA);
    expect(calls("updateUserById").some((c) => JSON.stringify(c.args).includes("brand-new-pass-1"))).toBe(true);

    h.adminCalls.length = 0;
    await as(alice, () => removeMember(userId), tenantA);
    expect(await q("select 1 from memberships where user_id = $1", [userId])).toHaveLength(0);
    expect(calls("deleteUser")).toEqual([{ fn: "deleteUser", args: { id: userId } }]);
    expect(await q("select 1 from auth.users where id = $1", [userId])).toHaveLength(0);
  });

  it("cannot touch the Owner, themselves, or another company's members", async () => {
    const other = (await as(admin, () => createCompany(company("delta-shop", "dee@delta.test")))).ownerId;
    for (const target of [alice, other]) {
      await expect(as(alice, () => setMemberStatus(target, "disabled"), tenantA)).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(as(alice, () => updateMember({ userId: target, fullName: "Hacked", permissions: READ_ONLY }), tenantA)).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(as(alice, () => resetMemberPassword(target, "brand-new-pass-1"), tenantA)).rejects.toMatchObject({ code: "NOT_FOUND" });
    }
    await expect(as(alice, () => removeMember(alice), tenantA)).rejects.toBeDefined();
    await expect(as(alice, () => removeMember(other), tenantA)).rejects.toBeDefined();
    expect(calls("deleteUser")).toHaveLength(0);
    expect(calls("updateUserById").filter((c) => JSON.stringify(c.args).includes("brand-new-pass-1"))).toHaveLength(0);
    expect(await q("select 1 from memberships where user_id = $1", [other])).toHaveLength(1);
  });

  it("Managers and Staff cannot manage the team", async () => {
    for (const user of [manager, staff]) {
      await expect(as(user, () => listTeam(), tenantA)).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(as(user, () => setMemberStatus(staff, "disabled"), tenantA)).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(as(user, () => resetMemberPassword(staff, "brand-new-pass-1"), tenantA)).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(calls("updateUserById")).toHaveLength(0);
  });
});

describe("deleteCompany (Platform Admin)", () => {
  const perms = JSON.stringify({ products: "read", orders: "read", customers: "read", settings: "read" });

  it("deletes the organization, the sign-ins of people who belong only to it, and its files; others keep their account", async () => {
    const owner = (await as(admin, () => createCompany(company("doomed-shop", "doomed@owner.test")))).ownerId;
    const tenant = (await q<{ id: string }>("select tenant_id id from memberships where user_id = $1", [owner]))[0].id;
    const [{ id: only }] = await q<{ id: string }>("insert into auth.users (email) values ('only@doomed.test') returning id");
    await q("insert into memberships (tenant_id, user_id, role, permissions) values ($1,$2,'admin',$3::jsonb), ($1,$4,'admin',$3::jsonb)", [tenant, only, perms, bob]);
    await q("insert into products (tenant_id, name, slug, price_minor) values ($1,'Tee','tee',100)", [tenant]);
    h.adminCalls.length = 0;
    h.storageCalls.length = 0;

    await as(admin, () => deleteCompany(tenant));

    expect(await q("select 1 from tenants where id = $1", [tenant])).toHaveLength(0);
    expect(await q("select 1 from products where tenant_id = $1", [tenant])).toHaveLength(0);
    expect(await q("select 1 from memberships where tenant_id = $1", [tenant])).toHaveLength(0);
    expect(calls("deleteUser").map((c) => (c.args as { id: string }).id).sort()).toEqual([owner, only].sort());
    expect(await q("select 1 from auth.users where id = any($1::uuid[])", [[owner, only]])).toHaveLength(0);
    // bob also owns another organization: still has an account and a membership there
    expect(await q("select 1 from auth.users where id = $1", [bob])).toHaveLength(1);
    expect(await q("select 1 from memberships where user_id = $1 and tenant_id = $2", [bob, tenantB])).toHaveLength(1);
    expect(h.storageCalls).toEqual([[tenant]]);
  });

  it("is refused for everyone but a Platform Admin, and for unknown organizations, deleting nothing", async () => {
    h.storageCalls.length = 0;
    h.adminCalls.length = 0;
    for (const user of [alice, manager, staff]) {
      await expect(as(user, () => deleteCompany(tenantA))).rejects.toBeDefined();
    }
    await expect(as(null, () => deleteCompany(tenantA))).rejects.toBeDefined();
    await expect(as(admin, () => deleteCompany(crypto.randomUUID()))).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await q("select 1 from tenants where id = $1", [tenantA])).toHaveLength(1);
    expect(calls("deleteUser")).toHaveLength(0);
    expect(h.storageCalls).toHaveLength(0);
  });
});

describe("audit trail for Platform Admin actions", () => {
  type Row = { action: string; admin_user_id: string; organization_id: string | null; organization_name: string | null; description: string; previous_data: Record<string, unknown> | null; new_data: Record<string, unknown> | null };
  const logFor = (orgId: string) => q<Row>("select action, admin_user_id, organization_id, organization_name, description, previous_data, new_data from admin_audit_logs where organization_id = $1 order by created_at, id", [orgId]);

  it("records organization creation once, with the administrator, and no password", async () => {
    const res = await as(admin, () => createCompany(company("audited-shop", "audited@owner.test")));
    const rows = await logFor(res.tenantId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action: "organization.created", admin_user_id: admin, organization_name: "Gamma Trading" });
    expect(rows[0].new_data).toMatchObject({ name: "Gamma Trading", storeSlug: "audited-shop", ownerEmail: "audited@owner.test" });
    expect(JSON.stringify(rows[0])).not.toMatch(/initial-pass|password/i);
  });

  it("records suspension and reactivation with the status before and after, and nothing when nothing changed", async () => {
    const { tenantId } = await as(admin, () => createCompany(company("status-shop", "status@owner.test")));
    await as(admin, () => setCompanyStatus(tenantId, "suspended"));
    await as(admin, () => setCompanyStatus(tenantId, "suspended")); // already suspended: no second entry
    await as(admin, () => setCompanyStatus(tenantId, "active"));
    const rows = (await logFor(tenantId)).filter((r) => r.action !== "organization.created");
    expect(rows.map((r) => r.action)).toEqual(["organization.suspended", "organization.reactivated"]);
    expect(rows[0]).toMatchObject({ previous_data: { status: "active" }, new_data: { status: "suspended" } });
    expect(rows[1]).toMatchObject({ previous_data: { status: "suspended" }, new_data: { status: "active" } });
  });

  it("records an added team member with their permissions but never the password", async () => {
    const { tenantId } = await as(admin, () => createCompany(company("member-shop", "member@owner.test")));
    await as(admin, () =>
      addCompanyMember(tenantId, { fullName: "Mia Member", email: "mia@member.test", password: "super-secret-pass-1", permissions: READ_ONLY }),
    );
    const row = (await logFor(tenantId)).find((r) => r.action === "team_member.added");
    expect(row).toMatchObject({ description: "Added team member mia@member.test", new_data: { email: "mia@member.test", fullName: "Mia Member", permissions: READ_ONLY } });
    expect(JSON.stringify(row)).not.toMatch(/super-secret|password/i);
  });

  it("writes nothing when the action fails, and ordinary users cannot act or log", async () => {
    const before = (await q<{ n: number }>("select count(*)::int n from admin_audit_logs"))[0].n;
    await expect(as(admin, () => setCompanyStatus(crypto.randomUUID(), "suspended"))).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(as(alice, () => setCompanyStatus(tenantA, "suspended"))).rejects.toBeDefined();
    await expect(as(alice, () => addCompanyMember(tenantA, { fullName: "No Way", email: "noway@x.test", password: "initial-pass-1", permissions: READ_ONLY }))).rejects.toBeDefined();
    expect((await q<{ n: number }>("select count(*)::int n from admin_audit_logs"))[0].n).toBe(before);
    expect(await q("select 1 from tenants where id = $1 and status = 'active'", [tenantA])).toHaveLength(1);
  });

  it("deleting an organization is unchanged and does not touch the audit log", async () => {
    const { tenantId } = await as(admin, () => createCompany(company("short-lived", "short@owner.test")));
    const before = (await logFor(tenantId)).length;
    await as(admin, () => deleteCompany(tenantId));
    expect(await q("select 1 from tenants where id = $1", [tenantId])).toHaveLength(0);
    expect((await logFor(tenantId)).length).toBe(before); // its earlier entries survive, none was added
  });
});

describe("paged organization list and overview (service)", () => {
  it("returns a page with the total, clamps a page past the end, and is admin-only", async () => {
    const first = await as(admin, () => listCompaniesPage({ q: "", status: "all", sort: "created", dir: "desc", page: 1, pageSize: 10 }));
    expect(first.items.length).toBeLessThanOrEqual(10);
    expect(first.total).toBeGreaterThanOrEqual(first.items.length);
    const past = await as(admin, () => listCompaniesPage({ q: "", status: "all", sort: "created", dir: "desc", page: 999, pageSize: 10 }));
    expect(past.page).toBe(Math.max(1, Math.ceil(first.total / 10)));
    expect(past.items.length).toBeGreaterThan(0);
    const found = await as(admin, () => listCompaniesPage({ q: "member-shop", status: "all", sort: "name", dir: "asc", page: 1, pageSize: 10 }));
    expect(found.items.map((c) => c.storeSlug)).toEqual(["member-shop"]);
    await expect(as(alice, () => listCompaniesPage({ q: "", status: "all", sort: "created", dir: "desc", page: 1, pageSize: 10 }))).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("computes the overview counts in the database", async () => {
    const o = await as(admin, () => getPlatformOverview());
    const counts = (await q<{ total: number; active: number; suspended: number }>("select count(*)::int total, count(*) filter (where status='active')::int active, count(*) filter (where status='suspended')::int suspended from tenants"))[0];
    expect([o.totalOrganizations, o.active, o.suspended]).toEqual([counts.total, counts.active, counts.suspended]);
    expect(o.recent.length).toBeLessThanOrEqual(5);
    await expect(as(alice, () => getPlatformOverview())).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
