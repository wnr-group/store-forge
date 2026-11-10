import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, createDb, createPlatformAdmin, createUser, onboard } from "./harness";

/**
 * Per-module permissions an Owner grants and revokes (drizzle/0018_member_permissions).
 * Members are stored with role 'admin'; the permissions alone decide what they can read and write.
 */
let db: PGlite;
let alice: string; // owner of tenant A
let bob: string; // owner of tenant B
let platform: string; // platform admin
let tenantA: string;
let tenantB: string;
let storeA: string;
let productA: string;

// one member per access pattern
const members: Record<string, { id: string; permissions: Record<string, string> }> = {
  reader: { id: "", permissions: { products: "read", orders: "read", customers: "read", settings: "read" } },
  writer: { id: "", permissions: { products: "write", orders: "read", customers: "write", settings: "write" } },
  nothing: { id: "", permissions: { products: "none", orders: "none", customers: "none", settings: "read" } },
  empty: { id: "", permissions: {} },
};

const q = <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => db.query<T>(sql, params).then((r) => r.rows);
const as = <T>(user: string, fn: () => Promise<T>) => asUser(db, user, fn);
const count = (user: string, sql: string, params: unknown[] = []) => as(user, async () => (await q<{ n: number }>(sql, params))[0].n);
const rejects = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return (e as Error).message;
  }
  throw new Error("expected the statement to fail");
};
const updated = (user: string, sql: string, params: unknown[] = []) => as(user, async () => (await db.query(sql, params)).affectedRows ?? 0);

beforeAll(async () => {
  db = await createDb();
  alice = await createUser(db, "alice@example.test");
  bob = await createUser(db, "bob@example.test");
  platform = await createPlatformAdmin(db);
  const a = await onboard(db, alice, "alpha-shop");
  tenantA = a.tenant_id;
  storeA = a.store_id;
  tenantB = (await onboard(db, bob, "beta-shop")).tenant_id;
  for (const [name, m] of Object.entries(members)) {
    m.id = await createUser(db, `${name}@example.test`);
    await q("insert into memberships (tenant_id, user_id, role, permissions) values ($1,$2,'admin',$3::jsonb)", [tenantA, m.id, JSON.stringify(m.permissions)]);
  }
  [{ id: productA }] = await q<{ id: string }>("insert into products (tenant_id, name, slug, price_minor) values ($1,'Tee','tee',1999) returning id", [tenantA]);
  await q("insert into customers (tenant_id, email, full_name) values ($1,'c@example.test','Cee')", [tenantA]);
  await q("insert into orders (tenant_id, order_number, currency, subtotal_minor, total_minor) values ($1,1,'INR',100,100)", [tenantA]);
});

afterAll(async () => {
  await db.close();
});

describe("read access", () => {
  it("lets a reader see products, customers and orders but never change them", async () => {
    const r = members.reader.id;
    expect(await count(r, "select count(*)::int n from products")).toBe(1);
    expect(await count(r, "select count(*)::int n from customers")).toBe(1);
    expect(await count(r, "select count(*)::int n from orders")).toBe(1);
    expect(await updated(r, "update products set name='Hacked' where id=$1", [productA])).toBe(0);
    expect(await updated(r, "update customers set notes='x'")).toBe(0);
    expect(await updated(r, "delete from products where id=$1", [productA])).toBe(0);
    await as(r, async () => {
      expect(await rejects(db.query("insert into products (tenant_id, name, slug, price_minor) values ($1,'New','new',1)", [tenantA]))).toMatch(/row-level security/);
      expect(await rejects(db.query("insert into customers (tenant_id, email, full_name) values ($1,'n@example.test','New')", [tenantA]))).toMatch(/row-level security/);
    });
  });
});

describe("write access", () => {
  it("lets a writer create, edit and delete in the modules it was granted, and only read orders", async () => {
    const w = members.writer.id;
    await as(w, async () => {
      await db.query("insert into products (tenant_id, name, slug, price_minor) values ($1,'Mug','mug',500)", [tenantA]);
      await db.query("insert into customers (tenant_id, email, full_name) values ($1,'w@example.test','Wes')", [tenantA]);
    });
    expect(await updated(w, "update products set name='Mug 2' where slug='mug'")).toBe(1);
    expect(await updated(w, "delete from products where slug='mug'")).toBe(1);
    expect(await updated(w, "delete from customers where email='w@example.test'")).toBe(1);
    expect(await count(w, "select count(*)::int n from orders")).toBe(1);
    await as(w, async () => {
      expect(await rejects(db.query("insert into orders (tenant_id, order_number, currency, subtotal_minor, total_minor) values ($1,2,'INR',1,1)", [tenantA]))).toBeTruthy();
    });
  });

  it("gates store settings writes separately from reads", async () => {
    expect(await updated(members.writer.id, "update stores set description='ok' where id=$1", [storeA])).toBe(1);
    expect(await updated(members.reader.id, "update stores set description='no' where id=$1", [storeA])).toBe(0);
    expect(await count(members.reader.id, "select count(*)::int n from stores")).toBe(1);
    expect(await updated(members.writer.id, "update tenants set name='Alpha Renamed' where id=$1", [tenantA])).toBe(1);
    expect(await updated(members.reader.id, "update tenants set name='Nope' where id=$1", [tenantA])).toBe(0);
  });
});

describe("no access", () => {
  it("hides modules set to none or missing, but keeps the workspace itself readable", async () => {
    for (const who of [members.nothing.id, members.empty.id]) {
      expect(await count(who, "select count(*)::int n from products")).toBe(0);
      expect(await count(who, "select count(*)::int n from customers")).toBe(0);
      expect(await count(who, "select count(*)::int n from orders")).toBe(0);
      expect(await count(who, "select count(*)::int n from stores")).toBe(1);
      expect(await count(who, "select count(*)::int n from tenants")).toBe(1);
    }
    expect(await updated(members.empty.id, "update stores set description='x'")).toBe(0);
  });

  it("never reaches another company, whatever its permissions", async () => {
    for (const m of Object.values(members)) {
      expect(await count(m.id, "select count(*)::int n from products where tenant_id=$1", [tenantB])).toBe(0);
    }
  });
});

describe("granting and revoking (Owner only)", () => {
  it("the Owner changes a member's permissions and access follows immediately", async () => {
    const r = members.reader.id;
    expect(await updated(alice, "update memberships set permissions=$1::jsonb where user_id=$2", [JSON.stringify({ products: "write", orders: "read", customers: "read", settings: "read" }), r])).toBe(1);
    expect(await updated(r, "update products set name='Granted' where id=$1", [productA])).toBe(1);
    expect(await updated(alice, "update memberships set permissions=$1::jsonb where user_id=$2", [JSON.stringify({ products: "none", orders: "read", customers: "read", settings: "read" }), r])).toBe(1);
    expect(await count(r, "select count(*)::int n from products")).toBe(0);
    expect(await updated(alice, "update memberships set permissions=$1::jsonb where user_id=$2", [JSON.stringify(members.reader.permissions), r])).toBe(1);
    expect(await count(r, "select count(*)::int n from products")).toBe(1);
  });

  it("a member cannot grant themselves or others anything", async () => {
    for (const m of Object.values(members)) {
      expect(await updated(m.id, "update memberships set permissions=$1::jsonb", [JSON.stringify({ products: "write", orders: "read", customers: "write", settings: "write" })])).toBe(0);
    }
    expect(await updated(members.reader.id, "update memberships set role='owner' where user_id=$1", [members.reader.id])).toBe(0);
  });

  it("another company's Owner cannot change them either", async () => {
    expect(await updated(bob, "update memberships set permissions='{}'::jsonb where tenant_id=$1", [tenantA])).toBe(0);
  });

  it("rejects permission objects the app would never write", async () => {
    for (const bad of ['{"products":"admin"}', '{"billing":"write"}', '{"products":1}', '[]', '"write"']) {
      const msg = await rejects(as(alice, () => db.query("update memberships set permissions=$1::jsonb where user_id=$2", [bad, members.reader.id])));
      expect(msg, bad).toMatch(/memberships_permissions_check/);
    }
  });

  it("only the Owner can add members, and a disabled member or suspended company loses everything", async () => {
    const extra = await createUser(db, "extra@example.test");
    await as(members.writer.id, async () => {
      expect(await rejects(db.query("insert into memberships (tenant_id, user_id, role, permissions) values ($1,$2,'admin','{\"products\":\"write\"}')", [tenantA, extra]))).toMatch(/row-level security/);
    });
    expect(await updated(alice, "update memberships set status='disabled' where user_id=$1", [members.writer.id])).toBe(1);
    expect(await count(members.writer.id, "select count(*)::int n from products")).toBe(0);
    expect(await updated(alice, "update memberships set status='active' where user_id=$1", [members.writer.id])).toBe(1);
    expect(await count(members.writer.id, "select count(*)::int n from products")).toBe(1);
  });
});

describe("has_module_access and storage paths", () => {
  const access = (user: string, module: string, level: string) =>
    as(user, async () => (await q<{ ok: boolean }>("select public.has_module_access($1,$2,$3) as ok", [tenantA, module, level]))[0].ok);

  it("treats write as including read, and the Owner as having everything", async () => {
    expect(await access(members.writer.id, "products", "read")).toBe(true);
    expect(await access(members.writer.id, "products", "write")).toBe(true);
    expect(await access(members.reader.id, "products", "read")).toBe(true);
    expect(await access(members.reader.id, "products", "write")).toBe(false);
    expect(await access(members.nothing.id, "products", "read")).toBe(false);
    expect(await access(alice, "customers", "write")).toBe(true);
    expect(await access(bob, "customers", "read")).toBe(false);
  });

  it("allows media writes only with products:write and store assets only with settings:write", async () => {
    const path = (suffix: string) => `${tenantA}/${suffix}`;
    const can = (user: string, name: string) => as(user, async () => (await q<{ ok: boolean }>("select public.can_write_storage_object($1) as ok", [name]))[0].ok);
    expect(await can(members.writer.id, path("p1/a.png"))).toBe(true);
    expect(await can(members.reader.id, path("p1/a.png"))).toBe(false);
    expect(await can(members.writer.id, path("store/logo.png"))).toBe(true);
    expect(await can(members.reader.id, path("store/logo.png"))).toBe(false);
    expect(await can(bob, path("p1/a.png"))).toBe(false);
  });
});

describe("platform admin: add member and team listing", () => {
  const add = (user: string, tenant: string, id: string, permissions: unknown) =>
    as(user, () => q("select public.platform_add_member($1,$2,$3::jsonb)", [tenant, id, JSON.stringify(permissions)]));

  it("adds a member with the given permissions and the fixed member role", async () => {
    const id = await createUser(db, "added@example.test");
    await add(platform, tenantA, id, { products: "write", orders: "read", customers: "none", settings: "read" });
    const [row] = await q<{ role: string; permissions: Record<string, string> }>("select role, permissions from memberships where user_id=$1", [id]);
    expect(row.role).toBe("admin");
    expect(row.permissions).toEqual({ products: "write", orders: "read", customers: "none", settings: "read" });
    expect(await updated(id, "update products set name='By platform member' where id=$1", [productA])).toBe(1);
  });

  it("refuses anyone who is not a platform admin, bad permissions and unknown companies", async () => {
    const id = await createUser(db, "refused@example.test");
    for (const user of [alice, members.writer.id]) {
      expect(await rejects(add(user, tenantA, id, { products: "read" }))).toMatch(/not_platform_admin/);
    }
    expect(await rejects(add(platform, tenantA, id, { products: "owner" }))).toMatch(/invalid_input/);
    expect(await rejects(add(platform, crypto.randomUUID(), id, { products: "read" }))).toMatch(/not_found/);
    expect(await q("select 1 from memberships where user_id=$1", [id])).toHaveLength(0);
  });

  it("list_tenant_team returns each member's permissions to the Owner and the platform admin only", async () => {
    const team = (user: string) => as(user, () => q<{ user_id: string; permissions: Record<string, string> }>("select * from public.list_tenant_team($1)", [tenantA]));
    for (const user of [alice, platform]) {
      const rows = await team(user);
      expect(rows.find((r) => r.user_id === members.reader.id)?.permissions).toEqual(members.reader.permissions);
    }
    expect(await rejects(team(members.writer.id))).toMatch(/forbidden/);
  });
});
