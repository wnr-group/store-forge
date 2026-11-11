import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { updateSession } from "@/lib/supabase/middleware";
import { proxy } from "@/proxy";

// Signed in = a session cookie whose access token is still valid (the API sets it; the proxy decides without a network call).
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = () => Math.floor(Date.now() / 1000) + 3600;
const SESSION = `sb-example-auth-token=base64-${b64({ access_token: `h.${b64({ exp: exp(), sub: "u1" })}.s`, refresh_token: "RT", expires_at: exp() })}`;
let cookie: string | undefined;
const req = (path: string) => new NextRequest(`http://localhost:3000${path}`, { headers: cookie ? { cookie } : {} });
const signedIn = () => void (cookie = SESSION);
const signedOut = () => void (cookie = undefined);
const location = (res: Response) => res.headers.get("location");

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "a".repeat(30));
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
  cookie = undefined;
});

describe("proxy route protection (unauthenticated)", () => {
  it.each(["/dashboard", "/dashboard/anything", "/admin", "/admin/companies/new", "/no-workspace"])("redirects %s to /login with next=", async (path) => {
    signedOut();
    const res = await updateSession(req(path));
    expect(res.status).toBe(307);
    expect(location(res)).toContain("/login?next=");
    expect(decodeURIComponent(location(res)!)).toContain(path);
  });

  it.each(["/", "/login"])("allows public page %s", async (path) => {
    signedOut();
    const res = await updateSession(req(path));
    expect(res.status).toBe(200);
    expect(location(res)).toBeNull();
  });
});

describe("proxy route protection (authenticated)", () => {
  it.each(["/login"])("redirects %s to /dashboard", async (path) => {
    signedIn();
    const res = await updateSession(req(path));
    expect(location(res)).toContain("/dashboard");
  });

  it.each(["/dashboard", "/admin", "/no-workspace"])("lets signed-in users reach %s", async (path) => {
    signedIn();
    const res = await updateSession(req(path));
    expect(res.status).toBe(200);
  });
});

describe("tenant subdomains (proxy)", () => {
  const withHost = (host: string, path = "/") => new NextRequest(`http://${host}${path}`, { headers: { host } });
  beforeEach(() => vi.stubEnv("NEXT_PUBLIC_ROOT_DOMAIN", "lvh.me:3000"));

  it("rewrites <store>.<root> to the public storefront without touching the session", async () => {
    const res = await proxy(withHost("urban.lvh.me:3000"));
    expect(res.headers.get("x-middleware-rewrite")).toContain("/s/urban");
  });

  it("serves only /login, /dashboard and /no-workspace as the app on a store host; /admin is storefront-only (404)", async () => {
    signedOut();
    expect((await proxy(withHost("urban.lvh.me:3000", "/admin"))).headers.get("x-middleware-rewrite")).toContain("/s/urban/admin");
    expect((await proxy(withHost("urban.lvh.me:3000", "/admin/companies"))).headers.get("x-middleware-rewrite")).toContain("/s/urban/admin/companies");
    expect((await proxy(withHost("urban.lvh.me:3000", "/products"))).headers.get("x-middleware-rewrite")).toContain("/s/urban/products");
  });

  it("lets /login through on a store host (no rewrite) and tells the server which store it is", async () => {
    signedOut();
    const req = withHost("mart-com.lvh.me:3000", "/login");
    const res = await proxy(req);
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
    expect(req.headers.get("x-sf-store")).toBe("mart-com");
  });

  it("protects /dashboard on a store host: signed-out visitors go to that host's /login", async () => {
    signedOut();
    const res = await proxy(withHost("mart-com.lvh.me:3000", "/dashboard/products"));
    expect(new URL(location(res)!).host).toBe("mart-com.lvh.me:3000");
    expect(location(res)).toContain("/login?next=");
  });

  it("a client-supplied store header is always discarded", async () => {
    signedOut();
    const spoof = new NextRequest("http://lvh.me:3000/login", { headers: { host: "lvh.me:3000", "x-sf-store": "victim-shop" } });
    await proxy(spoof);
    expect(spoof.headers.get("x-sf-store")).toBeNull();
    const spoof2 = new NextRequest("http://www.lvh.me:3000/dashboard", { headers: { host: "www.lvh.me:3000", "x-sf-store": "victim-shop" } });
    await proxy(spoof2);
    expect(spoof2.headers.get("x-sf-store")).toBeNull();
    const spoof3 = new NextRequest("http://mine.lvh.me:3000/login", { headers: { host: "mine.lvh.me:3000", "x-sf-store": "victim-shop" } });
    await proxy(spoof3);
    expect(spoof3.headers.get("x-sf-store")).toBe("mine");
  });

  it("leaves the main domain and reserved subdomains to normal session handling", async () => {
    signedOut();
    for (const host of ["lvh.me:3000", "www.lvh.me:3000", "admin.lvh.me:3000"]) {
      const res = await proxy(withHost(host, "/dashboard"));
      expect(location(res), host).toContain("/login");
    }
  });
});

describe("credentials never stay in the URL", () => {
  it.each(["http://localhost:3000", "http://mart-com.lvh.me:3000"])("%s/login?email=..&password=.. is redirected to a clean /login", async (origin) => {
    vi.stubEnv("NEXT_PUBLIC_ROOT_DOMAIN", "lvh.me:3000");
    signedOut();
    const host = new URL(origin).host;
    const res = await proxy(new NextRequest(`${origin}/login?email=a%40b.co&password=secret123&next=%2Fdashboard%2Fproducts`, { headers: { host } }));
    expect(res.status).toBe(303);
    const to = new URL(location(res)!);
    expect(to.host).toBe(host);
    expect(to.pathname).toBe("/login");
    expect(to.search).toBe("?next=%2Fdashboard%2Fproducts");
    expect(location(res)).not.toMatch(/secret123|password|email/);
  });
});
