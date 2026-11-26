import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Authentication through the StoreForge API (NestJS). A real local HTTP server plays the API, so the real fetch code,
 * header handling and cookie relay run; only Next's request-scoped `cookies()` is replaced by an in-memory jar.
 */

type Jar = Map<string, { value: string; options?: Record<string, unknown> }>;
const jar: Jar = new Map();
const store = {
  getAll: () => [...jar].map(([name, c]) => ({ name, value: c.value })),
  get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)!.value } : undefined),
  set: (name: string, value: string, options?: Record<string, unknown>) => void jar.set(name, { value, options }),
  delete: (name: string) => void jar.delete(name),
  toString: () => [...jar].map(([n, c]) => `${n}=${c.value}`).join("; "),
};
vi.mock("next/headers", () => ({ cookies: async () => store, headers: async () => new Headers({ "x-forwarded-for": "203.0.113.9" }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const redirect = vi.fn((url: string) => {
  throw Object.assign(new Error("NEXT_REDIRECT"), { url });
});
vi.mock("next/navigation", () => ({ redirect: (u: string) => redirect(u) }));

const SECRET = "s".repeat(40);
const enc = (o: object) => `base64-${Buffer.from(JSON.stringify(o)).toString("base64url")}`;
const jwt = (exp: number) => `h.${Buffer.from(JSON.stringify({ exp, sub: "u1" })).toString("base64url")}.s`;
const NAME = "sb-proj-auth-token";
const now = () => Math.floor(Date.now() / 1000);
const sessionCookie = (accessExp: number, refresh: string | null = "RT") =>
  enc({ access_token: jwt(accessExp), refresh_token: refresh, expires_at: accessExp });

type Seen = { method: string; path: string; headers: IncomingMessage["headers"]; body: string };
let server: Server;
let seen: Seen[] = [];
let handler: (req: Seen, res: ServerResponse) => void = () => {};

beforeAll(async () => {
  server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      const call = { method: req.method ?? "GET", path: req.url ?? "/", headers: req.headers, body: Buffer.concat(chunks).toString("utf8") };
      seen.push(call);
      handler(call, res);
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

const reply = (res: ServerResponse, status: number, body: unknown, cookies: string[] = []) => {
  res.writeHead(status, { "content-type": "application/json", ...(cookies.length ? { "set-cookie": cookies } : {}) });
  res.end(JSON.stringify(body));
};

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://proj.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "a".repeat(30));
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
  vi.stubEnv("API_BASE_URL", `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`);
  vi.stubEnv("AUTH_BFF_SECRET", SECRET);
  jar.clear();
  seen = [];
  redirect.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const redirected = async (p: Promise<unknown>) => p.then(() => null, (e: { url?: string }) => e.url ?? null);

describe("configuration", () => {
  it("is off without API_BASE_URL and on with it", async () => {
    const { getAuthApiConfig } = await import("@/lib/auth/nest-api");
    expect(getAuthApiConfig({})).toBeNull();
    expect(getAuthApiConfig({ API_BASE_URL: "http://api.test/api/v1/", AUTH_BFF_SECRET: SECRET })).toEqual({ url: "http://api.test/api/v1", secret: SECRET });
  });

  it("refuses a half configuration instead of silently running unprotected", async () => {
    const { getAuthApiConfig } = await import("@/lib/auth/nest-api");
    expect(() => getAuthApiConfig({ API_BASE_URL: "http://api.test/api/v1" })).toThrow(/AUTH_BFF_SECRET/);
    expect(() => getAuthApiConfig({ API_BASE_URL: "http://api.test/api/v1", AUTH_BFF_SECRET: "short" })).toThrow(/AUTH_BFF_SECRET/);
    expect(() => getAuthApiConfig({ API_BASE_URL: "api.test", AUTH_BFF_SECRET: SECRET })).toThrow(/http/);
  });
});

describe("Set-Cookie relay", () => {
  it("parses attributes, keeps cookies host-only and expires what the API expired", async () => {
    const { applySetCookies, parseSetCookie } = await import("@/lib/auth/nest-api");
    expect(parseSetCookie("sb-p-auth-token=abc==; Max-Age=3600; Path=/; Domain=.example.com; HttpOnly; Secure; SameSite=Lax")).toEqual({
      name: "sb-p-auth-token",
      value: "abc==",
      options: { maxAge: 3600, path: "/", httpOnly: true, secure: true, sameSite: "lax" },
    });
    jar.set("old", { value: "x" });
    applySetCookies(store, ["new=1; Path=/; HttpOnly", "old=; Max-Age=0; Path=/", "garbage"]);
    expect([...jar.keys()]).toEqual(["new"]);
    expect(jar.get("new")!.options).toMatchObject({ httpOnly: true, path: "/" });
    expect(jar.get("new")!.options).not.toHaveProperty("domain");
  });
});

describe("login", () => {
  const member = { organizationId: "o1", role: "owner" };
  const loginAs = (platformAdminLevel: string | null, memberships: object[]) => ({
    success: true,
    data: { id: "u1", email: "a@b.co", platformAdminLevel, memberships },
  });
  const loginBody = loginAs(null, [member]);
  const cookies = [`${NAME}=${encodeURIComponent("v").replace("%", "")}; Max-Age=34560000; Path=/; HttpOnly; SameSite=Lax`, "sf_signed_in=1; Max-Age=34560000; Path=/; SameSite=Lax"];

  it("sends the credentials, visitor address and shared secret to the API, relays its HttpOnly cookies and redirects", async () => {
    handler = (_req, res) => reply(res, 200, loginBody, cookies);
    const { loginAction } = await import("@/app/(auth)/actions");
    expect(await redirected(loginAction({ email: " A@B.co ", password: "pw" }))).toBe("/dashboard");

    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ method: "POST", path: "/api/v1/auth/login" });
    expect(JSON.parse(seen[0].body)).toEqual({ email: "a@b.co", password: "pw", includeProfile: true });
    expect(seen[0].headers["x-internal-auth"]).toBe(SECRET);
    expect(seen[0].headers["x-forwarded-for"]).toBe("203.0.113.9");
    expect(jar.get(NAME)!.options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
    expect(jar.get("sf_signed_in")!.options).not.toHaveProperty("httpOnly");
  });

  it("honours a safe next path but not an external one", async () => {
    handler = (_req, res) => reply(res, 200, loginBody, cookies);
    const { loginAction } = await import("@/app/(auth)/actions");
    expect(await redirected(loginAction({ email: "a@b.co", password: "x" }, "/dashboard/products"))).toBe("/dashboard/products");
    expect(await redirected(loginAction({ email: "a@b.co", password: "x" }, "https://evil.com"))).toBe("/dashboard");
  });

  it("only asks the API for the profile when there is no specific destination", async () => {
    handler = (_req, res) => reply(res, 200, loginBody, cookies);
    const { loginAction } = await import("@/app/(auth)/actions");
    await redirected(loginAction({ email: "a@b.co", password: "x" }, "/dashboard/products"));
    await redirected(loginAction({ email: "a@b.co", password: "x" }));
    expect(seen.map((s) => JSON.parse(s.body).includeProfile)).toEqual([false, true]);
  });

  describe("landing page without a next path", () => {
    const land = async (body: object, next?: string) => {
      handler = (_req, res) => reply(res, 200, body, cookies);
      const { loginAction } = await import("@/app/(auth)/actions");
      return redirected(loginAction({ email: "a@b.co", password: "x" }, next));
    };

    it("sends a Platform Admin without a workspace straight to /admin", async () => {
      expect(await land(loginAs("super_admin", []))).toBe("/admin");
      expect(await land(loginAs("admin", []), "/dashboard")).toBe("/admin"); // the proxy's default next
    });

    it("sends an organization user to the dashboard", async () => {
      expect(await land(loginAs(null, [member]))).toBe("/dashboard");
    });

    it("keeps a Platform Admin who also belongs to an organization on that dashboard, as /dashboard always did", async () => {
      expect(await land(loginAs("admin", [member]))).toBe("/dashboard");
    });

    it("falls back to /dashboard (which still redirects admins itself) when the API gives no identity", async () => {
      expect(await land({ success: true, data: { id: "u1", email: "a@b.co" } })).toBe("/dashboard");
    });

    it("an explicit next path wins, even for a Platform Admin", async () => {
      expect(await land(loginAs("admin", []), "/admin/organizations")).toBe("/admin/organizations");
    });
  });

  it("keeps the existing wording for bad credentials and sets no cookie", async () => {
    handler = (_req, res) => reply(res, 401, { success: false, message: "Incorrect email or password.", error: { code: "INVALID_CREDENTIALS" } });
    const { loginAction } = await import("@/app/(auth)/actions");
    expect(await loginAction({ email: "a@b.co", password: "wrong" })).toEqual({ ok: false, error: "Incorrect email or password.", code: "UNAUTHENTICATED", fieldErrors: undefined });
    expect(jar.size).toBe(0);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("keeps the wording for a not-yet-active account and for rate limiting", async () => {
    const { loginAction } = await import("@/app/(auth)/actions");
    handler = (_req, res) => reply(res, 401, { success: false, error: { code: "ACCOUNT_NOT_ACTIVE" } });
    expect(await loginAction({ email: "a@b.co", password: "x" })).toMatchObject({ ok: false, code: "UNAUTHENTICATED", error: "This account is not active yet. Please contact your administrator." });
    handler = (_req, res) => reply(res, 429, { success: false, message: "Too many requests. Please wait about 9 minutes and try again.", error: { code: "LOGIN_RATE_LIMITED" } });
    expect(await loginAction({ email: "a@b.co", password: "x" })).toMatchObject({ ok: false, code: "RATE_LIMITED", error: "Too many requests. Please wait about 9 minutes and try again." });
  });

  it("does not leak API internals, and does not call the API for an invalid form", async () => {
    const { loginAction } = await import("@/app/(auth)/actions");
    handler = (_req, res) => reply(res, 500, { success: false, message: "db password=secret", error: { code: "INTERNAL_ERROR" } });
    const res = await loginAction({ email: "a@b.co", password: "x" });
    expect(res).toMatchObject({ ok: false, error: "Something went wrong. Please try again." });
    expect(JSON.stringify(res)).not.toContain("secret");
    seen = [];
    expect(await loginAction({ email: "not-an-email", password: "" })).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(seen).toHaveLength(0);
  });

  it("reports an unreachable API as a generic error, never as a login result", async () => {
    vi.stubEnv("API_BASE_URL", "http://127.0.0.1:1/api/v1");
    const { loginAction } = await import("@/app/(auth)/actions");
    expect(await loginAction({ email: "a@b.co", password: "x" })).toMatchObject({ ok: false, error: "Something went wrong. Please try again." });
    expect(jar.size).toBe(0);
  });
});

describe("register (self-service account)", () => {
  const cookies = [`${NAME}=v; Max-Age=34560000; Path=/; HttpOnly; SameSite=Lax`, "sf_signed_in=1; Max-Age=34560000; Path=/; SameSite=Lax"];
  const valid = { fullName: "Asha Rao", email: " Asha@Example.com ", password: "Asha-pass-1", confirmPassword: "Asha-pass-1", acceptTerms: true };

  it("creates the account through the API, relays the session cookies and continues to the onboarding", async () => {
    handler = (_req, res) => reply(res, 200, { success: true, data: { id: "u1", email: "asha@example.com" } }, cookies);
    const { registerAction } = await import("@/app/(auth)/actions");
    expect(await redirected(registerAction(valid))).toBe("/onboarding");

    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ method: "POST", path: "/api/v1/auth/register" });
    expect(JSON.parse(seen[0].body)).toEqual({ ...valid, email: "asha@example.com", includeProfile: false });
    expect(seen[0].headers["x-internal-auth"]).toBe(SECRET);
    expect(seen[0].headers["x-forwarded-for"]).toBe("203.0.113.9");
    expect(jar.get(NAME)!.options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
  });

  it("keeps the plan the visitor picked, and drops anything that is not shaped like a plan", async () => {
    handler = (_req, res) => reply(res, 200, { success: true, data: { id: "u1" } }, cookies);
    const { registerAction } = await import("@/app/(auth)/actions");
    expect(await redirected(registerAction(valid, { planCode: "growth", billingInterval: "yearly" }))).toBe("/onboarding?plan=growth&interval=yearly");
    expect(await redirected(registerAction(valid, { planCode: "growth", billingInterval: "weekly" }))).toBe("/onboarding?plan=growth&interval=monthly");
    expect(await redirected(registerAction(valid, { planCode: "https://evil.com", billingInterval: "monthly" }))).toBe("/onboarding");
    expect(await redirected(registerAction(valid, { planCode: "../admin", billingInterval: "monthly" }))).toBe("/onboarding");
  });

  it("reports an e-mail that is already registered on the e-mail field and signs nobody in", async () => {
    handler = (_req, res) => reply(res, 409, { success: false, message: "An account with this email already exists.", error: { code: "EMAIL_TAKEN" } });
    const { registerAction } = await import("@/app/(auth)/actions");
    expect(await registerAction(valid)).toMatchObject({ ok: false, code: "CONFLICT", fieldErrors: { email: "Already in use" } });
    expect(jar.size).toBe(0);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("checks the form before calling the API: confirmation, terms, password rules, e-mail and name", async () => {
    const { registerAction } = await import("@/app/(auth)/actions");
    const bad = [
      { ...valid, confirmPassword: "Different-1" },
      { ...valid, acceptTerms: false },
      { ...valid, password: "short1", confirmPassword: "short1" },
      { ...valid, password: "nodigitshere", confirmPassword: "nodigitshere" },
      { ...valid, email: "not-an-email" },
      { ...valid, fullName: " " },
    ];
    for (const input of bad) expect(await registerAction(input)).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(seen).toHaveLength(0);
  });

  it("tells the visitor to sign in when the account was created but the automatic sign-in failed", async () => {
    handler = (_req, res) => reply(res, 500, { success: false, message: "Your account was created, but we could not sign you in. Please sign in with your email and password.", error: { code: "REGISTERED_SIGN_IN_FAILED" } });
    const { registerAction } = await import("@/app/(auth)/actions");
    expect(await registerAction(valid)).toMatchObject({ ok: false, error: expect.stringContaining("Please sign in") });
    expect(jar.size).toBe(0);
  });

  it("sends a signed-in person who has no store yet (and is not platform staff) to the onboarding", async () => {
    handler = (_req, res) => reply(res, 200, { success: true, data: { id: "u1", email: "a@b.co", platformAdminLevel: null, memberships: [] } }, cookies);
    const { loginAction } = await import("@/app/(auth)/actions");
    expect(await redirected(loginAction({ email: "a@b.co", password: "x" }))).toBe("/onboarding");
    // ...but an explicit destination (for example the onboarding link carried through the login page) still wins.
    expect(await redirected(loginAction({ email: "a@b.co", password: "x" }, "/onboarding?plan=growth&interval=monthly"))).toBe("/onboarding?plan=growth&interval=monthly");
  });
});

describe("logout", () => {
  it("revokes through the API with the visitor's cookies and clears every session cookie", async () => {
    jar.set(NAME, { value: "SESSION" });
    jar.set("sf_signed_in", { value: "1" });
    jar.set("theme", { value: "dark" });
    handler = (_req, res) => reply(res, 200, { success: true, data: { signedOut: true } }, [`${NAME}=; Max-Age=0; Path=/; HttpOnly`, "sf_signed_in=; Max-Age=0; Path=/"]);
    const { logoutAction } = await import("@/app/(auth)/actions");
    expect(await redirected(logoutAction())).toBe("/login");
    expect(seen[0]).toMatchObject({ method: "POST", path: "/api/v1/auth/logout" });
    expect(seen[0].headers.cookie).toContain(`${NAME}=SESSION`);
    expect([...jar.keys()]).toEqual(["theme"]); // unrelated cookies are untouched
  });

  it("still signs the browser out locally when the API is down", async () => {
    vi.stubEnv("API_BASE_URL", "http://127.0.0.1:1/api/v1");
    jar.set(`${NAME}.0`, { value: "A" });
    jar.set(`${NAME}.1`, { value: "B" });
    jar.set("sf_signed_in", { value: "1" });
    const { logoutAction } = await import("@/app/(auth)/actions");
    expect(await redirected(logoutAction())).toBe("/login");
    expect(jar.size).toBe(0);
  });
});

describe("session check (getCurrentUser)", () => {
  const load = async () => {
    vi.resetModules();
    return (await import("@/lib/auth/session")).getCurrentUser;
  };

  it("asks the API to verify the access token and returns the same user shape as before", async () => {
    jar.set(NAME, { value: sessionCookie(now() + 3600) });
    handler = (_req, res) => reply(res, 200, { success: true, data: { user: { id: "u1", email: "a@b.co", fullName: "Ann Admin" }, expiresAt: now() + 3600 } });
    const user = await (await load())();
    expect(user).toEqual({ id: "u1", email: "a@b.co", user_metadata: { full_name: "Ann Admin" } });
    expect(seen[0]).toMatchObject({ method: "GET", path: "/api/v1/auth/session" });
    expect(seen[0].headers.authorization).toMatch(/^Bearer h\./);
  });

  it("is null without a cookie (no API call) and null when the API rejects the token", async () => {
    expect(await (await load())()).toBeNull();
    expect(seen).toHaveLength(0);
    jar.set(NAME, { value: sessionCookie(now() + 3600) });
    handler = (_req, res) => reply(res, 401, { success: false, error: { code: "TOKEN_EXPIRED" } });
    expect(await (await load())()).toBeNull();
  });

  it("is null (not an error page) when the API cannot be reached", async () => {
    vi.stubEnv("API_BASE_URL", "http://127.0.0.1:1/api/v1");
    jar.set(NAME, { value: sessionCookie(now() + 3600) });
    expect(await (await load())()).toBeNull();
  });
});

describe("change password", () => {
  const input = { currentPassword: "initial-pass-1", password: "newpass12", confirmPassword: "newpass12" };

  it("sends the access token as a Bearer header and succeeds", async () => {
    jar.set(NAME, { value: sessionCookie(now() + 3600) });
    handler = (_req, res) => reply(res, 200, { success: true, data: null });
    const { changePasswordAction } = await import("@/app/(auth)/actions");
    expect(await changePasswordAction(input)).toEqual({ ok: true });
    expect(seen[0]).toMatchObject({ method: "POST", path: "/api/v1/auth/change-password" });
    expect(seen[0].headers.authorization).toMatch(/^Bearer h\./);
    expect(JSON.parse(seen[0].body)).toEqual({ currentPassword: "initial-pass-1", password: "newpass12", confirmPassword: "newpass12" });
  });

  it("keeps the field error for a wrong current password", async () => {
    jar.set(NAME, { value: sessionCookie(now() + 3600) });
    handler = (_req, res) => reply(res, 400, { success: false, error: { code: "CURRENT_PASSWORD_INCORRECT", details: { currentPassword: "Incorrect password" } } });
    const { changePasswordAction } = await import("@/app/(auth)/actions");
    expect(await changePasswordAction(input)).toMatchObject({ ok: false, error: "Your current password is incorrect.", fieldErrors: { currentPassword: "Incorrect password" } });
  });

  it("needs a session", async () => {
    const { changePasswordAction } = await import("@/app/(auth)/actions");
    expect(await changePasswordAction(input)).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
    expect(seen).toHaveLength(0);
  });
});

describe("proxy: session refresh and optimistic route gating", () => {
  const request = (path: string, cookie?: string) =>
    new NextRequest(`http://localhost:3000${path}`, { headers: cookie ? { cookie } : {} });
  const run = async (req: NextRequest) => (await import("@/lib/supabase/middleware")).updateSession(req);

  it("a session whose access token is still valid needs no network call at all", async () => {
    const res = await run(request("/dashboard", `${NAME}=${sessionCookie(now() + 3600)}`));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
    expect(seen).toHaveLength(0);
  });

  it("an expired access token is refreshed through the API; the browser receives the new cookies", async () => {
    const fresh = sessionCookie(now() + 3600, "RT2");
    handler = (_req, res) => reply(res, 200, { success: true, data: { user: { id: "u1" } } }, [`${NAME}=${fresh}; Max-Age=34560000; Path=/; HttpOnly; SameSite=Lax`, "sf_signed_in=1; Max-Age=34560000; Path=/"]);
    const cookie = `${NAME}=${sessionCookie(now() - 30)}`;
    const res = await run(request("/dashboard/products", cookie));
    expect(res.status).toBe(200);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ method: "POST", path: "/api/v1/auth/refresh" });
    expect(seen[0].headers.cookie).toBe(cookie);
    expect(seen[0].headers["x-internal-auth"]).toBe(SECRET);
    expect(res.cookies.get(NAME)?.value).toBe(fresh);
    expect(res.cookies.get(NAME)).toMatchObject({ httpOnly: true, sameSite: "lax" });
  });

  it("a token about to expire (inside the margin) is refreshed too", async () => {
    handler = (_req, res) => reply(res, 200, { success: true, data: {} }, [`${NAME}=${sessionCookie(now() + 3600)}; Path=/; HttpOnly`]);
    await run(request("/dashboard", `${NAME}=${sessionCookie(now() + 20)}`));
    expect(seen).toHaveLength(1);
  });

  it("when the refresh token is used up the session ends: cookies are cleared and the visitor goes to /login with a return path", async () => {
    handler = (_req, res) => reply(res, 401, { success: false, error: { code: "SESSION_EXPIRED" } }, [`${NAME}=; Max-Age=0; Path=/`, "sf_signed_in=; Max-Age=0; Path=/"]);
    const res = await run(request("/dashboard/team?tab=1", `${NAME}=${sessionCookie(now() - 30)}; sf_signed_in=1`));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
    expect(new URL(res.headers.get("location")!).searchParams.get("next")).toBe("/dashboard/team?tab=1");
    const setCookie = res.headers.getSetCookie().join("\n");
    expect(setCookie).toMatch(new RegExp(`${NAME}=;`));
  });

  it("an expired session without a refresh token is signed out without calling the API", async () => {
    const res = await run(request("/dashboard", `${NAME}=${sessionCookie(now() - 30, null)}`));
    expect(res.status).toBe(307);
    expect(seen).toHaveLength(0);
  });

  it("when the API is unreachable the visitor is not treated as signed in, and the cookies are kept for a retry", async () => {
    vi.stubEnv("API_BASE_URL", "http://127.0.0.1:1/api/v1");
    const res = await run(request("/dashboard", `${NAME}=${sessionCookie(now() - 30)}`));
    expect(res.status).toBe(307);
    expect(res.headers.getSetCookie().join("\n")).not.toMatch(/Max-Age=0/i);
  });

  it("protected routes need a session; the login page sends signed-in visitors to the dashboard; public pages stay open", async () => {
    expect((await run(request("/dashboard"))).status).toBe(307);
    expect((await run(request("/admin"))).status).toBe(307);
    expect((await run(request("/"))).status).toBe(200);
    expect((await run(request("/login"))).status).toBe(200);
    const signedIn = await run(request("/login", `${NAME}=${sessionCookie(now() + 3600)}`));
    expect(new URL(signedIn.headers.get("location")!).pathname).toBe("/dashboard");
    expect(seen).toHaveLength(0);
  });
});

describe("reading the session cookie without @supabase/ssr", () => {
  const key = "sb-proj-auth-token";
  const session = { access_token: "tok", refresh_token: "ref", expires_at: 1234 };
  const jar = (cookies: { name: string; value: string }[]) => ({ getAll: () => cookies });

  it("reads a whole, base64url-encoded cookie, including non-ASCII text", async () => {
    const { readStoredSession } = await import("@/lib/auth/nest-api");
    const value = enc({ ...session, user: { name: "Zoë 日本" } });
    expect(await readStoredSession(jar([{ name: key, value }]))).toEqual({ accessToken: "tok", refreshToken: "ref", expiresAt: 1234 });
  });

  it("joins numbered chunks in order, and reads a plain JSON cookie", async () => {
    const { readStoredSession } = await import("@/lib/auth/nest-api");
    const value = enc(session);
    const cut = Math.floor(value.length / 2);
    const chunks = [`${key}.1`, `${key}.0`].map((name, i) => ({ name, value: i === 0 ? value.slice(cut) : value.slice(0, cut) }));
    expect((await readStoredSession(jar(chunks)))?.accessToken).toBe("tok");
    expect((await readStoredSession(jar([{ name: key, value: JSON.stringify(session) }])))?.refreshToken).toBe("ref");
  });

  it("treats a missing, corrupt or token-less cookie as no session", async () => {
    const { readStoredSession } = await import("@/lib/auth/nest-api");
    expect(await readStoredSession(jar([]))).toBeNull();
    expect(await readStoredSession(jar([{ name: key, value: "base64-@@@" }]))).toBeNull();
    expect(await readStoredSession(jar([{ name: key, value: "base64-AAAA" }]))).toBeNull();
    expect(await readStoredSession(jar([{ name: key, value: enc({ refresh_token: "r" }) }]))).toBeNull();
  });
});
