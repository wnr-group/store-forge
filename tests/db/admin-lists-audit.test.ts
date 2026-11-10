import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, createDb, createPlatformAdmin, createUser, provision } from "./harness";

/**
 * Platform Admin phase 1 (drizzle/0013): paged organization list, overview statistics and the audit log.
 * Everything is called through the real SQL functions as an authenticated user, the way the app does.
 */
let db: PGlite;
let admin: string;
let otherAdmin: string;
let alice: string; // an owner, never a platform admin
const orgs: { id: string; owner: string; name: string; slug: string }[] = [];

const q = <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => db.query<T>(sql, params).then((r) => r.rows);
const as = <T>(user: string | null, fn: () => Promise<T>) => asUser(db, user, fn);
const rejects = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return (e as Error).message;
  }
  throw new Error("expected the statement to fail");
};

type Row = { id: string; name: string; slug: string; status: string; owner_email: string | null; member_count: string | number; total_count: string | number };
const page = (args: { search?: string | null; status?: string | null; sort?: string; limit?: number; offset?: number } = {}, user: string | null = admin) =>
  as(user, () =>
    q<Row>("select * from public.platform_list_tenants_page($1,$2,$3,$4,$5)", [args.search ?? null, args.status ?? null, args.sort ?? "created_desc", args.limit ?? 20, args.offset ?? 0]),
  );

const NAMES = ["Zebra Goods", "apple farm", "Mango Mart", "50% Off Store", "under_score shop", "Quince & Co", "banana hub", "Cherry Corner", "delta traders", "Echo Electronics"];

beforeAll(async () => {
  db = await createDb();
  admin = await createPlatformAdmin(db);
  otherAdmin = await createPlatformAdmin(db, "second.admin@example.test");
  alice = await createUser(db, "alice@example.test");
  // 25 organizations: the named ones plus filler, created one after another so created_at differs.
  for (let i = 0; i < 25; i++) {
    const owner = i === 0 ? alice : await createUser(db, `owner${i}@example.test`, `Owner ${i}`);
    const name = NAMES[i] ?? `Filler Shop ${String(i).padStart(2, "0")}`;
    const slug = `shop-${String(i).padStart(2, "0")}${i === 4 ? "-us" : ""}`;
    const res = await provision(db, admin, owner, slug, { tenant: name, store: `${name} Store` });
    orgs.push({ id: res.tenant_id, owner, name, slug });
    await q("select pg_sleep(0.002)");
  }
  // Suspend every third organization.
  for (const [i, o] of orgs.entries()) if (i % 3 === 0) await q("update tenants set status='suspended' where id=$1", [o.id]);
});

afterAll(async () => {
  await db.close();
});

describe("organization list: pagination", () => {
  it("returns one page at a time with the total on every row", async () => {
    const p1 = await page({ limit: 10, offset: 0 });
    const p2 = await page({ limit: 10, offset: 10 });
    const p3 = await page({ limit: 10, offset: 20 });
    expect([p1.length, p2.length, p3.length]).toEqual([10, 10, 5]);
    for (const r of [...p1, ...p2, ...p3]) expect(Number(r.total_count)).toBe(25);
    const ids = [...p1, ...p2, ...p3].map((r) => r.id);
    expect(new Set(ids).size).toBe(25); // no row twice, none missing
  });

  it("returns nothing past the last page, and clamps the page size to 1..100", async () => {
    expect(await page({ limit: 10, offset: 100 })).toHaveLength(0);
    expect(await page({ limit: 0 })).toHaveLength(1);
    expect(await page({ limit: 100000 })).toHaveLength(25);
    expect(await page({ offset: -5, limit: 3 })).toHaveLength(3);
  });

  it("attaches owner and member count to the rows of the page only", async () => {
    const [first] = await page({ search: "Zebra" });
    expect(first).toMatchObject({ name: "Zebra Goods", owner_email: "alice@example.test" });
    expect(Number(first.member_count)).toBe(1);
  });
});

describe("organization list: search, filter and sort", () => {
  it("searches name and slug without regard to case", async () => {
    expect((await page({ search: "APPLE" })).map((r) => r.name)).toEqual(["apple farm"]);
    expect((await page({ search: "shop-02" })).map((r) => r.slug)).toEqual(["shop-02"]);
    expect(await page({ search: "nothing-like-this" })).toHaveLength(0);
  });

  it("treats LIKE wildcards in the search as plain characters", async () => {
    expect((await page({ search: "%" })).map((r) => r.name)).toEqual(["50% Off Store"]);
    expect((await page({ search: "_" })).map((r) => r.name).sort()).toEqual(["under_score shop"]);
    expect(await page({ search: "\\" })).toHaveLength(0);
    expect((await page({ search: "  Mango  " })).map((r) => r.name)).toEqual(["Mango Mart"]); // trimmed
  });

  it("filters by status, and the total reflects the filter", async () => {
    const suspended = await page({ status: "suspended", limit: 100 });
    expect(suspended.every((r) => r.status === "suspended")).toBe(true);
    expect(suspended).toHaveLength(9); // indexes 0,3,...,24
    expect(Number(suspended[0].total_count)).toBe(9);
    expect((await page({ status: "active", limit: 100 })).every((r) => r.status === "active")).toBe(true);
  });

  it("sorts by name (ignoring case) and by creation date", async () => {
    const byName = (await page({ sort: "name_asc", limit: 100 })).map((r) => r.name);
    expect(byName).toEqual([...byName].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())));
    expect((await page({ sort: "name_desc", limit: 100 })).map((r) => r.name)).toEqual([...byName].reverse());
    const newest = (await page({ sort: "created_desc", limit: 100 })).map((r) => r.slug);
    const oldest = (await page({ sort: "created_asc", limit: 100 })).map((r) => r.slug);
    expect(newest[0]).toBe("shop-24");
    expect(oldest[0]).toBe("shop-00");
    expect(newest).toEqual([...oldest].reverse());
  });

  it("combines search, status, sort and paging", async () => {
    const rows = await page({ search: "Filler", status: "suspended", sort: "name_desc", limit: 2, offset: 2 });
    const all = (await page({ search: "Filler", status: "suspended", sort: "name_desc", limit: 100 })).map((r) => r.name);
    expect(rows.map((r) => r.name)).toEqual(all.slice(2, 4));
    expect(Number(rows[0].total_count)).toBe(all.length);
  });

  it("rejects values it does not know instead of guessing", async () => {
    expect(await rejects(page({ status: "deleted" }))).toMatch(/invalid_input/);
    expect(await rejects(page({ sort: "owner_asc" }))).toMatch(/invalid_input/);
  });

  it("is available to Platform Admins only", async () => {
    expect(await rejects(page({}, alice))).toMatch(/not_platform_admin/);
    expect(await rejects(page({}, null))).toMatch(/permission denied|not_platform_admin/);
    expect((await page({}, otherAdmin)).length).toBeGreaterThan(0);
  });
});

describe("overview statistics", () => {
  const stats = (user: string | null = admin) => as(user, async () => (await q<Record<string, string | number>>("select * from public.platform_overview_stats()"))[0]);

  it("counts organizations by status and distinct user accounts in SQL", async () => {
    const s = await stats();
    expect([Number(s.total_tenants), Number(s.active_tenants), Number(s.suspended_tenants)]).toEqual([25, 16, 9]);
    expect(Number(s.total_users)).toBe(25); // one owner each
    // a person who belongs to two organizations is still one account
    await q("insert into memberships (tenant_id, user_id, role) values ($1,$2,'admin')", [orgs[1].id, orgs[2].owner]);
    expect(Number((await stats()).total_users)).toBe(25);
    await q("delete from memberships where tenant_id=$1 and user_id=$2", [orgs[1].id, orgs[2].owner]);
  });

  it("is available to Platform Admins only", async () => {
    expect(await rejects(stats(alice))).toMatch(/not_platform_admin/);
    expect(await rejects(stats(null))).toMatch(/permission denied|not_platform_admin/);
  });
});

describe("audit log", () => {
  const record = (user: string | null, args: { action?: string; entity?: string; entityId?: string | null; org?: string | null; description?: string; prev?: unknown; next?: unknown } = {}) =>
    as(user, async () =>
      (
        await q<{ id: string }>("select public.platform_record_audit($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb) as id", [
          args.action ?? "organization.updated",
          args.entity ?? "organization",
          args.entityId ?? null,
          args.org ?? null,
          args.description ?? "Changed something",
          args.prev === undefined ? null : JSON.stringify(args.prev),
          args.next === undefined ? null : JSON.stringify(args.next),
        ])
      )[0].id,
    );
  type AuditRow = { id: string; admin_user_id: string; admin_email: string; action: string; organization_id: string | null; organization_name: string | null; description: string; previous_data: Record<string, unknown> | null; new_data: Record<string, unknown> | null; created_at: string; total_count: string | number };
  const list = (args: { action?: string | null; adminId?: string | null; org?: string | null; orgSearch?: string | null; from?: string | null; to?: string | null; limit?: number; offset?: number } = {}, user: string | null = admin) =>
    as(user, () =>
      q<AuditRow>("select * from public.platform_list_audit($1,$2,$3,$4,$5::timestamptz,$6::timestamptz,$7,$8)", [
        args.action ?? null, args.adminId ?? null, args.org ?? null, args.orgSearch ?? null, args.from ?? null, args.to ?? null, args.limit ?? 20, args.offset ?? 0,
      ]),
    );

  it("records who did it from the session, copying the e-mail and organization name", async () => {
    const id = await record(admin, { action: "organization.suspended", org: orgs[3].id, entityId: orgs[3].id, description: "Suspended organization", prev: { status: "active" }, next: { status: "suspended" } });
    const [row] = await list({ org: orgs[3].id });
    expect(row).toMatchObject({ id, admin_user_id: admin, admin_email: "platform.admin@example.test", action: "organization.suspended", organization_name: orgs[3].name, previous_data: { status: "active" }, new_data: { status: "suspended" } });
  });

  it("can only be written by a Platform Admin, and the administrator cannot be chosen", async () => {
    expect(await rejects(record(alice))).toMatch(/not_platform_admin/);
    expect(await rejects(record(null))).toMatch(/permission denied|not_platform_admin/);
    // the function has no admin parameter: whoever calls is who gets recorded
    await record(otherAdmin, { description: "By the second admin" });
    expect((await list({ adminId: otherAdmin }))[0].admin_user_id).toBe(otherAdmin);
  });

  it("rejects malformed entries", async () => {
    expect(await rejects(record(admin, { action: "Not An Action" }))).toMatch(/invalid_input/);
    expect(await rejects(record(admin, { description: "" }))).toMatch(/invalid_input/);
    expect(await rejects(record(admin, { description: "x".repeat(501) }))).toMatch(/invalid_input/);
    expect(await rejects(record(admin, { next: { blob: "x".repeat(25000) } }))).toMatch(/invalid_input/);
    expect(await rejects(record(admin, { entity: "something_else" }))).toMatch(/admin_audit_logs_entity_type_check/);
  });

  it("never stores credentials, at any depth", async () => {
    await record(admin, {
      description: "Credential scrub",
      prev: { name: "Acme", password: "hunter2" },
      next: { email: "a@b.test", nested: { accessToken: "abc", apiKey: "k", deeper: [{ Secret: "s", ok: 1 }] }, authorization: "Bearer x" },
    });
    const [row] = await list({ orgSearch: null, limit: 1 });
    expect(row.description).toBe("Credential scrub");
    expect(JSON.stringify(row)).not.toMatch(/hunter2|abc|"k"|Bearer|"s"/);
    expect(row.previous_data).toEqual({ name: "Acme", password: "[redacted]" });
    expect(row.new_data).toMatchObject({ email: "a@b.test", nested: { accessToken: "[redacted]", apiKey: "[redacted]", deeper: [{ Secret: "[redacted]", ok: 1 }] } });
  });

  it("cannot be read or changed directly, by anyone", async () => {
    for (const user of [alice, admin]) {
      expect(await rejects(as(user, () => q("select * from admin_audit_logs")))).toMatch(/permission denied/);
      expect(await rejects(as(user, () => q("insert into admin_audit_logs (admin_user_id, admin_email, action, entity_type, description) values ($1,'x','a.b','organization','forged')", [user])))).toMatch(/permission denied/);
      expect(await rejects(as(user, () => q("update admin_audit_logs set description='edited'")))).toMatch(/permission denied/);
      expect(await rejects(as(user, () => q("delete from admin_audit_logs")))).toMatch(/permission denied/);
    }
  });

  it("rejects UPDATE, DELETE and TRUNCATE even for the table owner", async () => {
    expect(await rejects(q("update admin_audit_logs set description='edited'"))).toMatch(/audit_log_immutable/);
    expect(await rejects(q("delete from admin_audit_logs"))).toMatch(/audit_log_immutable/);
    expect(await rejects(q("truncate admin_audit_logs"))).toMatch(/audit_log_immutable/);
    expect((await q<{ n: number }>("select count(*)::int n from admin_audit_logs"))[0].n).toBeGreaterThan(0);
  });

  it("lists newest first, filtered by action, administrator, organization and date, with a total", async () => {
    const orgA = orgs[5];
    const orgB = orgs[6];
    for (let i = 0; i < 7; i++) await record(admin, { action: "team_member.added", org: orgA.id, description: `Added member ${i}` });
    await record(otherAdmin, { action: "store.updated", entity: "store", org: orgB.id, description: "Store edit" });

    const all = await list({ limit: 100 });
    const times = all.map((r) => new Date(r.created_at).getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a)); // newest first
    expect(all.every((r) => Number(r.total_count) === all.length)).toBe(true);

    expect((await list({ action: "team_member.added", limit: 100 })).every((r) => r.action === "team_member.added")).toBe(true);
    expect((await list({ adminId: otherAdmin, limit: 100 })).every((r) => r.admin_user_id === otherAdmin)).toBe(true);
    expect((await list({ org: orgB.id })).map((r) => r.description)).toEqual(["Store edit"]);
    expect((await list({ orgSearch: orgA.name.slice(0, 5), limit: 100 })).every((r) => r.organization_name === orgA.name)).toBe(true);
    // combined
    const combo = await list({ action: "team_member.added", org: orgA.id, adminId: admin, limit: 100 });
    expect(combo).toHaveLength(7);
  });

  it("pages through the log without repeating rows", async () => {
    const total = Number((await list({ limit: 1 }))[0].total_count);
    const seen: string[] = [];
    for (let offset = 0; offset < total; offset += 5) seen.push(...(await list({ limit: 5, offset })).map((r) => r.id));
    expect(seen).toHaveLength(total);
    expect(new Set(seen).size).toBe(total);
  });

  it("filters by date range: from is inclusive, to is exclusive", async () => {
    const now = (await q<{ t: string }>("select now()::text t"))[0].t;
    const future = (await q<{ t: string }>("select (now() + interval '1 day')::text t"))[0].t;
    const past = (await q<{ t: string }>("select (now() - interval '1 day')::text t"))[0].t;
    expect((await list({ from: future, limit: 100 })).length).toBe(0);
    expect((await list({ to: past, limit: 100 })).length).toBe(0);
    expect((await list({ from: past, to: future, limit: 100 })).length).toBeGreaterThan(0);
    expect((await list({ to: now, limit: 100 })).length).toBeGreaterThan(0);
  });

  it("keeps the organization name after the organization is deleted", async () => {
    const doomed = orgs[24];
    await record(admin, { action: "organization.updated", org: doomed.id, description: "Before deletion" });
    await q("delete from tenants where id=$1", [doomed.id]);
    const [row] = await list({ org: doomed.id });
    expect(row).toMatchObject({ organization_id: doomed.id, organization_name: doomed.name, description: "Before deletion" });
  });

  it("is readable by Platform Admins only, and lists who appears in it", async () => {
    expect(await rejects(list({}, alice))).toMatch(/not_platform_admin/);
    expect(await rejects(list({}, null))).toMatch(/permission denied|not_platform_admin/);
    const admins = await as(admin, () => q<{ admin_user_id: string; admin_email: string }>("select * from public.platform_audit_admins()"));
    expect(admins.map((a) => a.admin_user_id).sort()).toEqual([admin, otherAdmin].sort());
    expect(await rejects(as(alice, () => q("select * from public.platform_audit_admins()")))).toMatch(/not_platform_admin/);
  });
});
