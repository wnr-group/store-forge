import { beforeEach, describe, expect, it, vi } from "vitest";

// A store host's sign-in admits only members of THAT store. The pieces around the action are replaced; the action's own rules run.
const signIn = vi.fn();
const signOut = vi.fn(async () => {});
const getActiveTenant = vi.fn();
const getActiveStore = vi.fn();
let storeHost = true;
let mainHost = false;
const redirect = vi.fn((url: string) => {
  throw Object.assign(new Error("NEXT_REDIRECT"), { url });
});

vi.mock("next/navigation", () => ({ redirect: (u: string) => redirect(u) }));
vi.mock("@/services/auth.service", () => ({ signIn: (...a: unknown[]) => signIn(...a), signOut: () => signOut(), register: vi.fn(), changePassword: vi.fn() }));
vi.mock("@/lib/tenant/context", () => ({ getActiveTenant: () => getActiveTenant(), getActiveStore: () => getActiveStore() }));
vi.mock("@/lib/tenant/request", () => ({ isStoreHostRequest: async () => storeHost, isMainHostRequest: async () => mainHost }));

const creds = { email: "a@b.co", password: "pw" };
const redirected = async (p: Promise<unknown>) => p.then(() => null, (e: { url?: string }) => e.url ?? null);

beforeEach(() => {
  storeHost = true;
  mainHost = false;
  signIn.mockReset();
  signOut.mockClear();
  getActiveTenant.mockReset();
  getActiveStore.mockReset();
  vi.stubEnv("NEXT_PUBLIC_ROOT_DOMAIN", "lvh.me:3000");
  redirect.mockClear();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("loginAction on a store host", () => {
  it("lets a member of this store in", async () => {
    signIn.mockResolvedValue({ platformAdminLevel: null, membershipCount: 1 });
    getActiveTenant.mockResolvedValue({ tenant: { id: "t1" } });
    const { loginAction } = await import("@/app/(auth)/actions");
    expect(await redirected(loginAction(creds))).toBe("/dashboard");
    expect(signOut).not.toHaveBeenCalled();
  });

  it("refuses a platform admin, ends the session just made, and never sends them to /admin", async () => {
    signIn.mockResolvedValue({ platformAdminLevel: "super_admin", membershipCount: 0 });
    getActiveTenant.mockResolvedValue(null);
    const { loginAction } = await import("@/app/(auth)/actions");
    const result = await loginAction(creds);
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining("main site") });
    expect(signOut).toHaveBeenCalledOnce();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("tells another store's owner they do not belong to this workspace", async () => {
    signIn.mockResolvedValue({ platformAdminLevel: null, membershipCount: 1 });
    getActiveTenant.mockResolvedValue(null);
    const { loginAction } = await import("@/app/(auth)/actions");
    expect(await loginAction(creds)).toMatchObject({ ok: false, error: expect.stringContaining("do not belong to this workspace") });
    expect(signOut).toHaveBeenCalledOnce();
  });

  it("is not applied on the main site: a platform admin still goes to /admin", async () => {
    storeHost = false;
    signIn.mockResolvedValue({ platformAdminLevel: "super_admin", membershipCount: 0 });
    const { loginAction } = await import("@/app/(auth)/actions");
    expect(await redirected(loginAction(creds))).toBe("/admin");
    expect(getActiveTenant).not.toHaveBeenCalled();
  });
});

describe("loginAction on the main site", () => {
  beforeEach(() => {
    storeHost = false;
    mainHost = true;
  });

  it("lets a platform admin in", async () => {
    signIn.mockResolvedValue({ platformAdminLevel: "super_admin", membershipCount: 0 });
    const { loginAction } = await import("@/app/(auth)/actions");
    expect(await redirected(loginAction(creds))).toBe("/admin");
    expect(signOut).not.toHaveBeenCalled();
  });

  it("tells a store owner they have no workspace here, ends the session and names their own store address", async () => {
    signIn.mockResolvedValue({ platformAdminLevel: null, membershipCount: 1 });
    getActiveTenant.mockResolvedValue({ tenant: { id: "t1", publicId: "abc123" } });
    getActiveStore.mockResolvedValue({ slug: "urban" });
    const { loginAction } = await import("@/app/(auth)/actions");
    const result = await loginAction(creds);
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining("no workspace") });
    expect((result as { error: string }).error).toContain("urban-abc123.lvh.me:3000/login");
    expect(signOut).toHaveBeenCalledOnce();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("still lets a new customer with no store yet continue the onboarding", async () => {
    signIn.mockResolvedValue({ platformAdminLevel: null, membershipCount: 0 });
    const { loginAction } = await import("@/app/(auth)/actions");
    expect(await redirected(loginAction(creds))).toBe("/onboarding");
    expect(signOut).not.toHaveBeenCalled();
  });
});
