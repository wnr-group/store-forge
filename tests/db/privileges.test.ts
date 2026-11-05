import type { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asAppConnection, asUser, createDb, createPlatformAdmin, createUser, onboard, provision } from "./harness";

let db: PGlite;
const rows = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
  (await db.query<T>(sql, params)).rows;
const priv = async (fn: string, role: string, target: string, kind: "function" | "table" = "function") =>
  (await rows<{ ok: boolean }>(`select has_${kind}_privilege($1, $2, ${kind === "function" ? "'execute'" : "'select'"}) as ok`, [role, target]))[0].ok;

beforeAll(async () => {
  db = await createDb();
});
afterAll(async () => db.close());

describe("migrations", () => {
  it("applies from an empty database and records every journal entry", async () => {
    const journal = JSON.parse(readFileSync(join(process.cwd(), "drizzle", "meta", "_journal.json"), "utf8"));
    const [{ n }] = await rows<{ n: number }>("select count(*)::int n from drizzle.__drizzle_migrations");
    expect(n).toBe(journal.entries.length);
  });

  it("is idempotent when re-run", async () => {
    await migrate(drizzle(db), { migrationsFolder: join(process.cwd(), "drizzle") });
    const [{ n }] = await rows<{ n: number }>("select count(*)::int n from drizzle.__drizzle_migrations");
    expect(n).toBeGreaterThan(0);
  });

  it("enables RLS on every application table", async () => {
    const res = await rows<{ relname: string; relrowsecurity: boolean }>(
      "select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relname in ('profiles','tenants','memberships','stores')",
    );
    expect(res).toHaveLength(4);
    for (const r of res) expect(r.relrowsecurity, r.relname).toBe(true);
  });

  it("every SECURITY DEFINER function pins search_path", async () => {
    const bad = await rows(
      "select proname from pg_proc where pronamespace = 'public'::regnamespace and prosecdef and not coalesce(proconfig::text, '') like '%search_path%'",
    );
    expect(bad).toEqual([]);
  });
});

describe("storeforge_app login role", () => {
  it("cannot bypass RLS and has no elevated attributes", async () => {
    const [r] = await rows<Record<string, boolean>>(
      "select rolcanlogin, rolbypassrls, rolsuper, rolinherit, rolcreatedb, rolcreaterole, rolreplication from pg_roles where rolname = 'storeforge_app'",
    );
    expect(r).toEqual({
      rolcanlogin: true,
      rolbypassrls: false,
      rolsuper: false,
      rolinherit: false,
      rolcreatedb: false,
      rolcreaterole: false,
      rolreplication: false,
    });
  });

  it("ships without a password (it must be set out-of-band, never committed)", async () => {
    const [r] = await rows<{ nopw: boolean }>("select rolpassword is null as nopw from pg_authid where rolname = 'storeforge_app'");
    expect(r.nopw).toBe(true);
  });

  it("is a member of `authenticated` and nothing else", async () => {
    const res = await rows<{ rolname: string }>(
      "select r.rolname from pg_auth_members m join pg_roles r on r.oid = m.roleid join pg_roles u on u.oid = m.member where u.rolname = 'storeforge_app'",
    );
    expect(res.map((r) => r.rolname)).toEqual(["authenticated"]);
  });

  it("has no table access of its own before switching role", async () => {
    await asAppConnection(db, async () => {
      await expect(db.query("select * from tenants")).rejects.toThrow(/permission denied/);
      await expect(db.query("select public.is_tenant_member(gen_random_uuid())")).rejects.toThrow(/permission denied/);
    });
  });

  it("can switch to `authenticated` but never to a bypass/privileged role", async () => {
    await asAppConnection(db, async () => {
      await db.exec("set role authenticated");
      await db.exec("reset role");
      for (const role of ["service_role", "anon", "postgres"]) {
        await expect(db.exec(`set role ${role}`), role).rejects.toThrow(/permission denied to set role/);
      }
    });
  });

  it("gets RLS-filtered data only after the transaction-local context is set", async () => {
    const owner = await createUser(db, "owner@example.test");
    const other = await createUser(db, "other@example.test");
    await onboard(db, owner, "owner-store");

    await asAppConnection(db, async () => {
      const visible = async (uid: string) => {
        await db.exec("begin");
        await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid, role: "authenticated" })]);
        await db.exec("set local role authenticated");
        const res = await db.query("select id from tenants");
        await db.exec("commit");
        return res.rows.length;
      };
      expect(await visible(owner)).toBe(1);
      expect(await visible(other)).toBe(0);
      // Identity does not survive the transaction.
      const [{ claims }] = (await db.query<{ claims: string }>("select coalesce(current_setting('request.jwt.claims', true), '') as claims")).rows;
      expect(claims).toBe("");
      expect((await db.query<{ r: string }>("select current_user as r")).rows[0].r).toBe("storeforge_app");
    });
  });
});

describe("function and table grants", () => {
  const FN = {
    create: "public.platform_provision_tenant(uuid,text,text,text,text,text,text)",
    available: "public.is_store_slug_available(text)",
    member: "public.is_tenant_member(uuid)",
    role: "public.has_tenant_role(uuid,text[])",
    newUser: "public.handle_new_user()",
  };

  it.each([FN.create, FN.available, FN.member, FN.role])("%s: authenticated yes, anon/public no", async (fn) => {
    expect(await priv(fn, "authenticated", fn)).toBe(true);
    expect(await priv(fn, "anon", fn)).toBe(false);
  });

  it("handle_new_user() is not callable by API roles", async () => {
    for (const role of ["anon", "authenticated", "storeforge_app"]) expect(await priv(FN.newUser, role, FN.newUser), role).toBe(false);
  });

  it("storeforge_app holds no direct function execute rights", async () => {
    for (const fn of [FN.create, FN.member]) expect(await priv(fn, "storeforge_app", fn), fn).toBe(false);
  });

  it("anon has no table access; authenticated cannot insert tenants or change identity columns", async () => {
    for (const t of ["profiles", "tenants", "memberships", "stores"]) expect(await priv("", "anon", `public.${t}`, "table"), t).toBe(false);
    const can = async (role: string, table: string, privilege: string) =>
      (await rows<{ ok: boolean }>("select has_table_privilege($1, $2, $3) as ok", [role, `public.${table}`, privilege]))[0].ok;
    const col = async (table: string, column: string) =>
      (await rows<{ ok: boolean }>("select has_column_privilege('authenticated', $1, $2, 'update') as ok", [`public.${table}`, column]))[0].ok;
    expect(await can("authenticated", "tenants", "insert")).toBe(false);
    expect(await col("memberships", "user_id")).toBe(false);
    expect(await col("memberships", "tenant_id")).toBe(false);
    expect(await col("stores", "tenant_id")).toBe(false);
    expect(await col("tenants", "created_by")).toBe(false);
    expect(await col("memberships", "role")).toBe(true);
  });
});

describe("platform_provision_tenant() is Platform-Admin only", () => {
  const call = (owner: string, slug: string) =>
    db.query("select public.platform_provision_tenant($1, 'Biz Co', 'Biz Store', $2)", [owner, slug]);
  const countTenants = async () => (await rows<{ n: number }>("select count(*)::int n from tenants"))[0].n;

  it("the old self-service onboarding function no longer exists", async () => {
    const found = await rows("select 1 from pg_proc where proname = 'create_tenant_with_store'");
    expect(found).toHaveLength(0);
  });

  it("rejects calls with no identity", async () => {
    const owner = await createUser(db, "pp-owner1@example.test");
    const before = await countTenants();
    await db.query("select set_config('request.jwt.claims', '', false)");
    await db.exec("set role authenticated");
    try {
      await expect(call(owner, "no-identity")).rejects.toThrow(/not_platform_admin/);
    } finally {
      await db.exec("reset role");
    }
    expect(await countTenants()).toBe(before);
  });

  it("rejects an ordinary signed-in user, even when naming themselves as the owner", async () => {
    const user = await createUser(db, "pp-user@example.test");
    const before = await countTenants();
    await expect(asUser(db, user, () => call(user, "self-service"))).rejects.toThrow(/not_platform_admin/);
    expect(await countTenants()).toBe(before);
  });

  it("rejects a tenant owner (tenant roles carry no platform authority)", async () => {
    const owner = await createUser(db, "pp-owner2@example.test");
    await onboard(db, owner, "pp-owner-shop");
    const other = await createUser(db, "pp-other@example.test");
    await expect(asUser(db, owner, () => call(other, "owner-made"))).rejects.toThrow(/not_platform_admin/);
  });

  it("rejects an owner id that is not a real auth user", async () => {
    const admin = await createPlatformAdmin(db);
    const before = await countTenants();
    await expect(provision(db, admin, "99999999-9999-9999-9999-999999999999", "ghost-user")).rejects.toThrow(/owner_not_found/);
    expect(await countTenants()).toBe(before);
  });

  it("rejects anon at the privilege level", async () => {
    const owner = await createUser(db, "pp-owner3@example.test");
    await expect(asUser(db, null, () => call(owner, "anon-call"))).rejects.toThrow(/permission denied/);
  });

  it("slug availability check also requires an identity", async () => {
    await db.query("select set_config('request.jwt.claims', '', false)");
    await db.exec("set role authenticated");
    try {
      await expect(db.query("select public.is_store_slug_available('some-slug')")).rejects.toThrow(/not_authenticated/);
    } finally {
      await db.exec("reset role");
    }
  });
});
