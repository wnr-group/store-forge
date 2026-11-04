import type { PGlite } from "@electric-sql/pglite";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dbSchema, type Database } from "@/lib/db";
import { memberships, stores, tenants } from "@/lib/db/schema";
import { RlsGuardError, rowsOf, withUserContext } from "@/lib/db/user-context";
import { asAppConnection, createDb, createPlatformAdmin, createUser, onboard } from "./harness";

let pg: PGlite;
let alice: string;
let bob: string;
let carol: string; // no tenant
let tenantA: string;
let tenantB: string;
let storeA: string;
let storeB: string;

// The same Drizzle code path as production, over PGlite instead of postgres-js.
const newOrm = () => drizzle(pg, { schema: dbSchema }) as unknown as Database;
let orm: Database;

/** Full error chain (Drizzle wraps driver errors in `cause`). */
async function failure(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    const parts: string[] = [];
    for (let err: unknown = e; err instanceof Error; err = err.cause) parts.push(err.message);
    return parts.join(" | ");
  }
  return "NO_ERROR";
}

const state = async () =>
  (await pg.query<{ claims: string; sub: string; who: string }>(
    "select coalesce(current_setting('request.jwt.claims', true), '') claims, coalesce(current_setting('request.jwt.claim.sub', true), '') sub, current_user who",
  )).rows[0];

beforeAll(async () => {
  pg = await createDb();
  alice = await createUser(pg, "alice@example.test");
  bob = await createUser(pg, "bob@example.test");
  carol = await createUser(pg, "carol@example.test");
  const a = await onboard(pg, alice, "alpha-shop");
  const b = await onboard(pg, bob, "beta-shop");
  tenantA = a.tenant_id;
  storeA = a.store_id;
  tenantB = b.tenant_id;
  storeB = b.store_id;
  orm = newOrm();
});
afterAll(async () => pg.close());

describe("identity is established inside the transaction only", () => {
  it("auth.uid() and the request role are set for the user, then fully cleared", async () => {
    await asAppConnection(pg, async () => {
      const inside = await withUserContext(orm, alice, async (tx) =>
        rowsOf<{ uid: string; who: string }>(await tx.execute(sql`select auth.uid()::text as uid, current_user as who`))[0],
      );
      expect(inside).toEqual({ uid: alice, who: "authenticated" });

      const after = await state();
      expect(after).toEqual({ claims: "", sub: "", who: "storeforge_app" });
    });
  });

  it("is cleared after a rollback caused by an error, and the error propagates", async () => {
    await asAppConnection(pg, async () => {
      await expect(
        withUserContext(orm, alice, async () => {
          throw new Error("boom");
        }),
      ).rejects.toThrow("boom");
      expect(await state()).toEqual({ claims: "", sub: "", who: "storeforge_app" });
    });
  });

  it("is cleared even when the failure is a database error mid-transaction", async () => {
    await asAppConnection(pg, async () => {
      const msg = await failure(withUserContext(orm, alice, (tx) => tx.execute(sql`select 1 / 0`)));
      expect(msg).toMatch(/division by zero/);
      expect(await state()).toEqual({ claims: "", sub: "", who: "storeforge_app" });
    });
  });
});

describe("pooled connections do not leak identity between requests", () => {
  it("back-to-back requests as different users on one connection only see their own tenant", async () => {
    await asAppConnection(pg, async () => {
      const names = (uid: string) => withUserContext(orm, uid, (tx) => tx.select({ id: tenants.id }).from(tenants));
      expect((await names(alice)).map((r) => r.id)).toEqual([tenantA]);
      expect((await names(bob)).map((r) => r.id)).toEqual([tenantB]);
      expect((await names(carol)).map((r) => r.id)).toEqual([]);
      expect((await names(alice)).map((r) => r.id)).toEqual([tenantA]);
    });
  });

  it("interleaved concurrent requests stay isolated", async () => {
    await asAppConnection(pg, async () => {
      const run = (uid: string) =>
        withUserContext(orm, uid, async (tx) => {
          const [t] = await tx.select({ id: tenants.id }).from(tenants);
          return t?.id ?? null;
        });
      const results = await Promise.all([run(alice), run(bob), run(carol), run(bob), run(alice)]);
      expect(results).toEqual([tenantA, tenantB, null, tenantB, tenantA]);
    });
  });

  it("a request that fails does not poison the next user's request", async () => {
    await asAppConnection(pg, async () => {
      await failure(withUserContext(orm, alice, (tx) => tx.execute(sql`select 1 / 0`)));
      const seen = await withUserContext(orm, bob, (tx) => tx.select({ id: tenants.id }).from(tenants));
      expect(seen.map((r) => r.id)).toEqual([tenantB]);
    });
  });
});

describe("no context, no access", () => {
  it("the raw connection (without a user context) cannot read tenant data", async () => {
    await asAppConnection(pg, async () => {
      expect(await failure(orm.select().from(tenants))).toMatch(/permission denied/);
      expect(await failure(orm.select().from(stores))).toMatch(/permission denied/);
    });
  });
});

describe("untrusted user ids are rejected before any SQL runs", () => {
  it.each(["", "not-a-uuid", "x'; drop table tenants; --", "' or '1'='1", `${alice}; select 1`, "00000000-0000-0000-0000-00000000000g"])(
    "rejects %j",
    async (bad) => {
      await asAppConnection(pg, async () => {
        await expect(withUserContext(orm, bad, async () => "ran")).rejects.toThrow(/must be a UUID/);
      });
      expect((await pg.query("select count(*)::int n from tenants")).rows[0]).toEqual({ n: 2 });
    },
  );
});

describe("Drizzle queries are isolated by RLS (merchant A vs merchant B)", () => {
  it("A can read and write its own store", async () => {
    await asAppConnection(pg, async () => {
      const updated = await withUserContext(orm, alice, (tx) =>
        tx.update(stores).set({ description: "mine" }).where(eq(stores.id, storeA)).returning({ id: stores.id }),
      );
      expect(updated).toHaveLength(1);
    });
  });

  it("A cannot read B's tenant, store or memberships even by explicit id", async () => {
    await asAppConnection(pg, async () => {
      await withUserContext(orm, alice, async (tx) => {
        expect(await tx.select().from(tenants).where(eq(tenants.id, tenantB))).toHaveLength(0);
        expect(await tx.select().from(stores).where(eq(stores.tenantId, tenantB))).toHaveLength(0);
        expect(await tx.select().from(memberships).where(eq(memberships.tenantId, tenantB))).toHaveLength(0);
      });
    });
  });

  it("A cannot update or delete B's store", async () => {
    await asAppConnection(pg, async () => {
      await withUserContext(orm, alice, async (tx) => {
        expect(await tx.update(stores).set({ name: "pwned" }).where(eq(stores.id, storeB)).returning()).toHaveLength(0);
        expect(await tx.delete(stores).where(eq(stores.id, storeB)).returning()).toHaveLength(0);
      });
    });
    expect((await pg.query("select name from stores where id = $1", [storeB])).rows[0]).not.toEqual({ name: "pwned" });
  });

  it("A cannot create a store in B's tenant", async () => {
    await asAppConnection(pg, async () => {
      const msg = await failure(
        withUserContext(orm, alice, (tx) => tx.insert(stores).values({ tenantId: tenantB, name: "Evil", slug: "evil-shop" })),
      );
      expect(msg).toMatch(/row-level security/);
    });
  });

  it("A cannot grant itself membership in B's tenant", async () => {
    await asAppConnection(pg, async () => {
      for (const role of ["owner", "admin", "staff"] as const) {
        const msg = await failure(
          withUserContext(orm, alice, (tx) => tx.insert(memberships).values({ tenantId: tenantB, userId: alice, role })),
        );
        expect(msg, role).toMatch(/row-level security|permission denied/);
      }
    });
  });

  it("a user without membership gets nothing", async () => {
    await asAppConnection(pg, async () => {
      await withUserContext(orm, carol, async (tx) => {
        expect(await tx.select().from(tenants)).toHaveLength(0);
        expect(await tx.select().from(stores)).toHaveLength(0);
      });
    });
  });
});

describe("transactions", () => {
  it("roll back every statement when a later one fails", async () => {
    await asAppConnection(pg, async () => {
      await failure(
        withUserContext(orm, alice, async (tx) => {
          await tx.insert(stores).values({ tenantId: tenantA, name: "Second Store", slug: "second-store" });
          await tx.insert(stores).values({ tenantId: tenantA, name: "Dup Slug", slug: "second-store" }); // unique violation
        }),
      );
    });
    expect((await pg.query("select 1 from stores where slug = 'second-store'")).rows).toHaveLength(0);
  });

  it("commit when everything succeeds, and constraints still apply", async () => {
    await asAppConnection(pg, async () => {
      await withUserContext(orm, alice, (tx) => tx.insert(stores).values({ tenantId: tenantA, name: "Second Store", slug: "second-store" }));
      const msg = await failure(
        withUserContext(orm, alice, (tx) => tx.insert(stores).values({ tenantId: tenantA, name: "Bad Cur", slug: "bad-currency", currency: "rupees" })),
      );
      expect(msg).toMatch(/stores_currency_check|check constraint/);
    });
    expect((await pg.query("select 1 from stores where slug = 'second-store'")).rows).toHaveLength(1);
  });

  it("provisioning through Drizzle is Platform-Admin only, atomic and idempotent", async () => {
    const admin = await createPlatformAdmin(pg);
    await asAppConnection(pg, async () => {
      const call = (actor: string, owner: string, slug: string) =>
        withUserContext(orm, actor, async (tx) =>
          rowsOf<{ r: { tenant_id: string; created: boolean } }>(
            await tx.execute(sql`select public.platform_provision_tenant(${owner}::uuid, ${"Carol Co"}, ${"Carol Store"}, ${slug}, ${null}) as r`),
          )[0].r,
        );
      const first = await call(admin, carol, "carol-shop");
      const again = await call(admin, carol, "carol-shop");
      expect(first.created).toBe(true);
      expect(again).toMatchObject({ created: false, tenant_id: first.tenant_id });
      expect(await failure(call(admin, bob, "carol-shop"))).toMatch(/slug_taken/);
      // The same call from a regular user (even naming themselves owner) is refused.
      expect(await failure(call(carol, carol, "carol-self-made"))).toMatch(/not_platform_admin/);
    });
    expect((await pg.query("select count(*)::int n from tenants where created_by = $1", [carol])).rows[0]).toEqual({ n: 1 });
  });
});

describe("RLS guard refuses unsafe database roles", () => {
  it("rejects a superuser connection (which would bypass RLS)", async () => {
    const msg = await failure(withUserContext(newOrm(), alice, async () => "ran")); // PGlite default session = superuser
    expect(msg).toMatch(/can bypass row level security/);
  });

  it("rejects a BYPASSRLS login role that is allowed to switch to `authenticated`", async () => {
    await pg.exec("create role bypass_login login bypassrls; grant authenticated to bypass_login");
    await pg.exec("set session authorization bypass_login");
    try {
      const msg = await failure(withUserContext(newOrm(), alice, async () => "ran"));
      expect(msg).toMatch(/bypass_login can bypass row level security/);
    } finally {
      await pg.exec("set session authorization postgres");
    }
  });

  it("a login role that cannot switch to `authenticated` is refused outright", async () => {
    await pg.exec("set session authorization service_role");
    try {
      const msg = await failure(withUserContext(newOrm(), alice, async () => "ran"));
      expect(msg).toMatch(/permission denied to set role "authenticated"/);
    } finally {
      await pg.exec("set session authorization postgres");
    }
  });

  it("does not remember a failed check (fails every time) and runs no user code", async () => {
    const guarded = newOrm();
    let ran = 0;
    for (let i = 0; i < 2; i++) {
      await expect(withUserContext(guarded, alice, async () => void ran++)).rejects.toBeInstanceOf(Error);
    }
    expect(ran).toBe(0);
  });

  it("passes for the dedicated application role", async () => {
    await asAppConnection(pg, async () => {
      await expect(withUserContext(newOrm(), alice, async () => "ok")).resolves.toBe("ok");
    });
    expect(RlsGuardError.name).toBe("RlsGuardError");
  });
});
