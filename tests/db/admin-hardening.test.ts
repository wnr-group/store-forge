import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asAppConnection, asRestApi, asUser, createDb, createPlatformAdmin, createUser, provision } from "./harness";

/**
 * drizzle/0016: Platform Admin powers are unavailable over the public REST API, and rate limiting.
 * "REST" here means the connection Supabase's REST service uses: logged in as `authenticator`, then switched to `authenticated`.
 */
let db: PGlite;
let boss: string; // super admin
let helper: string; // admin
let alice: string; // organization owner
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
/** As the application connects: logged in as storeforge_app, switched to `authenticated` with the user's claims. */
const asApp = <T>(user: string, fn: () => Promise<T>) =>
  asAppConnection(db, async () => {
    await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: user, role: "authenticated" })]);
    await db.exec("set role authenticated");
    try {
      return await fn();
    } finally {
      await db.exec("reset role").catch(() => {});
      await db.query("select set_config('request.jwt.claims', '', false)").catch(() => {});
    }
  });

beforeAll(async () => {
  db = await createDb();
  boss = await createPlatformAdmin(db, "boss@example.test", "super_admin");
  helper = await createPlatformAdmin(db, "helper@example.test", "admin");
  alice = await createUser(db, "alice@example.test");
  tenantA = (await provision(db, boss, alice, "alpha-shop", { tenant: "Alpha Inc" })).tenant_id;
});

afterAll(async () => {
  await db.close();
});

describe("admin powers are unavailable over the REST API", () => {
  it("answers 'not an admin' for a real admin on the REST path, and 'admin' on the application's own connection", async () => {
    const asked = () => q<{ a: boolean; s: boolean }>("select public.is_platform_admin() a, public.is_super_admin() s").then((r) => r[0]);
    expect(await asRestApi(db, boss, asked)).toEqual({ a: false, s: false });
    expect(await asRestApi(db, helper, asked)).toEqual({ a: false, s: false });
    expect(await asApp(boss, asked)).toEqual({ a: true, s: true });
    expect(await asApp(helper, asked)).toEqual({ a: true, s: false });
    expect(await asUser(db, boss, asked)).toEqual({ a: true, s: true }); // direct database sessions (tests, operators) are unchanged
  });

  it("refuses every kind of admin function through REST, even for a super admin, and changes nothing", async () => {
    const before = (await q<{ name: string }>("select name from tenants where id=$1", [tenantA]))[0].name;
    const calls: [string, string, unknown[]][] = [
      ["list organizations", "select * from public.platform_list_tenants_page()", []],
      ["overview", "select * from public.platform_overview_stats()", []],
      ["edit an organization", "select public.platform_update_tenant($1,'Hijacked',null,null)", [tenantA]],
      ["edit a store", "select public.platform_update_store($1,$2,'X',null,null,null,'INR','UTC')", [tenantA, crypto.randomUUID()]],
      ["transfer ownership", "select public.platform_assign_owner($1,$2,'active')", [tenantA, boss]],
      ["suspend an organization", "select public.platform_set_tenant_status($1,'suspended')", [tenantA]],
      ["delete an organization", "select public.platform_delete_tenant($1)", [tenantA]],
      ["write an audit entry", "select public.platform_record_audit('organization.updated','organization',null,null,'forged')", []],
      ["read the audit log", "select * from public.platform_list_audit()", []],
      ["add an admin", "select public.platform_add_admin($1,'super_admin')", [alice]],
      ["change the settings", "select public.platform_update_settings('Evil',null,'INR','UTC','active')", []],
      ["read the platform admins", "select * from public.platform_list_admins()", []],
      ["use the admin rate limiter", "select * from public.rate_limit_admin('org.create', 10, 600)", []],
    ];
    for (const [label, sql, params] of calls) {
      expect(await rejects(asRestApi(db, boss, () => q(sql, params))), label).toMatch(/not_platform_admin|not_super_admin/);
    }
    expect((await q<{ name: string }>("select name from tenants where id=$1", [tenantA]))[0].name).toBe(before);
    expect((await q<{ n: number }>("select count(*)::int n from admin_audit_logs"))[0].n).toBe(0);
  });

  it("does not affect organization members and owners, who never used these checks", async () => {
    const team = await asRestApi(db, alice, () => q<{ email: string }>("select email from public.list_tenant_team($1)", [tenantA]));
    expect(team.map((t) => t.email)).toEqual(["alice@example.test"]);
    expect((await asRestApi(db, alice, () => q<{ ok: boolean }>("select public.is_tenant_member($1) as ok", [tenantA])))[0].ok).toBe(true);
  });

  it("still works through the application's connection", async () => {
    const rows = await asApp(boss, () => q<{ name: string }>("select name from public.platform_list_tenants_page()"));
    expect(rows.map((r) => r.name)).toEqual(["Alpha Inc"]);
  });
});

describe("admin rate limiter", () => {
  type Hit = { allowed: boolean; remaining: number; retry_after_seconds: number };
  const hit = (user: string, bucket = "org.create", limit = 3, window = 600) =>
    asApp(user, async () => (await q<Hit>("select * from public.rate_limit_admin($1,$2,$3)", [bucket, limit, window]))[0]);

  it("allows up to the limit, then refuses, counting down what is left and when to retry", async () => {
    const seen = [];
    for (let i = 0; i < 5; i++) seen.push(await hit(boss, "test.counts"));
    expect(seen.map((h) => h.allowed)).toEqual([true, true, true, false, false]);
    expect(seen.map((h) => h.remaining)).toEqual([2, 1, 0, 0, 0]);
    expect(seen[3].retry_after_seconds).toBeGreaterThanOrEqual(1);
    expect(seen[3].retry_after_seconds).toBeLessThanOrEqual(600);
  });

  it("keeps every admin and every bucket separate", async () => {
    for (let i = 0; i < 4; i++) await hit(boss, "test.isolation");
    expect((await hit(boss, "test.isolation")).allowed).toBe(false);
    expect((await hit(helper, "test.isolation")).allowed).toBe(true); // another admin, same bucket
    expect((await hit(boss, "test.otherbucket")).allowed).toBe(true); // same admin, another bucket
  });

  it("starts fresh in the next window", async () => {
    for (let i = 0; i < 4; i++) await hit(boss, "test.window");
    expect((await hit(boss, "test.window")).allowed).toBe(false);
    await q("update rate_limits set window_start = window_start - interval '1 hour' where key like 'test.window:%'"); // move the old window into the past
    const again = await hit(boss, "test.window");
    expect(again).toMatchObject({ allowed: true, remaining: 2 });
  });

  it("only counts for the caller: the subject is taken from the session, never chosen", async () => {
    await hit(boss, "test.subject");
    const keys = await q<{ key: string }>("select key from rate_limits where key like 'test.subject:%'");
    expect(keys).toEqual([{ key: `test.subject:${boss}` }]);
  });

  it("is for Platform Admins on the application's connection only, and validates its input", async () => {
    expect(await rejects(hit(alice))).toMatch(/not_platform_admin/);
    expect(await rejects(asRestApi(db, boss, () => q("select * from public.rate_limit_admin('x.y', 5, 60)")))).toMatch(/not_platform_admin/);
    for (const [bucket, limit, window] of [["BAD BUCKET", 3, 60], ["", 3, 60], ["ok.bucket", 0, 60], ["ok.bucket", 5000, 60], ["ok.bucket", 3, 0], ["ok.bucket", 3, 999999]] as const) {
      expect(await rejects(hit(boss, bucket, limit, window)), `${bucket}/${limit}/${window}`).toMatch(/invalid_input/);
    }
  });

  it("cannot be read or edited directly", async () => {
    for (const user of [alice, boss]) {
      expect(await rejects(asUser(db, user, () => q("select * from rate_limits")))).toMatch(/permission denied/);
      expect(await rejects(asUser(db, user, () => q("delete from rate_limits")))).toMatch(/permission denied/);
      expect(await rejects(asUser(db, user, () => q("insert into rate_limits (key, window_start, hits) values ('x', now(), 0)")))).toMatch(/permission denied/);
    }
  });
});

describe("sign-in rate limiter", () => {
  type Hit = { allowed: boolean; remaining: number; retry_after_seconds: number };
  const hex = (n: number) => n.toString(16).padStart(64, "0");
  /** Before anyone is signed in the app calls it as `authenticated` with no user. */
  const attempt = async (subject: string, kind: string) => {
    await db.exec("set role authenticated");
    try {
      return (await q<Hit>("select * from public.rate_limit_login($1,$2)", [subject, kind]))[0];
    } finally {
      await db.exec("reset role");
    }
  };

  it("allows 8 attempts per address and e-mail in a window, then refuses", async () => {
    const seen = [];
    for (let i = 0; i < 10; i++) seen.push(await attempt(hex(1), "email"));
    expect(seen.map((h) => h.allowed)).toEqual([true, true, true, true, true, true, true, true, false, false]);
    expect(seen[7].remaining).toBe(0);
    expect(seen[8].retry_after_seconds).toBeGreaterThanOrEqual(1);
    expect(seen[8].retry_after_seconds).toBeLessThanOrEqual(900);
  });

  it("allows 40 per address, and keeps different subjects and kinds apart", async () => {
    const seen = [];
    for (let i = 0; i < 42; i++) seen.push((await attempt(hex(2), "ip")).allowed);
    expect(seen.filter(Boolean)).toHaveLength(40);
    expect((await attempt(hex(3), "ip")).allowed).toBe(true);
    expect((await attempt(hex(2), "email")).allowed).toBe(true); // same hash, other kind
    expect((await attempt(hex(1), "email")).allowed).toBe(false); // still the earlier subject
  });

  it("accepts only a hex digest and a known kind, so no raw e-mail or address is ever stored", async () => {
    for (const [subject, kind] of [["alice@example.test", "email"], ["203.0.113.5", "ip"], ["", "email"], [hex(9), "other"], [hex(9), ""], ["G".repeat(64), "email"], [hex(9).slice(1), "email"]] as const) {
      expect(await rejects(attempt(subject, kind)), `${subject}/${kind}`).toMatch(/invalid_input/);
    }
    const keys = await q<{ key: string }>("select key from rate_limits where key like 'login:%'");
    for (const k of keys) expect(k.key).toMatch(/^login:(email|ip):[0-9a-f]{64}$/);
  });

  it("is not available to anonymous callers", async () => {
    await db.exec("set role anon");
    try {
      expect(await rejects(q("select * from public.rate_limit_login($1,'email')", [hex(5)]))).toMatch(/permission denied/);
    } finally {
      await db.exec("reset role");
    }
  });
});
