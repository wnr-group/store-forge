import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

/** Workspace resolution from the API: the cookie and the host only select among the API's memberships. */

const list = vi.fn();
const current = vi.fn();
vi.mock("@/lib/api/endpoints/organization-api", () => ({
  listMyOrganizationsApi: () => list(),
  getCurrentOrganizationApi: (id: string) => current(id),
}));

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const org = (id: string, slug: string, role = "owner") => ({ id, name: slug.toUpperCase(), slug, role, permissions: {}, joinedAt: "2026-01-01T00:00:00.000Z" });
const store = (slug: string) => ({
  id: `st-${slug}`, name: slug, slug, description: null, logoPath: "t/store/logo.png", contactEmail: null, contactPhone: null, currency: "INR",
  timezone: "Asia/Kolkata", status: "active", currencyLocked: false, createdAt: "2026-01-02T00:00:00.000Z", updatedAt: "2026-01-03T00:00:00.000Z",
});
const cur = (id: string, storeSlug: string | null) => ({ organization: { id, name: id, slug: id }, role: "owner", roleLabel: "Owner", permissions: {}, access: [], store: storeSlug ? store(storeSlug) : null });

beforeEach(() => {
  vi.clearAllMocks();
  list.mockResolvedValue([org(A, "acme"), org(B, "beta", "admin")]);
  current.mockImplementation(async (id: string) => cur(id, id === A ? "acme-shop" : "beta-shop"));
});

describe("loadWorkspaceViaApi", () => {
  it("uses the preferred organization only if it is a real membership, else the first", async () => {
    const { loadWorkspaceViaApi } = await import("@/lib/tenant/api-workspace");
    const preferred = await loadWorkspaceViaApi(null, B);
    expect(preferred.active?.tenant.id).toBe(B);
    expect(preferred.active?.role).toBe("admin");
    expect(preferred.store?.slug).toBe("beta-shop");
    const forged = await loadWorkspaceViaApi(null, "cccccccc-cccc-4ccc-8ccc-cccccccccccc");
    expect(forged.active?.tenant.id).toBe(A);
    expect(current).toHaveBeenLastCalledWith(A);
    expect(forged.memberships).toHaveLength(2);
  });

  it("maps the API store to the Store row the pages use", async () => {
    const { loadWorkspaceViaApi } = await import("@/lib/tenant/api-workspace");
    const { store: s } = await loadWorkspaceViaApi(null, undefined);
    expect(s).toMatchObject({ tenantId: A, logoUrl: "t/store/logo.png", currency: "INR", timezone: "Asia/Kolkata" });
    expect(s?.createdAt).toBeInstanceOf(Date);
  });

  it("returns an empty workspace for a user without memberships and ignores unknown roles", async () => {
    const { loadWorkspaceViaApi } = await import("@/lib/tenant/api-workspace");
    list.mockResolvedValueOnce([]);
    await expect(loadWorkspaceViaApi(null, undefined)).resolves.toEqual({ memberships: [], active: null, store: null });
    list.mockResolvedValueOnce([org(A, "acme", "wizard")]);
    expect((await loadWorkspaceViaApi(null, undefined)).memberships).toEqual([]);
    expect(current).not.toHaveBeenCalled();
  });

  it("on a store host selects the organization whose store has that address and ignores the cookie", async () => {
    const { loadWorkspaceViaApi } = await import("@/lib/tenant/api-workspace");
    const w = await loadWorkspaceViaApi("beta-shop", A);
    expect(w.active?.tenant.id).toBe(B);
    expect(w.store?.slug).toBe("beta-shop");
  });

  it("on a store host nobody belongs to there is no workspace, and a suspended organization does not match", async () => {
    const { loadWorkspaceViaApi } = await import("@/lib/tenant/api-workspace");
    await expect(loadWorkspaceViaApi("other-shop", undefined)).resolves.toMatchObject({ active: null, store: null });
    current.mockImplementation(async (id: string) => {
      if (id === B) throw new AppError("FORBIDDEN", "suspended");
      return cur(id, "acme-shop");
    });
    await expect(loadWorkspaceViaApi("beta-shop", undefined)).resolves.toMatchObject({ active: null });
  });

  it("does not hide real failures", async () => {
    const { loadWorkspaceViaApi } = await import("@/lib/tenant/api-workspace");
    current.mockRejectedValue(new AppError("UNKNOWN", "boom"));
    await expect(loadWorkspaceViaApi("acme-shop", undefined)).rejects.toMatchObject({ code: "UNKNOWN" });
    await expect(loadWorkspaceViaApi(null, undefined)).rejects.toMatchObject({ code: "UNKNOWN" });
  });
});
