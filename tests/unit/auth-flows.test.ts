import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = {
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
};
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth }) }));

const redirect = vi.fn((url: string) => {
  throw Object.assign(new Error("NEXT_REDIRECT"), { url });
});
vi.mock("next/navigation", () => ({ redirect: (u: string) => redirect(u) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: vi.fn(), set: vi.fn(), getAll: () => [] }) }));

import { forgotPasswordAction, loginAction, logoutAction, registerAction, resetPasswordAction } from "@/app/(auth)/actions";

const validRegistration = {
  fullName: "Jane Doe",
  email: "jane@example.com",
  password: "hunter22x",
  confirmPassword: "hunter22x",
  acceptTerms: true,
};

const redirected = async (p: Promise<unknown>) => p.then(() => null, (e: { url?: string }) => e.url ?? null);

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "a".repeat(30));
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
  for (const fn of [...Object.values(auth), redirect]) fn.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("registration", () => {
  it("sends the user to verify-email when confirmation is required (no session)", async () => {
    auth.signUp.mockResolvedValue({ data: { user: { identities: [{}] }, session: null }, error: null });
    const url = await redirected(registerAction(validRegistration));
    expect(url).toBe("/verify-email?email=jane%40example.com");
    const arg = auth.signUp.mock.calls[0][0];
    expect(arg.options.emailRedirectTo).toBe("http://localhost:3000/auth/callback?next=%2Fdashboard");
    expect(arg.options.data).toEqual({ full_name: "Jane Doe" });
  });

  it("goes straight to the dashboard when a session is returned", async () => {
    auth.signUp.mockResolvedValue({ data: { user: { identities: [{}] }, session: {} }, error: null });
    expect(await redirected(registerAction(validRegistration))).toBe("/dashboard");
  });

  it("reports duplicate emails (obfuscated user without identities)", async () => {
    auth.signUp.mockResolvedValue({ data: { user: { identities: [] }, session: null }, error: null });
    const res = await registerAction(validRegistration);
    expect(res).toMatchObject({ ok: false, code: "CONFLICT", fieldErrors: { email: expect.any(String) } });
  });

  it("reports duplicate emails (explicit error)", async () => {
    auth.signUp.mockResolvedValue({ data: {}, error: { code: "user_already_exists", status: 422, message: "x" } });
    expect(await registerAction(validRegistration)).toMatchObject({ ok: false, code: "CONFLICT" });
  });

  it("rejects invalid input on the server without calling Supabase", async () => {
    const res = await registerAction({ ...validRegistration, confirmPassword: "nope" });
    expect(res).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(auth.signUp).not.toHaveBeenCalled();
  });
});

describe("login / logout", () => {
  it("redirects to the dashboard on success", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: null });
    expect(await redirected(loginAction({ email: "a@b.co", password: "x" }))).toBe("/dashboard");
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

describe("password recovery", () => {
  it("requests a reset email pointing at the reset page via the callback", async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ error: null });
    expect(await forgotPasswordAction({ email: "a@b.co" })).toEqual({ ok: true });
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("a@b.co", {
      redirectTo: "http://localhost:3000/auth/callback?next=%2Freset-password",
    });
  });

  it("answers identically when the email is unknown (no account enumeration)", async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ error: { status: 400, code: "user_not_found", message: "x" } });
    expect(await forgotPasswordAction({ email: "ghost@b.co" })).toEqual({ ok: true });
  });

  it("updates the password then redirects", async () => {
    auth.updateUser.mockResolvedValue({ error: null });
    const url = await redirected(resetPasswordAction({ password: "newpass12", confirmPassword: "newpass12" }));
    expect(url).toBe("/dashboard");
    expect(auth.updateUser).toHaveBeenCalledWith({ password: "newpass12" });
  });

  it("fails clearly when the recovery session is gone", async () => {
    auth.updateUser.mockResolvedValue({ error: { status: 401, code: "session_not_found", message: "x" } });
    expect(await resetPasswordAction({ password: "newpass12", confirmPassword: "newpass12" })).toMatchObject({
      ok: false,
      code: "UNAUTHENTICATED",
    });
  });

  it("rejects mismatched passwords before calling Supabase", async () => {
    expect(await resetPasswordAction({ password: "newpass12", confirmPassword: "other123" })).toMatchObject({ ok: false });
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
});
