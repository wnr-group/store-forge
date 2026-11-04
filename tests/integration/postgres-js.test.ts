import type { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createDb, createPlatformAdmin, createUser, onboard } from "../db/harness";

/**
 * Drives the REAL production database path - getDatabase() -> postgres-js
 * (prepare:false, bind parameters, extended protocol) -> services - over a
 * genuine Postgres wire-protocol connection logged in as `storeforge_app`.
 * Only the Supabase session lookup is replaced.
 *
 * Limits: the server is PGlite (single backend session, so no concurrent
 * transactions here) and there is no Supavisor pooler in between.
 */
const h = vi.hoisted(() => ({ user: null as { id: string } | null }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: async () => h.user, requireUser: async () => h.user }));

import { getDatabase } from "@/lib/db";
import { memberships, stores, tenants } from "@/lib/db/schema";
import { withAuthenticatedDb } from "@/lib/db/tenant-db";
import { rowsOf, withPublicContext, withUserContext } from "@/lib/db/user-context";
import { getPublicStorefront } from "@/services/storefront.service";
import { listStores } from "@/services/store.service";
import { createTenantRecords, listCompanies } from "@/services/platform.service";
import { listMembershipsForUser } from "@/services/tenant.service";
import type { CreateCompanyValues } from "@/lib/validations/company";

let pg: PGlite;
let server: PGLiteSocketServer;
let alice: string;
let bob: string;
let carol: string;
let platformAdmin: string;
let tenantA: string;
let tenantB: string;

const withPublicContextCount = () => withPublicContext(getDatabase(), async (tx) => rowsOf<{ n: number }>(await tx.execute(sql`select count(*)::int n from public.tenants`))[0].n);
const as = <T>(user: string | null, fn: () => Promise<T>) => {
  h.user = user ? { id: user } : null;
  return fn();
};
/** Inspect raw table state as the superuser (the wire connections stay logged in as storeforge_app). */
const admin = async <T>(sqlText: string, params: unknown[] = []): Promise<T[]> => {
  await pg.exec("set session authorization postgres");
  try {
    return (await pg.query<T>(sqlText, params)).rows;
  } finally {
    await pg.exec("set session authorization storeforge_app");
  }
};
const chain = (e: unknown) => {
  const parts: string[] = [];
  for (let err: unknown = e; err instanceof Error; err = err.cause) parts.push(err.message);
  return parts.join(" | ");
};
const fail = async (p: Promise<unknown>) => p.then(() => "NO_ERROR", chain);

beforeAll(async () => {
  pg = await createDb();
  alice = await createUser(pg, "alice@example.test");
  bob = await createUser(pg, "bob@example.test");
  carol = await createUser(pg, "carol@example.test");
  platformAdmin = await createPlatformAdmin(pg);
  tenantA = (await onboard(pg, alice, "alpha-shop")).tenant_id;
  tenantB = (await onboard(pg, bob, "beta-shop")).tenant_id;

  // From here on every wire connection acts as the application login role.
  await pg.exec("set session authorization storeforge_app");
  const port = 55000 + Math.floor(Math.random() * 4000);
  server = new PGLiteSocketServer({ db: pg, port, host: "127.0.0.1" });
  await server.start();
  process.env.DATABASE_URL = `postgresql://storeforge_app:pw@127.0.0.1:${port}/postgres`;
});

afterAll(async () => {
  const cache = (globalThis as unknown as { __storeforgeDb?: { client?: { end: () => Promise<void> } } }).__storeforgeDb;
  await cache?.client?.end();
  await server?.stop();
  await pg?.close();
});

describe("postgres-js connection", () => {
  it("connects as storeforge_app (not a bypass role) and the env guard accepts the URL", async () => {
    const rows = rowsOf<{ u: string }>(await getDatabase().execute(sql`select current_user as u`));
    expect(rows).toEqual([{ u: "storeforge_app" }]);
  });

  it("the raw pooled client has no table access without a user context", async () => {
    expect(chain(await getDatabase().select().from(tenants).catch((e) => e))).toMatch(/permission denied/);
  });
});

describe("user context over the real driver", () => {
  it("sets identity and role inside the transaction and clears them after", async () => {
    const inside = await withUserContext(getDatabase(), alice, async (tx) =>
      rowsOf<{ uid: string; who: string }>(await tx.execute(sql`select auth.uid()::text as uid, current_user as who`))[0],
    );
    expect(inside).toEqual({ uid: alice, who: "authenticated" });

    const after = rowsOf<{ claims: string; who: string }>(
      await getDatabase().execute(sql`select coalesce(current_setting('request.jwt.claims', true), '') as claims, current_user as who`),
    )[0];
    expect(after).toEqual({ claims: "", who: "storeforge_app" });
  });

  it("sequential requests as different users never see each other's data", async () => {
    const visible = (uid: string) => withUserContext(getDatabase(), uid, (tx) => tx.select({ id: tenants.id }).from(tenants));
    expect((await visible(alice)).map((r) => r.id)).toEqual([tenantA]);
    expect((await visible(bob)).map((r) => r.id)).toEqual([tenantB]);
    expect(await visible(carol)).toEqual([]);
    expect((await visible(alice)).map((r) => r.id)).toEqual([tenantA]);
  });

  it("a failed request leaves the pooled connection clean for the next user", async () => {
    expect(await fail(withUserContext(getDatabase(), alice, (tx) => tx.execute(sql`select 1 / 0`)))).toMatch(/division by zero/);
    const seen = await withUserContext(getDatabase(), bob, (tx) => tx.select({ id: tenants.id }).from(tenants));
    expect(seen.map((r) => r.id)).toEqual([tenantB]);
  });

  it("rejects malformed user ids before sending any SQL", async () => {
    await expect(withUserContext(getDatabase(), "x'; drop table tenants; --", async () => 1)).rejects.toThrow(/UUID/);
  });
});

describe("RLS through postgres-js", () => {
  it("cross-tenant reads, updates, deletes and inserts are blocked", async () => {
    await withUserContext(getDatabase(), alice, async (tx) => {
      expect(await tx.select().from(stores).where(eq(stores.tenantId, tenantB))).toHaveLength(0);
      expect(await tx.update(stores).set({ name: "pwned" }).where(eq(stores.tenantId, tenantB)).returning()).toHaveLength(0);
      expect(await tx.delete(stores).where(eq(stores.tenantId, tenantB)).returning()).toHaveLength(0);
      expect(await tx.select().from(memberships).where(eq(memberships.tenantId, tenantB))).toHaveLength(0);
    });
    const insert = withUserContext(getDatabase(), alice, (tx) => tx.insert(stores).values({ tenantId: tenantB, name: "Evil", slug: "evil-shop" }));
    expect(await fail(insert)).toMatch(/row-level security/);
  });

  it("rolls back every statement when a later one fails", async () => {
    await fail(
      withUserContext(getDatabase(), alice, async (tx) => {
        await tx.insert(stores).values({ tenantId: tenantA, name: "Second", slug: "second-store" });
        throw new Error("boom");
      }),
    );
    expect(await admin("select 1 from stores where slug = 'second-store'")).toHaveLength(0);
  });
});

describe("services over the real driver", () => {
  it("lists memberships and stores for the signed-in user only", async () => {
    const list = await as(alice, listMembershipsForUser);
    expect(list.map((m) => [m.tenant.id, m.role])).toEqual([[tenantA, "owner"]]);
    expect(list[0].joinedAt).toBeInstanceOf(Date);
    expect(await as(alice, () => listStores(tenantA))).toHaveLength(1);
    expect(await as(alice, () => listStores(tenantB))).toEqual([]);
  });

  it("refuses to run without a session", async () => {
    await expect(as(null, listMembershipsForUser)).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  const company = (storeSlug: string, ownerId = "owner"): CreateCompanyValues => ({
    companyName: "Carol Co", storeName: "Carol Store", storeSlug, storeDescription: null, contactPhone: "+91 98765 43210", address: "1 Main Street",
    ownerName: "Carol", ownerEmail: `${ownerId}@example.test`, ownerPassword: "initial-pass-1",
  });

  it("provisions a company atomically and idempotently (jsonb result parsed by the driver)", async () => {
    const first = await as(platformAdmin, () => createTenantRecords(carol, company("carol-store")));
    expect(first).toMatchObject({ created: true, store_slug: "carol-store" });
    const again = await as(platformAdmin, () => createTenantRecords(carol, company("carol-store")));
    expect(again).toMatchObject({ created: false, tenant_id: first.tenant_id });
    expect(await admin("select count(*)::int n from tenants where created_by = $1", [carol])).toEqual([{ n: 1 }]);
    expect(await admin("select role from memberships where user_id = $1", [carol])).toEqual([{ role: "owner" }]);
    expect(await admin("select status, contact_phone, address from tenants where id = $1", [first.tenant_id])).toEqual([
      { status: "active", contact_phone: "+91 98765 43210", address: "1 Main Street" },
    ]);
  });

  it("maps database errors from the driver error chain to field errors", async () => {
    await expect(
      as(platformAdmin, () => createTenantRecords(bob, company("carol-store"))),
    ).rejects.toMatchObject({ code: "CONFLICT", fieldErrors: { storeSlug: expect.any(String) } });
    await expect(
      as(platformAdmin, () => createTenantRecords(bob, company("admin"))),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("refuses a regular user or tenant owner even when they call the service directly", async () => {
    await expect(as(bob, () => createTenantRecords(bob, company("bobs-second")))).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await admin("select 1 from stores where slug = $1", ["bobs-second"])).toHaveLength(0);
  });

  it("lists companies only for the Platform Admin", async () => {
    const list = await as(platformAdmin, () => listCompanies());
    expect(list.map((c) => c.storeSlug)).toEqual(expect.arrayContaining(["alpha-shop", "beta-shop", "carol-store"]));
    expect(list.find((c) => c.storeSlug === "alpha-shop")).toMatchObject({ status: "active", memberCount: 1 });
    await expect(as(alice, () => listCompanies())).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(as(null, () => listCompanies())).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("serves the public storefront with no session, through the real driver and the app role", async () => {
    const store = await as(null, () => getPublicStorefront("alpha-shop"));
    expect(store).toMatchObject({ slug: "alpha-shop", products: [] });
    expect(await as(null, () => getPublicStorefront("no-such-shop"))).toBeNull();
    expect(await as(null, () => getPublicStorefront("admin"))).toBeNull();
    // The identity-less request role reads no tables directly.
    expect(await as(null, () => withPublicContextCount())).toBe(0);
  });

  it("withAuthenticatedDb never accepts an identity from the caller", async () => {
    const seen = await as(alice, () => withAuthenticatedDb(async (tx, user) => ({ user, tenants: await tx.select({ id: tenants.id }).from(tenants) })));
    expect(seen.user.id).toBe(alice);
    expect(seen.tenants.map((t) => t.id)).toEqual([tenantA]);
  });
});
