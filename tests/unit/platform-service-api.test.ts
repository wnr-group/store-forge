import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

/** Platform Admin area in API mode: no database path, the API decides who is an admin, same shapes as before. */

const noDb = () => {
  throw new Error("the database path must not be used in API mode");
};
vi.mock("next/cache", () => ({ unstable_cache: <T>(fn: T) => fn, revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/db", () => ({ getDatabase: noDb }));
vi.mock("@/lib/db/tenant-db", () => ({ withAuthenticatedDb: noDb }));
vi.mock("@/lib/db/user-context", () => ({ rowsOf: noDb, withPublicContext: noDb }));
vi.mock("@/lib/tenant/context", () => ({ requireActiveTenant: noDb, withTenantDb: noDb }));
const getCurrentUser = vi.fn(async () => ({ id: "u1", user_metadata: {} }) as { id: string; user_metadata: object } | null);
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: () => getCurrentUser() }));

const p = {
  me: vi.fn(), getSettings: vi.fn(), updateSettings: vi.fn(), branding: vi.fn(),
  admins: vi.fn(), addAdmin: vi.fn(), setRole: vi.fn(), removeAdmin: vi.fn(),
  audit: vi.fn(), auditAdmins: vi.fn(),
  usage: vi.fn(), usageList: vi.fn(), summary: vi.fn(), inactive: vi.fn(), series: vi.fn(),
};
vi.mock("@/lib/api/endpoints/platform-api", () => ({
  getPlatformMeApi: () => p.me(),
  getPlatformSettingsApi: () => p.getSettings(),
  updatePlatformSettingsApi: (...a: unknown[]) => p.updateSettings(...a),
  getPublicBrandingApi: () => p.branding(),
  listPlatformAdminsApi: () => p.admins(),
  addPlatformAdminApi: (...a: unknown[]) => p.addAdmin(...a),
  setPlatformAdminRoleApi: (...a: unknown[]) => p.setRole(...a),
  removePlatformAdminApi: (...a: unknown[]) => p.removeAdmin(...a),
  listAuditLogsApi: (...a: unknown[]) => p.audit(...a),
  listAuditAdminsApi: () => p.auditAdmins(),
  getOrganizationUsageApi: (...a: unknown[]) => p.usage(...a),
  listOrganizationUsageApi: (...a: unknown[]) => p.usageList(...a),
  getUsageSummaryApi: (...a: unknown[]) => p.summary(...a),
  listInactiveOrganizationsApi: (...a: unknown[]) => p.inactive(...a),
  getNewOrganizationsSeriesApi: (...a: unknown[]) => p.series(...a),
}));
const o = {
  overview: vi.fn(), list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), del: vi.fn(), status: vi.fn(), store: vi.fn(),
  addMember: vi.fn(), memberStatus: vi.fn(), removeMember: vi.fn(), transfer: vi.fn(), recover: vi.fn(),
};
vi.mock("@/lib/api/endpoints/platform-org-api", () => ({
  getPlatformOverviewApi: () => o.overview(),
  listOrganizationsApi: (...a: unknown[]) => o.list(...a),
  getOrganizationApi: (...a: unknown[]) => o.get(...a),
  createOrganizationApi: (...a: unknown[]) => o.create(...a),
  updateOrganizationApi: (...a: unknown[]) => o.update(...a),
  deleteOrganizationApi: (...a: unknown[]) => o.del(...a),
  setOrganizationStatusApi: (...a: unknown[]) => o.status(...a),
  updateOrganizationStoreApi: (...a: unknown[]) => o.store(...a),
  addOrganizationMemberApi: (...a: unknown[]) => o.addMember(...a),
  setOrganizationMemberStatusApi: (...a: unknown[]) => o.memberStatus(...a),
  removeOrganizationMemberApi: (...a: unknown[]) => o.removeMember(...a),
  transferOwnershipApi: (...a: unknown[]) => o.transfer(...a),
  recoverOwnerApi: (...a: unknown[]) => o.recover(...a),
}));

const ORG = "44444444-4444-4444-8444-444444444444";
const company = {
  id: ORG, name: "Acme", slug: "acme", status: "active", contactPhone: null, address: null, createdAt: "2026-01-02T00:00:00.000Z",
  storeId: "s1", storeName: "Acme Store", storeSlug: "acme-store", ownerId: "ow", ownerName: "Olly", ownerEmail: "o@x.co", memberCount: 2,
};

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUser.mockResolvedValue({ id: "u1", user_metadata: {} });
  p.me.mockResolvedValue({ level: "super_admin" });
  process.env.AUTH_API_URL = "http://localhost:4000/api/v1";
  process.env.AUTH_BFF_SECRET = "s".repeat(40);
});

describe("platform guard", () => {
  it("asks the API for the level; 403 means not an admin; other failures are not swallowed", async () => {
    const { getPlatformAdminLevel, isPlatformAdmin, requirePlatformAdmin, requireSuperAdmin } = await import("@/lib/auth/platform");
    await expect(getPlatformAdminLevel()).resolves.toBe("super_admin");
    await expect(isPlatformAdmin()).resolves.toBe(true);
    p.me.mockRejectedValue(new AppError("FORBIDDEN", "no"));
    await expect(isPlatformAdmin()).resolves.toBe(false);
    await expect(requirePlatformAdmin()).rejects.toMatchObject({ code: "FORBIDDEN" });
    p.me.mockRejectedValue(new AppError("UNKNOWN", "boom"));
    await expect(isPlatformAdmin()).rejects.toMatchObject({ code: "UNKNOWN" });
    p.me.mockResolvedValue({ level: "admin" });
    await expect(requireSuperAdmin()).rejects.toMatchObject({ code: "FORBIDDEN", message: "Only a super admin can do that." });
  });

  it("does not call the API for a signed-out visitor", async () => {
    getCurrentUser.mockResolvedValue(null);
    const { isPlatformAdmin } = await import("@/lib/auth/platform");
    await expect(isPlatformAdmin()).resolves.toBe(false);
    expect(p.me).not.toHaveBeenCalled();
  });
});

describe("settings, branding and admins", () => {
  it("reads settings with a Date, and public branding without a session", async () => {
    p.getSettings.mockResolvedValue({ platformName: "StoreForge", supportEmail: null, defaultCurrency: "INR", defaultTimezone: "Asia/Kolkata", defaultStoreStatus: "active", updatedAt: "2026-01-01T00:00:00.000Z", updatedByEmail: null });
    p.branding.mockResolvedValue({ platformName: "StoreForge", supportEmail: "s@x.co" });
    const { getPlatformSettings, getPublicBranding } = await import("@/services/platform-settings.service");
    expect((await getPlatformSettings()).updatedAt).toBeInstanceOf(Date);
    await expect(getPublicBranding()).resolves.toEqual({ platformName: "StoreForge", supportEmail: "s@x.co" });
  });

  it("falls back to default branding when the API is unreachable", async () => {
    p.branding.mockRejectedValue(new AppError("UNKNOWN", "down"));
    const { getPublicBranding } = await import("@/services/platform-settings.service");
    await expect(getPublicBranding()).resolves.toEqual({ platformName: "StoreForge", supportEmail: null });
  });

  it("only a super admin may update settings or manage admins", async () => {
    p.me.mockResolvedValue({ level: "admin" });
    const settings = await import("@/services/platform-settings.service");
    const team = await import("@/services/platform-team.service");
    const v = { platformName: "X", supportEmail: null, defaultCurrency: "INR", defaultTimezone: "Asia/Kolkata", defaultStoreStatus: "active" } as never;
    await expect(settings.updatePlatformSettings(v)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(team.removePlatformAdmin("x")).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(p.updateSettings).not.toHaveBeenCalled();
    expect(p.removeAdmin).not.toHaveBeenCalled();
  });

  it("super admin: updates settings and manages admins through the API", async () => {
    p.admins.mockResolvedValue([{ userId: "a1", email: "a@x.co", fullName: null, role: "admin", createdAt: "2026-01-01T00:00:00.000Z", createdBy: null, createdByEmail: null }]);
    p.addAdmin.mockResolvedValue({ email: "n@x.co" });
    const settings = await import("@/services/platform-settings.service");
    const team = await import("@/services/platform-team.service");
    const v = { platformName: "X", supportEmail: null, defaultCurrency: "INR", defaultTimezone: "Asia/Kolkata", defaultStoreStatus: "active" } as never;
    await settings.updatePlatformSettings(v);
    expect(p.updateSettings).toHaveBeenCalledWith(v);
    expect((await team.listPlatformAdmins())[0].createdAt).toBeInstanceOf(Date);
    await expect(team.addPlatformAdmin({ fullName: "N N", email: "n@x.co", password: "Passw0rd!x", role: "admin" } as never)).resolves.toEqual({ email: "n@x.co" });
    await team.setPlatformAdminRole("a1", "super_admin");
    await team.removePlatformAdmin("a1");
    expect(p.setRole).toHaveBeenCalledWith("a1", "super_admin");
    expect(p.removeAdmin).toHaveBeenCalledWith("a1");
  });
});

describe("audit and usage", () => {
  it("maps the audit filters and returns the page the API settled on", async () => {
    p.audit.mockResolvedValue({ items: [{ id: "l1", adminUserId: "a", adminEmail: "a@x.co", action: "organization.created", entityType: "organization", entityId: null, organizationId: null, organizationName: null, description: "d", previousData: null, newData: null, createdAt: "2026-02-01T00:00:00.000Z" }], meta: { page: 2, limit: 25, total: 26, totalPages: 2 } });
    const { listAuditLogs } = await import("@/services/admin-audit.service");
    const page = await listAuditLogs({ action: "all", admin: "all", org: "", q: "acme", from: "2026-02-01", to: "", page: 5, pageSize: 25 } as never);
    expect(p.audit).toHaveBeenCalledWith({ page: 5, limit: 25, action: "all", admin: "all", org: "", search: "acme", from: "2026-02-01", to: "" });
    expect(page).toMatchObject({ page: 2, total: 26, pageSize: 25 });
    expect(page.rows[0].createdAt).toBeInstanceOf(Date);
  });

  it("sorts audit admins by e-mail", async () => {
    p.auditAdmins.mockResolvedValue([{ id: "2", email: "z@x.co" }, { id: "1", email: "a@x.co" }]);
    const { listAuditAdmins } = await import("@/services/admin-audit.service");
    expect((await listAuditAdmins()).map((a) => a.email)).toEqual(["a@x.co", "z@x.co"]);
  });

  it("usage: table, summary, inactive list and series keep their shapes", async () => {
    const u = { products: 1, customers: 2, orders: 3, storageBytes: null, lastActivity: null, createdAt: "2026-01-01T00:00:00.000Z", status: "active" };
    p.usage.mockResolvedValue(u);
    p.usageList.mockResolvedValue({ items: [{ ...u, id: ORG, name: "Acme", slug: "acme" }], meta: { page: 1, limit: 10, total: 1, totalPages: 1 } });
    p.summary.mockResolvedValue({ totalOrganizations: 1, active: 1, suspended: 0, inactive: 0, storageTotalBytes: null });
    p.inactive.mockResolvedValue({ total: 1, rows: [{ id: ORG, name: "Acme", slug: "acme", status: "active", createdAt: "2026-01-01T00:00:00.000Z", lastActivity: "2026-02-01T00:00:00.000Z" }] });
    p.series.mockResolvedValue({ from: "2026-01-01", to: "2026-01-31", bucket: "day", points: [], total: 0 });
    const svc = await import("@/services/platform-usage.service");
    const one = await svc.getOrganizationUsage(ORG);
    expect(one.storageBytes).toBeNull();
    expect(one.createdAt).toBeInstanceOf(Date);
    const page = await svc.listOrganizationUsage({ q: "ac", status: "all", sort: "name", dir: "asc", page: 1, pageSize: 10 } as never);
    expect(p.usageList).toHaveBeenCalledWith({ page: 1, limit: 10, search: "ac", status: "all", sortBy: "name", sortOrder: "asc" });
    expect(page.rows[0]).toMatchObject({ id: ORG, name: "Acme", orders: 3 });
    await expect(svc.getUsageSummary(30)).resolves.toMatchObject({ totalOrganizations: 1 });
    const inactive = await svc.listInactiveOrganizations(30, 10);
    expect(inactive.rows[0].lastActivity).toBeInstanceOf(Date);
    await expect(svc.getNewOrganizationsSeries("2026-01-01", "2026-01-31")).resolves.toMatchObject({ bucket: "day" });
  });
});

describe("organizations", () => {
  it("lists, shows the overview and loads detail (null when missing)", async () => {
    o.list.mockResolvedValue({ items: [company], meta: { page: 1, limit: 10, total: 1, totalPages: 1 } });
    o.overview.mockResolvedValue({ totalOrganizations: 1, active: 1, suspended: 0, totalUsers: 3, recent: [company] });
    o.get.mockResolvedValueOnce({ company, store: null, team: [{ userId: "t1", fullName: "T", email: "t@x.co", role: "admin", roleLabel: "Manager", status: "active", joinedAt: "2026-01-05T00:00:00.000Z", permissions: {} }] });
    const svc = await import("@/services/platform.service");
    const list = await svc.listCompaniesPage({ q: "a", status: "active", sort: "created", dir: "desc", page: 1, pageSize: 10 } as never);
    expect(o.list).toHaveBeenCalledWith({ page: 1, limit: 10, search: "a", status: "active", sortBy: "created", sortOrder: "desc" });
    expect(list.items[0].createdAt).toBeInstanceOf(Date);
    expect((await svc.getPlatformOverview()).recent[0].memberCount).toBe(2);
    const detail = await svc.getCompany(ORG);
    expect(detail?.team[0].joinedAt).toBeInstanceOf(Date);
    o.get.mockRejectedValueOnce(new AppError("NOT_FOUND", "Organization not found."));
    await expect(svc.getCompany(ORG)).resolves.toBeNull();
  });

  it("every mutation goes to the API after the admin check, and non-admins never reach it", async () => {
    o.create.mockResolvedValue({ tenantId: ORG, storeId: "s1", ownerId: "ow", ownerEmail: "o@x.co" });
    o.recover.mockResolvedValue({ email: "n@x.co" });
    const svc = await import("@/services/platform.service");
    const v = { companyName: "Acme", storeName: "S", storeSlug: "acme-store", storeDescription: null, contactPhone: null, address: null, ownerName: "Olly", ownerEmail: "o@x.co", ownerPassword: "Passw0rd!x" } as never;
    await expect(svc.createCompany(v)).resolves.toMatchObject({ tenantId: ORG });
    await svc.setCompanyStatus(ORG, "suspended");
    await svc.updateCompany(ORG, { companyName: "A2", contactPhone: null, address: null } as never);
    await svc.updateCompanyStore(ORG, { name: "S2", description: null, contactEmail: null, contactPhone: null, currency: "INR", timezone: "Asia/Kolkata" } as never);
    await svc.addCompanyMember(ORG, { fullName: "M M", email: "m@x.co", password: "Passw0rd!x", permissions: {} } as never);
    await svc.setCompanyMemberStatus(ORG, "t1", "disabled");
    await svc.removeCompanyMember(ORG, "t1");
    await svc.transferCompanyOwnership(ORG, { userId: "t1", previousOwner: "keep" });
    await expect(svc.recoverCompanyOwner(ORG, { ownerName: "N N", ownerEmail: "n@x.co", ownerPassword: "Passw0rd!x", previousOwner: "disable" })).resolves.toEqual({ email: "n@x.co" });
    await svc.deleteCompany(ORG);
    expect(o.status).toHaveBeenCalledWith(ORG, "suspended");
    expect(o.transfer).toHaveBeenCalledWith(ORG, { userId: "t1", previousOwner: "keep" });
    expect(o.del).toHaveBeenCalledWith(ORG);

    vi.clearAllMocks();
    p.me.mockRejectedValue(new AppError("FORBIDDEN", "no"));
    for (const call of [() => svc.createCompany(v), () => svc.deleteCompany(ORG), () => svc.setCompanyStatus(ORG, "active"), () => svc.getPlatformOverview()]) {
      await expect(call()).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    for (const fn of Object.values(o)) expect(fn).not.toHaveBeenCalled();
  });

  it("surfaces API conflicts with their field errors", async () => {
    o.create.mockRejectedValue(new AppError("CONFLICT", "That store address is not available.", { storeSlug: "That address is not available" }));
    const { createCompany } = await import("@/services/platform.service");
    await expect(createCompany({ storeSlug: "taken" } as never)).rejects.toMatchObject({ code: "CONFLICT", fieldErrors: { storeSlug: expect.any(String) } });
  });
});
