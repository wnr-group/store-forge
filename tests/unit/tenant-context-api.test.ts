import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

/**
 * lib/tenant/context.ts with the workspace coming from the API: membership-verified tenant access, role permissions,
 * the workspace redirects, `requireActiveTenant` gating and the tenant switch action.
 */

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const D = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const h = vi.hoisted(() => ({
  user: null as { id: string } | null,
  orgs: [] as { id: string; name: string; slug: string; role: string; permissions: Record<string, string>; joinedAt: string }[],
  cookie: undefined as string | undefined,
  storeSlug: null as string | null,
  cookieSets: [] as Array<[string, string]>,
  platformAdmin: false,
}));

const redirectError = (url: string) => Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;replace;${url};307;`, url });

vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: async () => h.user,
  requireUser: async () => {
    if (!h.user) throw redirectError("/login");
    return h.user;
  },
}));
vi.mock("@/lib/auth/platform", () => ({ isPlatformAdmin: async () => h.platformAdmin }));
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
vi.mock("@/lib/api/endpoints/organization-api", () => ({
  listMyOrganizationsApi: async () => h.orgs,
  getCurrentOrganizationApi: async (id: string) => {
    const o = h.orgs.find((x) => x.id === id);
    if (!o) throw new AppError("FORBIDDEN", "You do not have access to this workspace.");
    return {
      organization: { id: o.id, name: o.name, slug: o.slug }, role: o.role, roleLabel: o.role, permissions: o.permissions, access: [],
      store: { id: `s-${o.slug}`, name: o.name, slug: `${o.slug}-shop`, description: null, logoPath: null, contactEmail: null, contactPhone: null, currency: "INR", timezone: "UTC", status: "active", currencyLocked: false, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
    };
  },
}));

const org = (id: string, slug: string, role: string, permissions: Record<string, string> = {}) => ({ id, name: slug, slug, role, permissions, joinedAt: "2026-01-01T00:00:00.000Z" });
const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return "no error";
  } catch (e) {
    return (e as { digest?: string }).digest ?? (e as AppError).code ?? String(e);
  }
};

beforeEach(() => {
  h.user = { id: "u1" };
  h.orgs = [org(A, "alpha", "owner")];
  h.cookie = undefined;
  h.storeSlug = null;
  h.cookieSets = [];
  h.platformAdmin = false;
});

describe("memberships and the active tenant", () => {
  it("returns the caller's tenants, nothing when signed out", async () => {
    const { getUserTenants } = await import("@/lib/tenant/context");
    h.orgs = [org(D, "delta", "owner"), org(A, "alpha", "staff")];
    expect((await getUserTenants()).map((m) => [m.tenant.id, m.role])).toEqual([[D, "owner"], [A, "staff"]]);
    h.user = null;
    expect(await getUserTenants()).toEqual([]);
  });

  it("defaults to the first membership, honours a real cookie and ignores a forged one", async () => {
    const { getActiveTenant } = await import("@/lib/tenant/context");
    h.orgs = [org(D, "delta", "owner"), org(A, "alpha", "staff")];
    expect((await getActiveTenant())?.tenant.id).toBe(D);
    h.cookie = A;
    expect((await getActiveTenant())?.tenant.id).toBe(A);
    h.cookie = B;
    expect((await getActiveTenant())?.tenant.id).toBe(D);
    h.orgs = [];
    expect(await getActiveTenant()).toBeNull();
  });

  it("a store host selects its own workspace whatever the cookie says, and a non-member gets none", async () => {
    const { getActiveTenant } = await import("@/lib/tenant/context");
    h.orgs = [org(D, "delta", "owner"), org(A, "alpha", "staff")];
    h.cookie = D;
    h.storeSlug = "alpha-shop";
    expect((await getActiveTenant())?.tenant.id).toBe(A);
    h.storeSlug = "stranger-shop";
    expect(await getActiveTenant()).toBeNull();
  });
});

describe("requireTenantAccess / requireTenantRole", () => {
  it("allows members, denies non-members and forged ids, reports an expired session", async () => {
    const { requireTenantAccess } = await import("@/lib/tenant/context");
    await expect(requireTenantAccess(A)).resolves.toMatchObject({ role: "owner" });
    await expect(requireTenantAccess(B)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(requireTenantAccess("not-a-real-id")).rejects.toMatchObject({ code: "FORBIDDEN" });
    h.user = null;
    await expect(requireTenantAccess(A)).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("enforces the role's permissions per tenant", async () => {
    const { requireTenantRole } = await import("@/lib/tenant/context");
    h.orgs = [org(A, "alpha", "owner"), org(D, "delta", "staff", { products: "read", orders: "read", customers: "none", settings: "read" })];
    await expect(requireTenantRole(A, "members:manage")).resolves.toBeTruthy();
    await expect(requireTenantRole(D, "catalog:view")).resolves.toBeTruthy();
    await expect(requireTenantRole(D, "catalog:manage")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(requireTenantRole(D, "members:manage")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("requireActiveTenant", () => {
  it("resolves the active tenant and role for a member, and checks the permission", async () => {
    const { requireActiveTenant } = await import("@/lib/tenant/context");
    const m = await requireActiveTenant();
    expect(m.tenant.id).toBe(A);
    expect(m.role).toBe("owner");
    await expect(requireActiveTenant("catalog:manage")).resolves.toBeTruthy();
  });

  it("refuses an insufficient role, and a user with no workspace", async () => {
    const { requireActiveTenant } = await import("@/lib/tenant/context");
    h.orgs = [org(A, "alpha", "staff", { products: "read", orders: "read", customers: "none", settings: "read" })];
    await expect(requireActiveTenant("catalog:manage")).rejects.toMatchObject({ code: "FORBIDDEN" });
    h.orgs = [];
    await expect(requireActiveTenant()).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
