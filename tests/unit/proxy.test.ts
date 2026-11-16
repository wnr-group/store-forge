import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { updateSession } from "@/lib/supabase/middleware";
import { proxy } from "@/proxy";
import { clearStoreHostCache } from "@/lib/tenant/resolve-host";

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
  it.each(["/dashboard", "/dashboard/anything", "/admin", "/admin/organizations/new", "/no-workspace"])("redirects %s to /login with next=", async (path) => {
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

/** The public storefront endpoint of the API: store slug -> public id (the only thing the proxy reads from it). */
const STORES: Record<string, string> = { urban: "zqkod2", "urban-nest": "abc123", "mart-com": "mk9x2t", "acme-store": "k9m2x1", acme: "store" };

describe("tenant subdomains (proxy)", () => {
  const withHost = (host: string, path = "/") => new NextRequest(`http://${host}${path}`, { headers: { host } });
  const api = vi.fn(async (url: string) => {
    const slug = decodeURIComponent(url.split("/public/storefronts/")[1]);
    const publicId = STORES[slug];
    return publicId
      ? new Response(JSON.stringify({ success: true, data: { slug, publicId } }), { status: 200 })
      : new Response(JSON.stringify({ success: false }), { status: 404 });
  });
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_ROOT_DOMAIN", "lvh.me:3000");
    vi.stubEnv("API_BASE_URL", "http://api.test/api/v1");
    vi.stubEnv("AUTH_BFF_SECRET", "s".repeat(40));
    api.mockClear();
    clearStoreHostCache();
    vi.stubGlobal("fetch", api);
  });
  afterEach(() => vi.unstubAllGlobals());
  const rewrite = (res: Response) => res.headers.get("x-middleware-rewrite");
  const rewrittenPath = (res: Response) => new URL(rewrite(res)!).pathname;

  it("rewrites <store>-<publicId>.<root> to that store's public storefront without touching the session", async () => {
    expect(rewrittenPath(await proxy(withHost("urban-zqkod2.lvh.me:3000")))).toBe("/s/urban");
  });

  it("resolves several tenants independently, by slug AND public id", async () => {
    expect(rewrittenPath(await proxy(withHost("urban-nest-abc123.lvh.me:3000", "/products/mug")))).toBe("/s/urban-nest/products/mug");
    expect(rewrittenPath(await proxy(withHost("mart-com-mk9x2t.lvh.me:3000", "/collections/all")))).toBe("/s/mart-com/collections/all");
    expect(rewrittenPath(await proxy(withHost("urban-zqkod2.lvh.me:3000", "/about")))).toBe("/s/urban/about");
  });

  it("a wrong, missing or another store's public id opens nothing (storefront not-found, never another store)", async () => {
    for (const host of ["urban-wrong12.lvh.me:3000", "urban-mk9x2t.lvh.me:3000", "urban-nest-zqkod2.lvh.me:3000", "ghost-zqkod2.lvh.me:3000"]) {
      const path = rewrittenPath(await proxy(withHost(host)));
      expect(path, host).toBe(`/s/${host.split(".")[0]}`); // the label itself: no store has that slug, so the page 404s
    }
  });

  it("keeps the older <store>.<root> address working, including slugs that end like a public id", async () => {
    expect(rewrittenPath(await proxy(withHost("urban.lvh.me:3000")))).toBe("/s/urban");
    // "acme-store" can be read as store "acme" + public id "store", and acme's public id IS "store" here: the new format wins...
    expect(rewrittenPath(await proxy(withHost("acme-store.lvh.me:3000")))).toBe("/s/acme");
    // ...while a label that is not confirmed as slug + id falls back to the whole label as the slug.
    expect(rewrittenPath(await proxy(withHost("urban-nest.lvh.me:3000")))).toBe("/s/urban-nest");
  });

  it("answers 503 (not a fake 404) when the API cannot be reached", async () => {
    api.mockRejectedValueOnce(new Error("down"));
    expect((await proxy(withHost("urban-zqkod2.lvh.me:3000"))).status).toBe(503);
    clearStoreHostCache();
    api.mockResolvedValueOnce(new Response("oops", { status: 500 }));
    expect((await proxy(withHost("urban-zqkod2.lvh.me:3000"))).status).toBe(503);
  });

  it("asks the API once per store while the answer is cached", async () => {
    await proxy(withHost("urban-zqkod2.lvh.me:3000"));
    await proxy(withHost("urban-zqkod2.lvh.me:3000", "/products"));
    expect(api).toHaveBeenCalledTimes(1);
  });

  it("serves only /login, /dashboard and /no-workspace as the app on a store host; /admin is storefront-only (404)", async () => {
    signedOut();
    expect((await proxy(withHost("urban-zqkod2.lvh.me:3000", "/admin"))).headers.get("x-middleware-rewrite")).toContain("/s/urban/admin");
    expect((await proxy(withHost("urban-zqkod2.lvh.me:3000", "/admin/organizations"))).headers.get("x-middleware-rewrite")).toContain("/s/urban/admin/organizations");
    expect((await proxy(withHost("urban-zqkod2.lvh.me:3000", "/products"))).headers.get("x-middleware-rewrite")).toContain("/s/urban/products");
  });

  it("lets /login through on a store host (no rewrite) and tells the server which store it is", async () => {
    signedOut();
    const req = withHost("mart-com-mk9x2t.lvh.me:3000", "/login");
    const res = await proxy(req);
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
    expect(req.headers.get("x-sf-store")).toBe("mart-com"); // the store's slug, not the host label

    const wrong = withHost("mart-com-aaaaaa.lvh.me:3000", "/login");
    expect(rewrittenPath(await proxy(wrong))).toBe("/s/mart-com-aaaaaa/login"); // not a sign-in page for any store
    expect(wrong.headers.get("x-sf-store")).toBeNull();
  });

  it("protects /dashboard on a store host: signed-out visitors go to that host's /login", async () => {
    signedOut();
    const res = await proxy(withHost("mart-com-mk9x2t.lvh.me:3000", "/dashboard/products"));
    expect(new URL(location(res)!).host).toBe("mart-com-mk9x2t.lvh.me:3000");
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
    const spoof3 = new NextRequest("http://urban-zqkod2.lvh.me:3000/login", { headers: { host: "urban-zqkod2.lvh.me:3000", "x-sf-store": "victim-shop" } });
    await proxy(spoof3);
    expect(spoof3.headers.get("x-sf-store")).toBe("urban");
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
