import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, createDb, createPlatformAdmin, createUser, onboard, provision } from "./harness";

/**
 * Admin-controlled tenancy, at the database layer (the real migrations on PGlite):
 * who may create companies, who may add team members, suspension / deactivation,
 * and that no role can escalate to Platform Admin or Owner.
 */
let db: PGlite;
let admin: string; // Platform Admin
let alice: string; // owner of A
let bob: string; // owner of B
let manager: string; // 'admin' role (shown as Manager) in A
let staff: string; // staff in A
let outsider: string; // no tenant
let tenantA: string;
let tenantB: string;
let productA: string;
let productB: string;

const q = <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => db.query<T>(sql, params).then((r) => r.rows);
const as = <T>(user: string | null, fn: () => Promise<T>) => asUser(db, user, fn);
const count = async (user: string, sql: string, params: unknown[] = []) => as(user, async () => (await q<{ n: number }>(sql, params))[0].n);

beforeAll(async () => {
  db = await createDb();
  [alice, bob, manager, staff, outsider] = await Promise.all(
    ["alice", "bob", "manager", "staff", "outsider"].map((n) => createUser(db, `${n}@example.test`, n)),
  );
  admin = await createPlatformAdmin(db);
  tenantA = (await provision(db, admin, alice, "alpha-shop")).tenant_id;
  tenantB = (await provision(db, admin, bob, "beta-shop")).tenant_id;
  // Owner adds their team through the same RLS-protected INSERT the app uses.
  await as(alice, async () => {
    await db.query("insert into memberships (tenant_id, user_id, role) values ($1,$2,'admin'), ($1,$3,'staff')", [tenantA, manager, staff]);
  });
  productA = (await q<{ id: string }>("insert into products (tenant_id, name, slug, price_minor) values ($1,'A Product','a-product',100) returning id", [tenantA]))[0].id;
  productB = (await q<{ id: string }>("insert into products (tenant_id, name, slug, price_minor) values ($1,'B Product','b-product',100) returning id", [tenantB]))[0].id;
});

afterAll(async () => db.close());

describe("Platform Admin creates companies", () => {
  it("creates tenant, store and owner membership, all linked and active", async () => {
    const [row] = await q<{ role: string; status: string; t_status: string; store_tenant: string; phone: string | null }>(
      `select m.role, m.status, t.status t_status, s.tenant_id store_tenant, t.contact_phone phone
       from memberships m join tenants t on t.id = m.tenant_id join stores s on s.tenant_id = t.id
       where m.user_id = $1 and t.id = $2`,
      [alice, tenantA],
    );
    expect(row).toEqual({ role: "owner", status: "active", t_status: "active", store_tenant: tenantA, phone: null });
  });

  it("stores optional company details", async () => {
    const owner = await createUser(db, "gamma-owner@example.test");
    const r = await as(admin, () =>
      db.query<{ r: { tenant_id: string } }>(
        "select public.platform_provision_tenant($1,'Gamma Co','Gamma Store','gamma-shop','A shop','+91 98765 43210','12 Market Road') as r",
        [owner],
      ),
    );
    const [t] = await q<{ contact_phone: string; address: string }>("select contact_phone, address from tenants where id = $1", [r.rows[0].r.tenant_id]);
    expect(t).toEqual({ contact_phone: "+91 98765 43210", address: "12 Market Road" });
  });

  it("is invisible to ordinary users: only the Platform Admin can list companies", async () => {
    expect((await as(admin, () => q("select * from public.platform_list_tenants(null)"))).length).toBeGreaterThanOrEqual(2);
    for (const user of [alice, manager, staff, outsider]) {
      await expect(as(user, () => q("select * from public.platform_list_tenants(null)"))).rejects.toThrow(/not_platform_admin/);
    }
  });

  it("the Platform Admin sees company metadata and owner e-mail but no merchant data", async () => {
    const [row] = await as(admin, () => q<{ owner_email: string; member_count: string }>("select owner_email, member_count from public.platform_list_tenants($1)", [tenantA]));
    expect(row).toMatchObject({ owner_email: "alice@example.test" });
    expect(Number(row.member_count)).toBe(3);
    // No grants on tenant data tables: even as `authenticated`, the admin has no membership, so RLS returns nothing.
    expect(await count(admin, "select count(*)::int n from products")).toBe(0);
    expect(await count(admin, "select count(*)::int n from stores")).toBe(0);
    expect(await count(admin, "select count(*)::int n from memberships")).toBe(0);
  });
});

describe("no privilege escalation", () => {
  it("nobody can write to platform_admins through the API", async () => {
    for (const user of [alice, manager, staff, outsider, admin]) {
      await expect(as(user, () => db.query("insert into platform_admins (user_id) values ($1)", [user]))).rejects.toThrow(/permission denied/);
      await expect(as(user, () => q("select * from platform_admins"))).rejects.toThrow(/permission denied/);
    }
  });

  it("is_platform_admin() is true only for the admin; a tenant Owner is not one", async () => {
    const is = (user: string) => as(user, async () => (await q<{ ok: boolean }>("select public.is_platform_admin() ok"))[0].ok);
    expect(await is(admin)).toBe(true);
    for (const user of [alice, bob, manager, staff, outsider]) expect(await is(user), user).toBe(false);
  });

  it("a Platform Admin can never be a tenant member, and vice versa", async () => {
    await expect(as(alice, () => db.query("insert into memberships (tenant_id, user_id, role) values ($1,$2,'staff')", [tenantA, admin]))).rejects.toThrow(/platform_admin_cannot_be_member/);
    await expect(db.query("insert into platform_admins (user_id) values ($1)", [staff])).rejects.toThrow(/member_cannot_be_platform_admin/);
  });

  it("members cannot create tenants, even by naming themselves owner", async () => {
    for (const user of [alice, manager, staff, outsider]) {
      await expect(as(user, () => db.query("select public.platform_provision_tenant($1,'Mine','Mine','mine-shop')", [user]))).rejects.toThrow(/not_platform_admin/);
      await expect(as(user, () => db.query("insert into tenants (name, slug) values ('Mine','mine-shop')"))).rejects.toThrow(/permission denied/);
    }
    expect(await q("select 1 from tenants where slug = 'mine-shop'")).toHaveLength(0);
  });

  it("members cannot change their own role or status", async () => {
    for (const user of [manager, staff]) {
      expect(await as(user, async () => (await db.query("update memberships set role = 'owner' where user_id = $1 returning id", [user])).rows.length)).toBe(0);
      expect(await as(user, async () => (await db.query("update memberships set status = 'active' where user_id = $1 returning id", [user])).rows.length)).toBe(0);
    }
    await expect(as(manager, () => db.query("update memberships set user_id = $1 where user_id = $2", [alice, manager]))).rejects.toThrow(/permission denied/);
  });

  it("an Owner cannot demote or promote themselves, or hand out the owner role", async () => {
    expect(await as(alice, async () => (await db.query("update memberships set role = 'staff' where user_id = $1 returning id", [alice])).rows.length)).toBe(0);
    const extra = await createUser(db, "extra-owner@example.test");
    await expect(as(alice, () => db.query("insert into memberships (tenant_id, user_id, role) values ($1,$2,'owner')", [tenantA, extra]))).rejects.toThrow(/row-level security/);
    await expect(as(alice, () => db.query("insert into memberships (tenant_id, user_id, role) values ($1,$2,'platform_admin')", [tenantA, extra]))).rejects.toThrow(/row-level security|check constraint/);
  });
});

describe("owners create members only inside their own tenant", () => {
  it("an Owner cannot add a member to another company", async () => {
    const victim = await createUser(db, "victim@example.test");
    await expect(as(alice, () => db.query("insert into memberships (tenant_id, user_id, role) values ($1,$2,'staff')", [tenantB, victim]))).rejects.toThrow(/row-level security/);
    await expect(as(bob, () => db.query("insert into memberships (tenant_id, user_id, role) values ($1,$2,'admin')", [tenantA, victim]))).rejects.toThrow(/row-level security/);
  });

  it("Managers (admin role) and Staff cannot add members to the owner's team via the API", async () => {
    const hire = await createUser(db, "hire@example.test");
    // The app only exposes Team management to the Owner; the database still lets a Manager add Staff
    // (existing 0002 policy), but never a Manager/Owner and never to another tenant.
    await expect(as(staff, () => db.query("insert into memberships (tenant_id, user_id, role) values ($1,$2,'staff')", [tenantA, hire]))).rejects.toThrow(/row-level security/);
    await expect(as(manager, () => db.query("insert into memberships (tenant_id, user_id, role) values ($1,$2,'admin')", [tenantA, hire]))).rejects.toThrow(/row-level security/);
    await expect(as(manager, () => db.query("insert into memberships (tenant_id, user_id, role) values ($1,$2,'owner')", [tenantA, hire]))).rejects.toThrow(/row-level security/);
  });

  it("an Owner cannot add themselves to another tenant", async () => {
    await expect(as(alice, () => db.query("insert into memberships (tenant_id, user_id, role) values ($1,$2,'staff')", [tenantB, alice]))).rejects.toThrow(/row-level security/);
  });

  it("the team list (with e-mails) is available to that Owner and the Platform Admin only", async () => {
    const team = await as(alice, () => q<{ email: string; role: string; status: string }>("select email, role, status from public.list_tenant_team($1)", [tenantA]));
    expect(team[0]).toMatchObject({ email: "alice@example.test", role: "owner", status: "active" }); // owner first
    expect(team.map((m) => [m.email, m.role, m.status]).sort()).toEqual([
      ["alice@example.test", "owner", "active"],
      ["manager@example.test", "admin", "active"],
      ["staff@example.test", "staff", "active"],
    ]);
    expect(await as(admin, () => q("select * from public.list_tenant_team($1)", [tenantA]))).toHaveLength(3);
    for (const user of [staff, manager, bob, outsider]) {
      await expect(as(user, () => q("select * from public.list_tenant_team($1)", [tenantA])), user).rejects.toThrow(/forbidden/);
    }
  });

  it("renaming a member: Owner only, own tenant only, never the Owner row", async () => {
    await as(alice, () => db.query("select public.update_team_member_name($1,$2,'Stacy Staff')", [tenantA, staff]));
    expect((await q<{ full_name: string }>("select full_name from profiles where id = $1", [staff]))[0].full_name).toBe("Stacy Staff");
    await expect(as(alice, () => db.query("select public.update_team_member_name($1,$2,'Hacked')", [tenantA, alice]))).rejects.toThrow(/not_found/);
    await expect(as(bob, () => db.query("select public.update_team_member_name($1,$2,'Hacked')", [tenantA, staff]))).rejects.toThrow(/forbidden/);
    await expect(as(bob, () => db.query("select public.update_team_member_name($1,$2,'Hacked')", [tenantB, staff]))).rejects.toThrow(/not_found/);
    await expect(as(manager, () => db.query("select public.update_team_member_name($1,$2,'Hacked')", [tenantA, staff]))).rejects.toThrow(/forbidden/);
  });

  it("removing a member reports whether the Auth account is now orphaned", async () => {
    const temp = await createUser(db, "temp@example.test");
    await as(alice, () => db.query("insert into memberships (tenant_id, user_id, role) values ($1,$2,'staff')", [tenantA, temp]));
    await expect(as(bob, () => db.query("select public.remove_team_member($1,$2)", [tenantA, temp]))).rejects.toThrow(/forbidden/);
    await expect(as(alice, () => db.query("select public.remove_team_member($1,$2)", [tenantA, alice]))).rejects.toThrow(/cannot_remove_self/);
    const r = await as(alice, () => db.query<{ o: boolean }>("select public.remove_team_member($1,$2) o", [tenantA, temp]));
    expect(r.rows[0].o).toBe(true);
    await expect(as(alice, () => db.query("select public.remove_team_member($1,$2)", [tenantA, temp]))).rejects.toThrow(/not_found/);
  });
});

describe("tenant isolation holds for every role", () => {
  it.each([["owner", () => alice], ["manager", () => manager], ["staff", () => staff]])("%s of A cannot read, change or delete B's data", async (_n, who) => {
    const user = who();
    expect(await count(user, "select count(*)::int n from products where id = $1", [productB])).toBe(0);
    expect(await count(user, "select count(*)::int n from products where id = $1", [productA])).toBe(1);
    expect(await as(user, async () => (await db.query("update products set name = 'pwned' where id = $1 returning id", [productB])).rows.length)).toBe(0);
    expect(await as(user, async () => (await db.query("delete from products where id = $1 returning id", [productB])).rows.length)).toBe(0);
    await expect(as(user, () => db.query("insert into products (tenant_id, name, slug) values ($1,'Evil','evil')", [tenantB]))).rejects.toThrow(/row-level security/);
    expect(await count(user, "select count(*)::int n from tenants where id = $1", [tenantB])).toBe(0);
  });

  it("role permissions: staff cannot delete or edit the store; manager can", async () => {
    expect(await as(staff, async () => (await db.query("delete from products where id = $1 returning id", [productA])).rows.length)).toBe(0);
    expect(await as(staff, async () => (await db.query("update stores set description = 'x' where tenant_id = $1 returning id", [tenantA])).rows.length)).toBe(0);
    expect(await as(manager, async () => (await db.query("update stores set description = 'x' where tenant_id = $1 returning id", [tenantA])).rows.length)).toBe(1);
    expect(await as(staff, async () => (await db.query("update products set name = 'A renamed' where id = $1 returning id", [productA])).rows.length)).toBe(1);
  });
});

describe("suspending a company and deactivating a member", () => {
  const status = (id: string, s: string) => as(admin, () => db.query("select public.platform_set_tenant_status($1,$2)", [id, s]));

  it("only the Platform Admin can suspend or reactivate; Owners cannot touch tenants.status", async () => {
    await expect(as(alice, () => db.query("select public.platform_set_tenant_status($1,'suspended')", [tenantA]))).rejects.toThrow(/not_platform_admin/);
    await expect(as(alice, () => db.query("update tenants set status = 'active' where id = $1", [tenantA]))).rejects.toThrow(/permission denied/);
    await expect(status(tenantA, "deleted")).rejects.toThrow(/invalid_input/);
  });

  it("a suspended company disappears for all of its members (data kept), and comes back on reactivation", async () => {
    await status(tenantA, "suspended");
    try {
      for (const user of [alice, manager, staff]) {
        expect(await count(user, "select count(*)::int n from tenants"), "tenants").toBe(0);
        expect(await count(user, "select count(*)::int n from products"), "products").toBe(0);
        expect(await count(user, "select count(*)::int n from memberships"), "memberships").toBe(0);
        await expect(as(user, () => db.query("insert into products (tenant_id, name, slug) values ($1,'Late','late')", [tenantA]))).rejects.toThrow(/row-level security/);
      }
      // Storage helpers (used by the Storage policies) follow the same rule.
      expect(await as(alice, async () => (await q<{ ok: boolean }>("select public.can_write_storage_object($1) ok", [`${tenantA}/${productA}/x.png`]))[0].ok)).toBe(false);
      // The other company is unaffected.
      expect(await count(bob, "select count(*)::int n from products")).toBe(1);
      // Data is intact for the admin's privileged inspection.
      expect(await q("select 1 from products where id = $1", [productA])).toHaveLength(1);
    } finally {
      await status(tenantA, "active");
    }
    expect(await count(alice, "select count(*)::int n from products")).toBe(1);
    expect(await as(alice, async () => (await q<{ ok: boolean }>("select public.can_write_storage_object($1) ok", [`${tenantA}/${productA}/x.png`]))[0].ok)).toBe(true);
  });

  it("a deactivated member loses all access; the Owner can reactivate; the Owner row cannot be deactivated", async () => {
    expect(await as(alice, async () => (await db.query("update memberships set status = 'disabled' where user_id = $1 returning id", [staff])).rows.length)).toBe(1);
    expect(await count(staff, "select count(*)::int n from products")).toBe(0);
    expect(await count(staff, "select count(*)::int n from tenants")).toBe(0);
    await expect(as(staff, () => db.query("insert into products (tenant_id, name, slug) values ($1,'Late','late2')", [tenantA]))).rejects.toThrow(/row-level security/);
    expect(await as(staff, async () => (await q<{ ok: boolean }>("select public.can_write_storage_object($1) ok", [`${tenantA}/${productA}/x.png`]))[0].ok)).toBe(false);
    // A deactivated member cannot reactivate themselves.
    expect(await as(staff, async () => (await db.query("update memberships set status = 'active' where user_id = $1 returning id", [staff])).rows.length)).toBe(0);
    expect(await as(alice, async () => (await db.query("update memberships set status = 'disabled' where user_id = $1 returning id", [alice])).rows.length)).toBe(0);
    expect(await as(manager, async () => (await db.query("update memberships set status = 'disabled' where user_id = $1 returning id", [staff])).rows.length)).toBe(0);
    expect(await as(alice, async () => (await db.query("update memberships set status = 'active' where user_id = $1 returning id", [staff])).rows.length)).toBe(1);
    expect(await count(staff, "select count(*)::int n from products")).toBe(1);
  });
});

describe("storage paths stay tenant-scoped", () => {
  const canWrite = (user: string, path: string) => as(user, async () => (await q<{ ok: boolean }>("select public.can_write_storage_object($1) ok", [path]))[0].ok);

  it("writes are allowed only under the caller's own tenant folder", async () => {
    expect(await canWrite(alice, `${tenantA}/${productA}/a.png`)).toBe(true);
    expect(await canWrite(staff, `${tenantA}/${productA}/a.png`)).toBe(true);
    expect(await canWrite(alice, `${tenantB}/${productB}/a.png`)).toBe(false);
    expect(await canWrite(staff, `${tenantB}/${productB}/a.png`)).toBe(false);
    expect(await canWrite(outsider, `${tenantA}/${productA}/a.png`)).toBe(false);
    expect(await canWrite(alice, `not-a-uuid/${productA}/a.png`)).toBe(false);
  });

  it("the store logo folder is Owner/Manager only", async () => {
    expect(await canWrite(manager, `${tenantA}/store/logo.png`)).toBe(true);
    expect(await canWrite(staff, `${tenantA}/store/logo.png`)).toBe(false);
  });
});

describe("failed provisioning leaves nothing behind", () => {
  it("a failure after the tenant insert rolls back tenant, membership and store", async () => {
    const owner = await createUser(db, "doomed@example.test");
    await db.exec(`
      create function public.test_boom() returns trigger language plpgsql as $$ begin raise exception 'boom'; end $$;
      create trigger test_boom before insert on public.stores for each row execute function public.test_boom();
    `);
    try {
      await expect(provision(db, admin, owner, "doomed-shop")).rejects.toThrow(/boom/);
    } finally {
      await db.exec("drop trigger test_boom on public.stores; drop function public.test_boom();");
    }
    expect(await q("select 1 from tenants where slug = 'doomed-shop'")).toHaveLength(0);
    expect(await q("select 1 from memberships where user_id = $1", [owner])).toHaveLength(0);
    // Retrying afterwards works (idempotent, no half-created records to collide with).
    expect((await provision(db, admin, owner, "doomed-shop")).created).toBe(true);
  });

  it("rejects a slug that is taken or reserved without creating anything", async () => {
    const owner = await createUser(db, "slugger@example.test");
    const before = (await q<{ n: number }>("select count(*)::int n from tenants"))[0].n;
    await expect(provision(db, admin, owner, "alpha-shop")).rejects.toThrow(/slug_taken/);
    await expect(provision(db, admin, owner, "admin")).rejects.toThrow(/invalid_slug/);
    expect((await q<{ n: number }>("select count(*)::int n from tenants"))[0].n).toBe(before);
  });

  it("harness onboard() still works for ordinary suites", async () => {
    const owner = await createUser(db, "harness@example.test");
    expect((await onboard(db, owner, "harness-shop")).created).toBe(true);
  });
});
