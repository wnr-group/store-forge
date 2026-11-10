import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, createDb, createUser, onboard } from "./harness";

let db: PGlite;
let alice: string; // owner of tenant A
let bob: string; // owner of tenant B
let carol: string; // no tenants
let tenantA: string;
let tenantB: string;
let storeA: string;
let storeB: string;

const q = <T = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
  db.query<T>(sql, params).then((r) => r.rows);

beforeAll(async () => {
  db = await createDb();
  alice = await createUser(db, "alice@example.test", "Alice A");
  bob = await createUser(db, "bob@example.test", "Bob B");
  carol = await createUser(db, "carol@example.test");
  const a = await onboard(db, alice, "alpha-shop");
  const b = await onboard(db, bob, "beta-shop");
  tenantA = a.tenant_id;
  storeA = a.store_id;
  tenantB = b.tenant_id;
  storeB = b.store_id;
});

afterAll(async () => {
  await db.close();
});

describe("platform provisioning RPC", () => {
  it("creates tenant, owner membership and store", async () => {
    const [m] = await q<{ role: string }>("select role from memberships where tenant_id=$1 and user_id=$2", [tenantA, alice]);
    expect(m.role).toBe("owner");
    const [s] = await q<{ tenant_id: string; currency: string; status: string }>("select * from stores where id=$1", [storeA]);
    expect(s).toMatchObject({ tenant_id: tenantA, currency: "INR", status: "active" });
  });

  it("is idempotent for a repeated request (no duplicate tenant)", async () => {
    const again = await onboard(db, alice, "alpha-shop");
    expect(again.created).toBe(false);
    expect(again.tenant_id).toBe(tenantA);
    const [{ n }] = await q<{ n: number }>("select count(*)::int n from tenants where created_by=$1", [alice]);
    expect(n).toBe(1);
  });

  it("rejects a slug owned by another merchant", async () => {
    await expect(onboard(db, carol, "alpha-shop")).rejects.toThrow(/slug_taken/);
    expect(await q("select 1 from memberships where user_id=$1", [carol])).toHaveLength(0);
  });

  it.each(["UPPER", "a", "-bad-", "has space", "dou--ble", "admin", "www"])("rejects invalid/reserved slug %s", async (slug) => {
    await expect(onboard(db, carol, slug)).rejects.toThrow(/invalid_slug/);
  });

  it("rejects unauthenticated callers", async () => {
    await expect(
      asUser(db, null, () => db.query("select public.platform_provision_tenant($1,'Biz','Store','anon-shop')", [carol])),
    ).rejects.toThrow();
  });

  it("rejects a regular (non-admin) signed-in user, so there is no self-service tenant creation", async () => {
    await expect(
      asUser(db, carol, () => db.query("select public.platform_provision_tenant($1,'Biz','Store','self-made')", [carol])),
    ).rejects.toThrow(/not_platform_admin/);
    expect(await q("select 1 from tenants where slug = 'self-made'")).toHaveLength(0);
  });

  it("rolls back everything if a later step fails", async () => {
    await db.exec(`
      create function public.test_boom() returns trigger language plpgsql as $$ begin raise exception 'boom'; end $$;
      create trigger test_boom before insert on public.stores for each row execute function public.test_boom();
    `);
    await expect(onboard(db, carol, "rollback-shop")).rejects.toThrow(/boom/);
    await db.exec("drop trigger test_boom on public.stores; drop function public.test_boom();");
    expect(await q("select 1 from tenants where name = 'rollback-shop Inc'")).toHaveLength(0);
    expect(await q("select 1 from memberships where user_id=$1", [carol])).toHaveLength(0);
  });

  it("allows a retry after a failed attempt", async () => {
    const r = await onboard(db, carol, "carol-shop");
    expect(r.created).toBe(true);
    await db.query("delete from tenants where id=$1", [r.tenant_id]); // cleanup (superuser)
  });
});

describe("profiles", () => {
  it("are created by trigger from auth.users", async () => {
    const [p] = await q<{ full_name: string }>("select full_name from profiles where id=$1", [alice]);
    expect(p.full_name).toBe("Alice A");
  });

  it("can be read and updated only by their owner", async () => {
    await asUser(db, alice, async () => {
      expect(await q("select id from profiles")).toHaveLength(1);
      await db.query("update profiles set full_name='Alice X' where id=$1", [alice]);
      const res = await db.query("update profiles set full_name='Hacked' where id=$1", [bob]);
      expect(res.affectedRows).toBe(0);
    });
    const [p] = await q<{ full_name: string }>("select full_name from profiles where id=$1", [bob]);
    expect(p.full_name).toBe("Bob B");
  });

  it("cannot be inserted or deleted by clients", async () => {
    await asUser(db, carol, async () => {
      await expect(db.query("insert into profiles (id) values ($1)", [carol])).rejects.toThrow();
      await expect(db.query("delete from profiles where id=$1", [carol])).rejects.toThrow();
    });
  });
});

describe("cross-tenant isolation (Merchant A vs Merchant B)", () => {
  it("A only sees its own tenant, store and memberships", async () => {
    await asUser(db, alice, async () => {
      expect((await q<{ id: string }>("select id from tenants")).map((r) => r.id)).toEqual([tenantA]);
      expect((await q<{ id: string }>("select id from stores")).map((r) => r.id)).toEqual([storeA]);
      expect(await q("select 1 from memberships where tenant_id=$1", [tenantB])).toHaveLength(0);
    });
  });

  it("A cannot read B's tenant by explicit id", async () => {
    await asUser(db, alice, async () => {
      expect(await q("select 1 from tenants where id=$1", [tenantB])).toHaveLength(0);
      expect(await q("select 1 from stores where tenant_id=$1", [tenantB])).toHaveLength(0);
    });
  });

  it("A cannot update B's store or tenant", async () => {
    await asUser(db, alice, async () => {
      expect((await db.query("update stores set name='pwned' where id=$1", [storeB])).affectedRows).toBe(0);
      expect((await db.query("update tenants set name='pwned' where id=$1", [tenantB])).affectedRows).toBe(0);
    });
    const [s] = await q<{ name: string }>("select name from stores where id=$1", [storeB]);
    expect(s.name).not.toBe("pwned");
  });

  it("A cannot delete B's store or tenant", async () => {
    await asUser(db, alice, async () => {
      expect((await db.query("delete from stores where id=$1", [storeB])).affectedRows).toBe(0);
      expect((await db.query("delete from tenants where id=$1", [tenantB])).affectedRows).toBe(0);
    });
    expect(await q("select 1 from stores where id=$1", [storeB])).toHaveLength(1);
  });

  it("A cannot create a store in B's tenant", async () => {
    await asUser(db, alice, async () => {
      await expect(
        db.query("insert into stores (tenant_id, name, slug) values ($1,'Evil','evil-shop')", [tenantB]),
      ).rejects.toThrow(/row-level security/);
    });
  });

  it("A cannot move its store into B's tenant", async () => {
    await asUser(db, alice, async () => {
      await expect(db.query("update stores set tenant_id=$1 where id=$2", [tenantB, storeA])).rejects.toThrow();
    });
  });

  it("A cannot add itself to B's tenant at any role", async () => {
    await asUser(db, alice, async () => {
      for (const role of ["owner", "admin", "staff"]) {
        await expect(
          db.query("insert into memberships (tenant_id, user_id, role) values ($1,$2,$3)", [tenantB, alice, role]),
        ).rejects.toThrow();
      }
    });
  });

  it("a user without membership sees nothing", async () => {
    await asUser(db, carol, async () => {
      expect(await q("select 1 from tenants")).toHaveLength(0);
      expect(await q("select 1 from stores")).toHaveLength(0);
      expect(await q("select 1 from memberships")).toHaveLength(0);
    });
  });

  it("anon has no access at all", async () => {
    await asUser(db, null, async () => {
      await expect(db.query("select * from tenants")).rejects.toThrow(/permission denied/);
      await expect(db.query("select * from stores")).rejects.toThrow(/permission denied/);
    });
  });

  it("direct tenant / owner-membership inserts are denied (RPC only)", async () => {
    await asUser(db, carol, async () => {
      await expect(db.query("insert into tenants (name, slug) values ('X Co','x-co')")).rejects.toThrow();
    });
  });
});

describe("role-based policies and privilege escalation", () => {
  let dave: string; // staff in A
  let erin: string; // admin in A

  beforeAll(async () => {
    dave = await createUser(db, "dave@example.test");
    erin = await createUser(db, "erin@example.test");
    await asUser(db, alice, async () => {
      await db.query("insert into memberships (tenant_id,user_id,role,permissions) values ($1,$2,'staff','{\"products\":\"write\",\"orders\":\"read\",\"customers\":\"write\",\"settings\":\"read\"}')", [tenantA, dave]);
      await db.query("insert into memberships (tenant_id,user_id,role,permissions) values ($1,$2,'admin','{\"products\":\"write\",\"orders\":\"write\",\"customers\":\"write\",\"settings\":\"write\"}')", [tenantA, erin]);
    });
  });

  it("multiple-tenant membership works", async () => {
    await asUser(db, alice, async () => {
      await expect(
        db.query("insert into memberships (tenant_id,user_id,role) values ($1,$2,'staff')", [tenantA, bob]),
      ).resolves.toBeDefined();
    });
    await asUser(db, bob, async () => {
      expect(await q("select 1 from tenants")).toHaveLength(2);
    });
    await db.query("delete from memberships where tenant_id=$1 and user_id=$2", [tenantA, bob]);
  });

  it("staff cannot promote themselves", async () => {
    await asUser(db, dave, async () => {
      for (const role of ["admin", "owner"]) {
        const res = await db.query("update memberships set role=$1 where user_id=$2", [role, dave]);
        expect(res.affectedRows).toBe(0);
      }
    });
    const [m] = await q<{ role: string }>("select role from memberships where user_id=$1", [dave]);
    expect(m.role).toBe("staff");
  });

  it("admin cannot promote themselves or others to owner", async () => {
    await asUser(db, erin, async () => {
      expect((await db.query("update memberships set role='owner' where user_id=$1", [erin])).affectedRows).toBe(0);
      expect((await db.query("update memberships set role='owner' where user_id=$1", [dave])).affectedRows).toBe(0);
    });
  });

  it("only the owner adds members: admin-role members cannot add anyone, at any role", async () => {
    const frank = await createUser(db, "frank@example.test");
    await asUser(db, erin, async () => {
      for (const role of ["owner", "admin", "staff"]) {
        await expect(
          db.query("insert into memberships (tenant_id,user_id,role) values ($1,$2,$3)", [tenantA, frank, role]),
        ).rejects.toThrow();
      }
    });
    await asUser(db, alice, async () => {
      await expect(
        db.query("insert into memberships (tenant_id,user_id,role,permissions) values ($1,$2,'admin','{\"products\":\"read\"}')", [tenantA, frank]),
      ).resolves.toBeDefined();
    });
  });

  it("owner role is protected: cannot be changed or removed by anyone via RLS", async () => {
    for (const actor of [alice, erin, dave]) {
      await asUser(db, actor, async () => {
        expect((await db.query("update memberships set role='staff' where user_id=$1", [alice])).affectedRows).toBe(0);
        expect((await db.query("delete from memberships where user_id=$1 and tenant_id=$2", [alice, tenantA])).affectedRows).toBe(0);
      });
    }
    expect(await q("select 1 from memberships where user_id=$1 and role='owner'", [alice])).toHaveLength(1);
  });

  it("membership identity columns are immutable", async () => {
    await asUser(db, alice, async () => {
      await expect(db.query("update memberships set user_id=$1 where user_id=$2", [carol, dave])).rejects.toThrow(/permission denied/);
      await expect(db.query("update memberships set tenant_id=$1 where user_id=$2", [tenantB, dave])).rejects.toThrow(/permission denied/);
    });
  });

  it("owner can change an admin to staff", async () => {
    await asUser(db, alice, async () => {
      expect((await db.query("update memberships set role='staff' where user_id=$1", [erin])).affectedRows).toBe(1);
      expect((await db.query("update memberships set role='admin' where user_id=$1", [erin])).affectedRows).toBe(1);
    });
  });

  it("staff can read but not write stores", async () => {
    await asUser(db, dave, async () => {
      expect(await q("select 1 from stores")).toHaveLength(1);
      expect((await db.query("update stores set name='Staff Edit' where id=$1", [storeA])).affectedRows).toBe(0);
      expect((await db.query("delete from stores where id=$1", [storeA])).affectedRows).toBe(0);
      await expect(
        db.query("insert into stores (tenant_id,name,slug) values ($1,'S2','staff-made')", [tenantA]),
      ).rejects.toThrow();
    });
  });

  it("admin can edit stores/tenant but cannot delete them", async () => {
    await asUser(db, erin, async () => {
      expect((await db.query("update stores set description='hi' where id=$1", [storeA])).affectedRows).toBe(1);
      expect((await db.query("update tenants set name='Alpha Renamed' where id=$1", [tenantA])).affectedRows).toBe(1);
      expect((await db.query("delete from stores where id=$1", [storeA])).affectedRows).toBe(0);
      expect((await db.query("delete from tenants where id=$1", [tenantA])).affectedRows).toBe(0);
    });
  });

  it("created_by on tenants cannot be rewritten", async () => {
    await asUser(db, alice, async () => {
      await expect(db.query("update tenants set created_by=$1 where id=$2", [carol, tenantA])).rejects.toThrow(/permission denied/);
    });
  });

  it("a member can leave a tenant but a removed user loses access", async () => {
    await asUser(db, dave, async () => {
      expect((await db.query("delete from memberships where user_id=$1", [dave])).affectedRows).toBe(1);
      expect(await q("select 1 from stores")).toHaveLength(0);
    });
  });

  it("updated_at trigger advances on update", async () => {
    const [before] = await q<{ updated_at: string }>("select updated_at from stores where id=$1", [storeA]);
    await new Promise((r) => setTimeout(r, 15));
    await db.query("update stores set description='tick' where id=$1", [storeA]);
    const [after] = await q<{ updated_at: string }>("select updated_at from stores where id=$1", [storeA]);
    expect(new Date(after.updated_at).getTime()).toBeGreaterThan(new Date(before.updated_at).getTime());
  });
});

describe("slug availability", () => {
  it("reports taken, free and reserved slugs", async () => {
    await asUser(db, carol, async () => {
      const check = async (s: string) => (await q<{ a: boolean }>("select public.is_store_slug_available($1) a", [s]))[0].a;
      expect(await check("alpha-shop")).toBe(false);
      expect(await check("brand-new-shop")).toBe(true);
      expect(await check("admin")).toBe(false);
    });
  });
});
