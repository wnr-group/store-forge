import { existsSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = {
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  updateUser: vi.fn(),
  getUser: vi.fn(),
};
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth }) }));
vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: async () => (await auth.getUser()).data.user,
}));

const redirect = vi.fn((url: string) => {
  throw Object.assign(new Error("NEXT_REDIRECT"), { url });
});
vi.mock("next/navigation", () => ({ redirect: (u: string) => redirect(u) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: vi.fn(), set: vi.fn(), getAll: () => [] }) }));

import * as authActions from "@/app/(auth)/actions";
import { changePasswordAction, loginAction, logoutAction } from "@/app/(auth)/actions";

const redirected = async (p: Promise<unknown>) => p.then(() => null, (e: { url?: string }) => e.url ?? null);

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "a".repeat(30));
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
  for (const fn of [...Object.values(auth), redirect]) fn.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("public registration is disabled", () => {
  it("exports no sign-up, verification or e-mail recovery action", () => {
    expect(Object.keys(authActions).sort()).toEqual(["changePasswordAction", "loginAction", "logoutAction"]);
  });

  it.each(["register", "verify-email", "forgot-password", "reset-password"])("has no /%s page", (route) => {
    expect(existsSync(join(process.cwd(), "app", "(auth)", route))).toBe(false);
  });

  it("has no email-link callback route and no onboarding page", () => {
    expect(existsSync(join(process.cwd(), "app", "auth", "callback"))).toBe(false);
    expect(existsSync(join(process.cwd(), "app", "(dashboard)", "onboarding"))).toBe(false);
  });

  it("the auth service never calls signUp", async () => {
    const service = await import("@/services/auth.service");
    expect(Object.keys(service).sort()).toEqual(["changePassword", "signIn", "signOut"]);
  });
});

describe("login / logout (provisioned accounts, no email verification step)", () => {
  it("signs in with email and password and redirects to the dashboard", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: null });
    expect(await redirected(loginAction({ email: "A@B.co", password: "x" }))).toBe("/dashboard");
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: "a@b.co", password: "x" });
  });

  it("honours a safe next path but not an external one", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: null });
    expect(await redirected(loginAction({ email: "a@b.co", password: "x" }, "/dashboard/products"))).toBe("/dashboard/products");
    expect(await redirected(loginAction({ email: "a@b.co", password: "x" }, "https://evil.com"))).toBe("/dashboard");
  });

  it("returns a friendly error for bad credentials", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { code: "invalid_credentials", status: 400, message: "Invalid login credentials" } });
    expect(await loginAction({ email: "a@b.co", password: "wrong" })).toEqual({
      ok: false,
      error: "Incorrect email or password.",
      code: "UNAUTHENTICATED",
      fieldErrors: undefined,
    });
  });

  it("does not ask provisioned users to verify an email", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { code: "email_not_confirmed", status: 400, message: "x" } });
    const res = await loginAction({ email: "a@b.co", password: "x" });
    expect(res).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
    expect(JSON.stringify(res)).not.toMatch(/inbox|verify your email/i);
  });

  it("does not leak unexpected backend errors", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { code: "unexpected_failure", status: 500, message: "db password=secret" } });
    const res = await loginAction({ email: "a@b.co", password: "x" });
    expect(res).toMatchObject({ ok: false, error: "Something went wrong. Please try again." });
    expect(JSON.stringify(res)).not.toContain("secret");
  });

  it("logout revokes the session and redirects to login", async () => {
    auth.signOut.mockResolvedValue({ error: null });
    expect(await redirected(logoutAction())).toBe("/login");
    expect(auth.signOut).toHaveBeenCalledOnce();
  });
});

describe("change password (after first sign-in)", () => {
  const input = { currentPassword: "initial-pass-1", password: "newpass12", confirmPassword: "newpass12" };

  it("re-verifies the current password, then updates it", async () => {
    auth.getUser.mockResolvedValue({ data: { user: { email: "o@acme.com" } } });
    auth.signInWithPassword.mockResolvedValue({ error: null });
    auth.updateUser.mockResolvedValue({ error: null });
    expect(await changePasswordAction(input)).toEqual({ ok: true });
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: "o@acme.com", password: "initial-pass-1" });
    expect(auth.updateUser).toHaveBeenCalledWith({ password: "newpass12" });
  });

  it("refuses a wrong current password without changing anything", async () => {
    auth.getUser.mockResolvedValue({ data: { user: { email: "o@acme.com" } } });
    auth.signInWithPassword.mockResolvedValue({ error: { code: "invalid_credentials", status: 400, message: "x" } });
    expect(await changePasswordAction(input)).toMatchObject({ ok: false, code: "VALIDATION", fieldErrors: { currentPassword: expect.any(String) } });
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("requires a signed-in user", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null } });
    expect(await changePasswordAction(input)).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("rejects mismatched passwords before calling Supabase", async () => {
    expect(await changePasswordAction({ ...input, confirmPassword: "other123" })).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
});
