import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

/** Store settings, profile and team in API mode: no database path, permission checked first, same shapes. */

const tenant = { id: "11111111-1111-4111-8111-111111111111" };
const requireActiveTenant = vi.fn<(permission?: string) => Promise<{ tenant: typeof tenant; role: string }>>(async () => ({ tenant, role: "owner" }));
const noDb = () => {
  throw new Error("the database path must not be used in API mode");
};
vi.mock("@/lib/tenant/context", () => ({ requireActiveTenant: (p?: string) => requireActiveTenant(p), withTenantDb: noDb }));
vi.mock("@/lib/db/tenant-db", () => ({ withAuthenticatedDb: noDb }));

const jar = { toString: () => "sb-x-auth-token=1", getAll: () => [], set: vi.fn(), delete: vi.fn() };
vi.mock("next/headers", () => ({ cookies: async () => jar }));
const authApi = vi.fn<(path: string, call?: unknown) => Promise<{ ok: boolean; status: number; body: null; setCookies: string[] }>>(async () => ({ ok: true, status: 200, body: null, setCookies: ["sb-x-auth-token=2; Path=/"] }));
vi.mock("@/lib/auth/nest-api", () => ({
  authApi: (p: string, c: unknown) => authApi(p, c),
  authApiEnabled: () => true,
  applySetCookies: (sink: { set: (n: string, v: string) => void }, lines: string[]) => lines.forEach((l) => sink.set(l.split("=")[0], "2")),
  getAuthApiConfig: () => ({ url: "http://localhost:4000/api/v1", secret: "s".repeat(40) }),
}));

const store = { get: vi.fn(), update: vi.fn() };
vi.mock("@/lib/api/endpoints/store-api", () => ({ getStoreApi: (...a: unknown[]) => store.get(...a), updateStoreApi: (...a: unknown[]) => store.update(...a) }));
const profile = { get: vi.fn(), update: vi.fn() };
vi.mock("@/lib/api/endpoints/profile-api", () => ({ getProfileApi: () => profile.get(), updateProfileApi: (n: string) => profile.update(n) }));
const team = { list: vi.fn(), create: vi.fn(), update: vi.fn(), status: vi.fn(), remove: vi.fn(), reset: vi.fn() };
vi.mock("@/lib/api/endpoints/team-api", () => ({
  listTeamApi: (...a: unknown[]) => team.list(...a),
  createMemberApi: (...a: unknown[]) => team.create(...a),
  updateMemberApi: (...a: unknown[]) => team.update(...a),
  setMemberStatusApi: (...a: unknown[]) => team.status(...a),
  removeMemberApi: (...a: unknown[]) => team.remove(...a),
  resetMemberPasswordApi: (...a: unknown[]) => team.reset(...a),
}));

const UID = "33333333-3333-4333-8333-333333333333";
const perms = { products: "write", orders: "read", customers: "none", settings: "read" };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.AUTH_API_URL = "http://localhost:4000/api/v1";
  process.env.AUTH_BFF_SECRET = "s".repeat(40);
});

describe("store settings in API mode", () => {
  const values = { name: "Shop", slug: "shop", description: null, contactEmail: null, contactPhone: null, currency: "INR", timezone: "Asia/Kolkata", logoPath: null };

  it("sends the whole form after the store:manage check", async () => {
    const { updateStoreSettings } = await import("@/services/store-settings.service");
    await updateStoreSettings(values);
    expect(requireActiveTenant).toHaveBeenCalledWith("store:manage");
    expect(store.update).toHaveBeenCalledWith(tenant.id, values);
  });

  it("does not call the API without permission and surfaces API field errors", async () => {
    const { updateStoreSettings } = await import("@/services/store-settings.service");
    requireActiveTenant.mockRejectedValueOnce(new AppError("FORBIDDEN", "You do not have permission to do that."));
    await expect(updateStoreSettings(values)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(store.update).not.toHaveBeenCalled();
    store.update.mockRejectedValueOnce(new AppError("CONFLICT", "That store address is not available.", { slug: "This store address is not available." }));
    await expect(updateStoreSettings(values)).rejects.toMatchObject({ code: "CONFLICT", fieldErrors: { slug: expect.any(String) } });
  });

  it("reads the currency lock from the API", async () => {
    store.get.mockResolvedValue({ currencyLocked: true });
    const { isCurrencyLocked } = await import("@/services/store-settings.service");
    await expect(isCurrencyLocked()).resolves.toBe(true);
    expect(store.get).toHaveBeenCalledWith(tenant.id);
  });
});

describe("profile in API mode", () => {
  it("reads the name and updates it, then rotates the session so the menu shows the new name", async () => {
    profile.get.mockResolvedValue({ id: UID, email: "a@b.co", fullName: "Ada" });
    const { getOwnProfile, updateOwnName } = await import("@/services/profile.service");
    await expect(getOwnProfile()).resolves.toEqual({ fullName: "Ada" });
    await updateOwnName("Ada L");
    expect(profile.update).toHaveBeenCalledWith("Ada L");
    expect(authApi).toHaveBeenCalledWith("/auth/refresh", expect.objectContaining({ method: "POST" }));
    expect(jar.set).toHaveBeenCalled();
  });

  it("does not rotate the session when the API refuses the update", async () => {
    profile.update.mockRejectedValueOnce(new AppError("NOT_FOUND", "Your profile could not be found."));
    const { updateOwnName } = await import("@/services/profile.service");
    await expect(updateOwnName("X")).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(authApi).not.toHaveBeenCalled();
  });
});

describe("team in API mode", () => {
  it("lists members with Dates, requiring members:manage", async () => {
    team.list.mockResolvedValue([{ userId: UID, fullName: "Sam", email: "s@x.co", role: "admin", roleLabel: "Manager", status: "disabled", joinedAt: "2026-02-01T00:00:00.000Z", permissions: perms }]);
    const { listTeam } = await import("@/services/team.service");
    const rows = await listTeam();
    expect(requireActiveTenant).toHaveBeenCalledWith("members:manage");
    expect(rows[0]).toMatchObject({ userId: UID, role: "admin", status: "disabled", permissions: perms });
    expect(rows[0].joinedAt).toBeInstanceOf(Date);
  });

  it("refuses every write for a non-owner before calling the API", async () => {
    const svc = await import("@/services/team.service");
    const denied = () => requireActiveTenant.mockRejectedValueOnce(new AppError("FORBIDDEN", "You do not have permission to do that."));
    const input = { fullName: "Sam Lee", email: "s@x.co", password: "Passw0rd!x", permissions: perms } as never;
    for (const call of [
      () => svc.createMember(input),
      () => svc.updateMember({ userId: UID, fullName: "Sam Lee", permissions: perms } as never),
      () => svc.setMemberStatus(UID, "disabled"),
      () => svc.removeMember(UID),
      () => svc.resetMemberPassword(UID, "Passw0rd!x"),
    ]) {
      denied();
      await expect(call()).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    for (const fn of Object.values(team)) expect(fn).not.toHaveBeenCalled();
  });

  it("creates, edits, disables, removes and resets through the API", async () => {
    team.create.mockResolvedValue({ userId: UID, email: "s@x.co" });
    const svc = await import("@/services/team.service");
    await expect(svc.createMember({ fullName: "Sam Lee", email: "s@x.co", password: "Passw0rd!x", permissions: perms } as never)).resolves.toEqual({ userId: UID, email: "s@x.co" });
    await svc.updateMember({ userId: UID, fullName: "Sam Lee", permissions: perms } as never);
    await svc.setMemberStatus(UID, "disabled");
    await svc.removeMember(UID);
    await svc.resetMemberPassword(UID, "Passw0rd!x");
    expect(team.update).toHaveBeenCalledWith(tenant.id, UID, { fullName: "Sam Lee", permissions: perms });
    expect(team.status).toHaveBeenCalledWith(tenant.id, UID, "disabled");
    expect(team.remove).toHaveBeenCalledWith(tenant.id, UID);
    expect(team.reset).toHaveBeenCalledWith(tenant.id, UID, "Passw0rd!x");
  });

  it("keeps the frontend's input validation ahead of the API call", async () => {
    const { createMember } = await import("@/services/team.service");
    await expect(createMember({ fullName: "S", email: "nope", password: "x", permissions: perms } as never)).rejects.toMatchObject({ code: "VALIDATION" });
    expect(team.create).not.toHaveBeenCalled();
  });
});
