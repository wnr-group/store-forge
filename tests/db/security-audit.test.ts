import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asAppConnection, asRestApi, createDb, createPlatformAdmin, createUser, provision } from "./harness";

/**
 * Automated review of the database's security surface, run against the schema the migrations really build. It discovers functions
 * and tables from the catalogs, so anything added later is checked too, without anyone having to remember to extend a list.
 */
let db: PGlite;
let boss: string;
let alice: string;
let tenantA: string;

const q = <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => db.query<T>(sql, params).then((r) => r.rows);
const rejects = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return (e as Error).message;
  }
  throw new Error("expected the statement to fail");
};

type Fn = { oid: number; name: string; args: string; secdef: boolean; config: string[] | null; returns: string; argtypes: string[] };
let functions: Fn[] = [];

beforeAll(async () => {
  db = await createDb();
  boss = await createPlatformAdmin(db, "boss@example.test", "super_admin");
  alice = await createUser(db, "alice@example.test");
  tenantA = (await provision(db, boss, alice, "alpha-shop")).tenant_id;
  functions = await q<Fn>(`
    select p.oid::int as oid, p.proname as name, pg_get_function_identity_arguments(p.oid) as args,
           p.prosecdef as secdef, p.proconfig as config, format_type(p.prorettype, null) as returns,
           coalesce((select array_agg(format_type(t, null) order by ord) from unnest(p.proargtypes::oid[]) with ordinality as u(t, ord)), '{}') as argtypes
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')  -- not part of an extension
    order by p.proname`);
});

afterAll(async () => {
  await db.close();
});

/** A harmless value of each argument type, so a function can be called just to see whether it refuses the caller. */
const sample = (type: string): string => {
  if (type === "uuid") return `'${crypto.randomUUID()}'::uuid`;
  if (type === "text") return "'x'";
  if (type === "integer") return "1";
  if (type === "boolean") return "true";
  if (type === "jsonb") return "'{}'::jsonb";
  if (type === "date") return "current_date";
  if (type.startsWith("timestamp")) return "now()";
  if (type === "text[]") return "'{}'::text[]";
  throw new Error(`no sample value for argument type "${type}": extend the audit test`);
};
const call = (f: Fn) => `select * from public.${f.name}(${f.argtypes.map(sample).join(", ")})`;

describe("function privileges", () => {
  it("finds the functions to review (so the other checks cannot pass by looking at nothing)", () => {
    expect(functions.length).toBeGreaterThan(45);
  });

  it("every SECURITY DEFINER function fixes its search_path, so it cannot be steered to another schema's objects", () => {
    const loose = functions.filter((f) => f.secdef && !(f.config ?? []).some((c) => c.startsWith("search_path=")));
    expect(loose.map((f) => `${f.name}(${f.args})`)).toEqual([]);
  });

  it("no function can be run by anonymous visitors or granted to PUBLIC", async () => {
    const open = await q<{ name: string }>(
      `select p.proname as name from pg_proc p
       where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
         and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
         and has_function_privilege('anon', p.oid, 'execute')`,
    );
    expect(open.map((r) => r.name)).toEqual([]);
  });

  it("trigger functions and internal helpers cannot be called by signed-in users either", async () => {
    const internal = functions.filter((f) => f.returns === "trigger" || ["tenant_storage_bytes", "tenant_has_activity_since", "tenant_last_activity", "audit_redact"].includes(f.name));
    expect(internal.length).toBeGreaterThanOrEqual(8);
    const reachable: string[] = [];
    for (const f of internal) {
      const [{ ok }] = await q<{ ok: boolean }>("select has_function_privilege('authenticated', $1::oid, 'execute') as ok", [f.oid]);
      if (ok) reachable.push(f.name);
    }
    expect(reachable).toEqual([]);
  });

  it("every platform_* function is SECURITY DEFINER, so its own checks (not the caller's table rights) decide", () => {
    const platform = functions.filter((f) => f.name.startsWith("platform_"));
    expect(platform.length).toBeGreaterThan(22);
    expect(platform.filter((f) => !f.secdef).map((f) => f.name)).toEqual([]);
  });
});

describe("table privileges", () => {
  it("row level security is on for every table, and anonymous visitors have no table rights at all", async () => {
    const tables = await q<{ name: string; rls: boolean; anon: boolean }>(
      `select c.relname as name, c.relrowsecurity as rls, has_table_privilege('anon', c.oid, 'select,insert,update,delete') as anon
       from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'`,
    );
    expect(tables.length).toBeGreaterThan(15);
    expect(tables.filter((t) => !t.rls).map((t) => t.name)).toEqual([]);
    expect(tables.filter((t) => t.anon).map((t) => t.name)).toEqual([]);
  });

  it("a table with no policies gives nobody any rights (it is reachable only through reviewed functions)", async () => {
    const bare = await q<{ name: string; auth: boolean; app: boolean }>(
      `select c.relname as name,
              has_table_privilege('authenticated', c.oid, 'select,insert,update,delete') as auth,
              has_table_privilege('storeforge_app', c.oid, 'select,insert,update,delete') as app
       from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
         and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname)`,
    );
    expect(bare.map((t) => t.name).sort()).toEqual(expect.arrayContaining(["admin_audit_logs", "platform_admins", "platform_settings", "rate_limits"]));
    expect(bare.filter((t) => t.auth || t.app).map((t) => t.name)).toEqual([]);
  });

  it("the audit log, settings, rate limits and admin list refuse direct reads and writes from an organization owner and from an admin", async () => {
    for (const table of ["admin_audit_logs", "platform_settings", "rate_limits", "platform_admins"]) {
      for (const user of [alice, boss]) {
        const as = async (sql: string) =>
          asAppConnection(db, async () => {
            await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: user, role: "authenticated" })]);
            await db.exec("set role authenticated");
            try {
              return await q(sql);
            } finally {
              await db.exec("reset role").catch(() => {});
            }
          });
        expect(await rejects(as(`select * from public.${table}`)), `${table} read`).toMatch(/permission denied/);
        expect(await rejects(as(`delete from public.${table}`)), `${table} delete`).toMatch(/permission denied/);
      }
    }
  });
});

describe("every admin function refuses everyone who is not an admin on the application's connection", () => {
  /** platform_* functions are admin-only, except the one that just reports the caller's own level (it answers null for everyone else). */
  const isAdminOnly = (f: Fn) => (f.name.startsWith("platform_") && f.name !== "platform_admin_role") || f.name === "rate_limit_admin";

  it("finds the admin functions by name (so a new one is covered automatically)", () => {
    const names = functions.filter(isAdminOnly).map((f) => f.name);
    expect(names.length).toBeGreaterThan(22);
    for (const expected of ["platform_list_tenants_page", "platform_delete_tenant", "platform_assign_owner", "platform_update_settings", "platform_record_audit", "platform_add_admin", "rate_limit_admin"]) {
      expect(names).toContain(expected);
    }
  });

  it("an organization owner is refused by every one of them", async () => {
    const refused: string[] = [];
    const answered: string[] = [];
    for (const f of functions.filter((x) => isAdminOnly(x) || x.name === "get_platform_settings")) {
      const message = await asAppConnection(db, async () => {
        await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: alice, role: "authenticated" })]);
        await db.exec("set role authenticated");
        try {
          await q(call(f));
          return null;
        } catch (e) {
          return (e as Error).message;
        } finally {
          await db.exec("reset role").catch(() => {});
        }
      });
      if (message && /not_platform_admin|not_super_admin/.test(message)) refused.push(f.name);
      else answered.push(`${f.name}: ${message ?? "ANSWERED"}`);
    }
    expect(answered).toEqual([]);
    expect(refused.length).toBeGreaterThan(22);
  });

  it("a signed-out visitor is refused by every one of them", async () => {
    const allowed: string[] = [];
    await db.exec("set role anon");
    try {
      for (const f of functions.filter((x) => isAdminOnly(x) || x.name === "get_platform_settings")) {
        const message = await rejects(q(call(f)).catch((e) => Promise.reject(e))).catch(() => "ANSWERED");
        if (!/permission denied/.test(message)) allowed.push(f.name);
      }
    } finally {
      await db.exec("reset role");
    }
    expect(allowed).toEqual([]);
  });

  it("even a super admin is refused by every one of them when the call arrives over the REST API", async () => {
    const answered: string[] = [];
    for (const f of functions.filter((x) => isAdminOnly(x) || x.name === "get_platform_settings")) {
      const message = await asRestApi(db, boss, async () => {
        try {
          await q(call(f));
          return null;
        } catch (e) {
          return (e as Error).message;
        }
      });
      if (!message || !/not_platform_admin|not_super_admin/.test(message)) answered.push(`${f.name}: ${message ?? "ANSWERED"}`);
    }
    expect(answered).toEqual([]);
  });

  it("nothing was changed by all of those refused calls", async () => {
    expect((await q<{ n: number }>("select count(*)::int n from admin_audit_logs"))[0].n).toBe(0);
    expect((await q<{ status: string }>("select status from tenants where id = $1", [tenantA]))[0].status).toBe("active");
    expect((await q<{ n: number }>("select count(*)::int n from platform_admins"))[0].n).toBe(1);
    expect((await q<{ n: number }>("select count(*)::int n from rate_limits"))[0].n).toBe(0);
  });
});
