import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { asAppConnection, createDb, createUser, onboard } from "./harness";

// ---- Test doubles for the Next.js / Supabase edges; everything below them is real ----
const h = vi.hoisted(() => ({
  user: null as { id: string } | null,
  orm: null as unknown,
  cookie: undefined as string | undefined,
  storeSlug: null as string | null,
  cookieSets: [] as Array<[string, string]>,
}));

const redirectError = (url: string) => Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;replace;${url};307;`, url });

vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: async () => h.user,
  requireUser: async () => {
    if (!h.user) throw redirectError("/login");
    return h.user;
  },
}));
vi.mock("@/lib/db", async (orig) => ({ ...(await orig<typeof import("@/lib/db")>()), getDatabase: () => h.orm }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (h.cookie ? { value: h.cookie } : undefined),
    set: (name: string, value: string) => void h.cookieSets.push([name, value]),
  }),
  headers: async () => ({ get: (name: string) => (name === "x-sf-store" ? h.storeSlug : null) }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw redirectError(url);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { switchTenantAction } from "@/app/(dashboard)/actions";
import { dbSchema, type Database } from "@/lib/db";
import { memberships, stores, tenants } from "@/lib/db/schema";
import { withAuthenticatedDb } from "@/lib/db/tenant-db";
import {
  getActiveTenant,
  getUserTenants,
  requireTenantAccess,
  requireTenantRole,
  requireWorkspace,
  withTenantDb,
} from "@/lib/tenant/context";
import { listStores } from "@/services/store.service";

let pg: PGlite;
let alice: string; // owner of A
let bob: string; // owner of B
let carol: string; // no tenant yet
let dave: string; // staff in A, owner of D (two tenants)
let erin: string; // admin in A
let tenantA: string;
let tenantB: string;
let tenantD: string;
let storeB: string;

/** Run as the application login role, acting as `user` (null = signed out). */
const as = async <T>(user: string | null, fn: () => Promise<T>, cookie?: string): Promise<T> => {
  h.user = user ? { id: user } : null;
  h.cookie = cookie;
  return asAppConnection(pg, fn);
};
const code = async (p: Promise<unknown>) => p.then(() => "NO_ERROR", (e: { code?: string; digest?: string }) => e.code ?? e.digest ?? String(e));

beforeAll(async () => {
  pg = await createDb();
  h.orm = drizzle(pg, { schema: dbSchema }) as unknown as Database;
  [alice, bob, carol, dave, erin] = await Promise.all(
    ["alice", "bob", "carol", "dave", "erin"].map((n) => createUser(pg, `${n}@example.test`)),
  );
  tenantA = (await onboard(pg, alice, "alpha-shop")).tenant_id;
  const b = await onboard(pg, bob, "beta-shop");
  tenantB = b.tenant_id;
  storeB = b.store_id;
  tenantD = (await onboard(pg, dave, "delta-shop")).tenant_id;
  await pg.query("insert into memberships (tenant_id, user_id, role, permissions) values ($1,$2,'staff','{\"products\":\"write\",\"orders\":\"read\",\"customers\":\"write\",\"settings\":\"read\"}'),($1,$3,'admin','{\"products\":\"write\",\"orders\":\"write\",\"customers\":\"write\",\"settings\":\"write\"}')", [tenantA, dave, erin]);
});
afterAll(async () => pg.close());
beforeEach(() => {
  h.cookieSets = [];
});

describe("getUserTenants / multi-tenant membership", () => {
  it("returns only the caller's tenants", async () => {
    expect((await as(alice, getUserTenants)).map((m) => m.tenant.id)).toEqual([tenantA]);
    expect((await as(bob, getUserTenants)).map((m) => m.tenant.id)).toEqual([tenantB]);
    expect(await as(carol, getUserTenants)).toEqual([]);
  });

  it("supports one user in several tenants with the right role in each", async () => {
    const list = await as(dave, getUserTenants);
    expect(Object.fromEntries(list.map((m) => [m.tenant.id, m.role]))).toEqual({ [tenantA]: "staff", [tenantD]: "owner" });
  });

  it("returns nothing when signed out", async () => {
    expect(await as(null, getUserTenants)).toEqual([]);
  });
});

describe("active tenant resolution", () => {
  it("defaults to the user's oldest membership", async () => {
    // dave created delta-shop first and was added to alpha-shop afterwards.
    expect((await as(dave, getActiveTenant))?.tenant.id).toBe(tenantD);
  });

  it("honours a cookie that names one of the user's tenants (switching)", async () => {
    expect((await as(dave, getActiveTenant, tenantA))?.tenant.id).toBe(tenantA);
    expect((await as(dave, getActiveTenant, tenantD))?.tenant.id).toBe(tenantD);
  });

  it("ignores a forged cookie naming someone else's tenant", async () => {
    expect((await as(alice, getActiveTenant, tenantB))?.tenant.id).toBe(tenantA);
  });

  it("is null for a user with no tenant even with a cookie", async () => {
    expect(await as(carol, getActiveTenant, tenantA)).toBeNull();
  });
});

describe("requireTenantAccess / requireTenantRole", () => {
  it("allows members and denies non-members", async () => {
    expect((await as(alice, () => requireTenantAccess(tenantA))).role).toBe("owner");
    expect(await as(alice, () => code(requireTenantAccess(tenantB)))).toBe("FORBIDDEN");
    expect(await as(carol, () => code(requireTenantAccess(tenantA)))).toBe("FORBIDDEN");
  });

  it("denies a forged / non-existent tenant id", async () => {
    expect(await as(alice, () => code(requireTenantAccess("00000000-0000-0000-0000-000000000000")))).toBe("FORBIDDEN");
  });

  it("reports an expired session as UNAUTHENTICATED", async () => {
    expect(await as(null, () => code(requireTenantAccess(tenantA)))).toBe("UNAUTHENTICATED");
  });

  it("enforces role permissions per tenant", async () => {
    expect(await as(dave, () => code(requireTenantRole(tenantA, "store:manage")))).toBe("FORBIDDEN"); // staff in A
    expect(await as(dave, () => code(requireTenantRole(tenantD, "store:manage")))).toBe("NO_ERROR"); // owner in D
    expect(await as(erin, () => code(requireTenantRole(tenantA, "store:manage")))).toBe("NO_ERROR");
    expect(await as(erin, () => code(requireTenantRole(tenantA, "store:delete")))).toBe("FORBIDDEN");
  });
});

describe("withTenantDb", () => {
  it("runs for a member and exposes the verified tenant, role and user", async () => {
    const ctx = await as(alice, () => withTenantDb({ tenantId: tenantA }, async (_tx, c) => c));
    expect(ctx).toEqual({ tenantId: tenantA, role: "owner", userId: alice });
  });

  it("defaults to the active tenant", async () => {
    const ctx = await as(dave, () => withTenantDb({}, async (_tx, c) => c), tenantD);
    expect(ctx).toMatchObject({ tenantId: tenantD, role: "owner" });
  });

  it("refuses a foreign tenant id without running the callback", async () => {
    const fn = vi.fn(async () => "ran");
    expect(await as(alice, () => code(withTenantDb({ tenantId: tenantB }, fn)))).toBe("FORBIDDEN");
    expect(fn).not.toHaveBeenCalled();
  });

  it("refuses insufficient role without running the callback", async () => {
    const fn = vi.fn(async () => "ran");
    expect(await as(dave, () => code(withTenantDb({ tenantId: tenantA, permission: "store:manage" }, fn)))).toBe("FORBIDDEN");
    expect(fn).not.toHaveBeenCalled();
  });

  it("applies the permission to the active tenant too", async () => {
    expect(await as(dave, () => code(withTenantDb({ permission: "store:manage" }, async () => 1)), tenantA)).toBe("FORBIDDEN");
  });

  it("fails clearly when the user has no workspace", async () => {
    expect(await as(carol, () => code(withTenantDb({}, async () => 1)))).toBe("NOT_FOUND");
  });

  it("allows a permitted write and scopes it to the tenant", async () => {
    const rows = await as(alice, () =>
      withTenantDb({ tenantId: tenantA, permission: "store:manage" }, (tx, c) =>
        tx.update(stores).set({ description: "updated" }).where(eq(stores.tenantId, c.tenantId)).returning({ id: stores.id }),
      ),
    );
    expect(rows).toHaveLength(1);
  });
});

describe("database RLS still protects even if application checks are bypassed", () => {
  it("listStores for a foreign tenant id returns nothing", async () => {
    expect(await as(alice, () => listStores(tenantB))).toEqual([]);
    expect(await as(alice, () => listStores(tenantA))).toHaveLength(1);
  });

  it("a buggy query that skips the membership check cannot touch another tenant", async () => {
    await as(alice, () =>
      withAuthenticatedDb(async (tx) => {
        expect(await tx.update(stores).set({ name: "pwned" }).where(eq(stores.id, storeB)).returning()).toHaveLength(0);
        expect(await tx.delete(tenants).where(eq(tenants.id, tenantB)).returning()).toHaveLength(0);
        expect(await tx.select().from(memberships).where(eq(memberships.tenantId, tenantB))).toHaveLength(0);
      }),
    );
  });

  it("withAuthenticatedDb refuses to run without a session", async () => {
    const fn = vi.fn(async () => "ran");
    expect(await as(null, () => code(withAuthenticatedDb(fn)))).toBe("UNAUTHENTICATED");
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("requireWorkspace", () => {
  it("redirects to the no-workspace page when the user has no active tenant", async () => {
    expect(await as(carol, () => code(requireWorkspace()))).toMatch(/NEXT_REDIRECT.*\/no-workspace/);
  });

  it("redirects to login when signed out", async () => {
    expect(await as(null, () => code(requireWorkspace()))).toMatch(/NEXT_REDIRECT.*\/login/);
  });

  it("returns the active tenant and its primary store", async () => {
    const ws = await as(alice, requireWorkspace);
    expect(ws.active.tenant.id).toBe(tenantA);
    expect(ws.store?.slug).toBe("alpha-shop");
  });
});

describe("switchTenantAction", () => {
  it("switches to a tenant the user belongs to (sets cookie, redirects)", async () => {
    expect(await as(dave, () => code(switchTenantAction(tenantD)))).toMatch(/NEXT_REDIRECT.*\/dashboard/);
    expect(h.cookieSets).toEqual([["sf_active_tenant", tenantD]]);
  });

  it("refuses a tenant the user does not belong to and sets no cookie", async () => {
    const res = await as(alice, () => switchTenantAction(tenantB));
    expect(res).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(h.cookieSets).toEqual([]);
  });

  it("rejects a malformed tenant id", async () => {
    expect(await as(alice, () => switchTenantAction("../../etc"))).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(h.cookieSets).toEqual([]);
  });

  it("reports an expired session instead of redirecting", async () => {
    expect(await as(null, () => switchTenantAction(tenantA))).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
  });
});

describe("store subdomain host (x-sf-store) selects the workspace", () => {
  const onHost = async <T>(slug: string, user: string | null, fn: () => Promise<T>, cookie?: string) => {
    h.storeSlug = slug;
    try {
      return await as(user, fn, cookie);
    } finally {
      h.storeSlug = null;
    }
  };

  it("a member gets the workspace that owns the host's store, whatever the cookie says", async () => {
    // dave: owner of delta-shop (D) and staff in alpha-shop (A)
    expect((await onHost("alpha-shop", dave, getActiveTenant, tenantD))?.tenant.id).toBe(tenantA);
    expect((await onHost("delta-shop", dave, getActiveTenant, tenantA))?.tenant.id).toBe(tenantD);
  });

  it("a user who is not a member of that store's company gets no workspace (and so cannot reach its dashboard)", async () => {
    expect(await onHost("beta-shop", alice, getActiveTenant)).toBeNull(); // alice owns A, not B
    expect(await onHost("beta-shop", alice, getActiveTenant, tenantA)).toBeNull();
    expect(await onHost("no-such-store", alice, getActiveTenant)).toBeNull();
    expect(await onHost("beta-shop", alice, () => code(requireWorkspace()))).toMatch(/NEXT_REDIRECT.*\/no-workspace/);
  });

  it("without a store host the normal membership/cookie rules still apply", async () => {
    expect((await as(dave, getActiveTenant, tenantA))?.tenant.id).toBe(tenantA);
  });
});
