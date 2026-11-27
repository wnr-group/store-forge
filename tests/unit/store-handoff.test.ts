import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { isSubdomainAppPath } from "@/lib/tenant/host";

/**
 * Opening a store owner's dashboard on THEIR store host. A real local HTTP server plays the API (so the real fetch code, headers and
 * cookie relay run); only Next's request-scoped `cookies()` / `headers()` are replaced.
 */

const NAME = "sb-proj-auth-token";
const SECRET = "s".repeat(40);
const enc = (o: object) => `base64-${Buffer.from(JSON.stringify(o)).toString("base64url")}`;
const jwt = (exp: number) => `h.${Buffer.from(JSON.stringify({ exp, sub: "u1" })).toString("base64url")}.s`;
const exp = () => Math.floor(Date.now() / 1000) + 3600;

const jar = new Map<string, string>();
const store = {
  getAll: () => [...jar].map(([name, value]) => ({ name, value })),
  get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
  set: (name: string, value: string) => void jar.set(name, value),
  delete: (name: string) => void jar.delete(name),
  toString: () => [...jar].map(([n, v]) => `${n}=${v}`).join("; "),
};
vi.mock("next/headers", () => ({ cookies: async () => store, headers: async () => new Headers({ "x-forwarded-for": "203.0.113.9" }) }));

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
  vi.stubEnv("API_BASE_URL", `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`);
  vi.stubEnv("AUTH_BFF_SECRET", SECRET);
  vi.stubEnv("NEXT_PUBLIC_ROOT_DOMAIN", "lvh.me:3000");
  jar.clear();
  jar.set(NAME, enc({ access_token: jwt(exp()), refresh_token: "RT", expires_at: exp() }));
  seen = [];
  vi.spyOn(console, "log").mockImplementation(() => {});
});

const STORE = { slug: "urban", publicId: "abc123" };

describe("the store host's dashboard address", () => {
  it("is on the store's own host, carries a one-time code made for that host, and is never the main domain", async () => {
    handler = (_req, res) => reply(res, 200, { success: true, data: { code: "CODE.MAC", expiresInSeconds: 60 } });
    const { storeDashboardUrl } = await import("@/lib/tenant/open-store");
    const url = await storeDashboardUrl(STORE);

    expect(url).toBe("http://urban-abc123.lvh.me:3000/auth/handoff?code=CODE.MAC");
    expect(new URL(url!).host).not.toBe("lvh.me:3000");
    expect(seen).toHaveLength(1);
    expect(seen[0].path).toBe("/api/v1/auth/handoff");
    expect(JSON.parse(seen[0].body)).toEqual({ audience: "urban-abc123" });
    // The signed-in person's own access token proves who is asking; the browser's cookies are not forwarded.
    expect(seen[0].headers.authorization).toMatch(/^Bearer h\./);
    expect(seen[0].headers.cookie).toBeUndefined();
  });

  it("still lands on the store host (its sign-in page) when no code can be made", async () => {
    handler = (_req, res) => reply(res, 403, { success: false, error: { code: "FORBIDDEN" } });
    const { storeDashboardUrl } = await import("@/lib/tenant/open-store");
    expect(await storeDashboardUrl(STORE)).toBe("http://urban-abc123.lvh.me:3000/login?next=%2Fdashboard");
  });

  it("uses https on a real root domain", async () => {
    vi.stubEnv("NEXT_PUBLIC_ROOT_DOMAIN", "store-forge.com");
    handler = (_req, res) => reply(res, 200, { success: true, data: { code: "C.M" } });
    const { storeDashboardUrl } = await import("@/lib/tenant/open-store");
    expect(await storeDashboardUrl(STORE)).toBe("https://urban-abc123.store-forge.com/auth/handoff?code=C.M");
  });

  it("is null (nothing to redirect to, no API call) when no root domain is configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_ROOT_DOMAIN", "");
    const { storeDashboardUrl, hasStoreHost } = await import("@/lib/tenant/open-store");
    expect(await storeDashboardUrl(STORE)).toBeNull();
    expect(hasStoreHost(STORE)).toBe(false);
    expect(seen).toHaveLength(0);
  });
});

describe("GET /auth/handoff on a store host", () => {
  const call = async (url: string) => {
    const { GET } = await import("@/app/auth/handoff/route");
    const u = new URL(url);
    return GET(new NextRequest(url, { headers: { host: u.host } }));
  };

  it("trades the code for this host's own session and opens the dashboard on the same host", async () => {
    jar.clear(); // a fresh store host has no session
    handler = (_req, res) =>
      reply(res, 200, { success: true, data: { id: "u1" } }, [`${NAME}=base64-NEW; Path=/; HttpOnly; SameSite=Lax`, "sf_signed_in=1; Path=/; SameSite=Lax"]);
    const res = await call("http://urban-abc123.lvh.me:3000/auth/handoff?code=CODE.MAC");

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("http://urban-abc123.lvh.me:3000/dashboard");
    expect(res.headers.get("location")).not.toContain("code=");
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
    expect(res.cookies.get(NAME)?.value).toBe("base64-NEW");
    expect(res.cookies.get("sf_signed_in")?.value).toBe("1");
    expect(JSON.parse(seen[0].body)).toEqual({ code: "CODE.MAC", audience: "urban-abc123" });
    expect(seen[0].headers["x-internal-auth"]).toBe(SECRET);
  });

  it("stays on the store host even when the server reports its own address (next dev: http://localhost:3000)", async () => {
    jar.clear();
    handler = (_req, res) => reply(res, 200, { success: true, data: { id: "u1" } }, [`${NAME}=base64-NEW; Path=/; HttpOnly`]);
    const { GET } = await import("@/app/auth/handoff/route");
    const res = await GET(new NextRequest("http://localhost:3000/auth/handoff?code=CODE.MAC", { headers: { host: "urban-abc123.lvh.me:3000" } }));
    expect(res.headers.get("location")).toBe("http://urban-abc123.lvh.me:3000/dashboard");
    expect(res.cookies.get(NAME)?.value).toBe("base64-NEW");
  });

  it("sends a refused code (used, expired, other host) to this host's sign-in page and sets no cookie", async () => {
    handler = (_req, res) => reply(res, 401, { success: false, error: { code: "HANDOFF_INVALID" } });
    const res = await call("http://urban-abc123.lvh.me:3000/auth/handoff?code=OLD.MAC");
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("http://urban-abc123.lvh.me:3000/login?next=%2Fdashboard");
    expect(res.cookies.getAll()).toEqual([]);
  });

  it.each([
    ["no code", "http://urban-abc123.lvh.me:3000/auth/handoff"],
    ["the main domain, which has no store", "http://lvh.me:3000/auth/handoff?code=C.M"],
  ])("does not even ask the API for %s", async (_name, url) => {
    const res = await call(url);
    expect(res.headers.get("location")).toBe(`${new URL(url).origin}/login`);
    expect(seen).toHaveLength(0);
  });
});

describe("GET /auth/sign-out on the main site", () => {
  const call = async (to?: string) => {
    const { GET } = await import("@/app/auth/sign-out/route");
    const url = `http://lvh.me:3000/auth/sign-out${to === undefined ? "" : `?to=${encodeURIComponent(to)}`}`;
    return GET(new Request(url, { headers: { host: "lvh.me:3000" } }));
  };

  it("clears the main site's session and returns to the store's own sign-in page", async () => {
    jar.set("sf_signed_in", "1");
    handler = (_req, res) => reply(res, 200, { success: true, data: { signedOut: true } });
    const res = await call("urban-abc123");
    expect(res.headers.get("location")).toBe("http://urban-abc123.lvh.me:3000/login");
    expect(seen[0].path).toBe("/api/v1/auth/logout");
    expect(jar.size).toBe(0);
  });

  it.each([["evil.com/x"], ["a.b"], ["www"], [""], [undefined]])("never returns to a made-up address (%s)", async (to) => {
    handler = (_req, res) => reply(res, 200, { success: true, data: { signedOut: true } });
    const res = await call(to);
    expect(res.headers.get("location")).toBe("http://lvh.me:3000/login");
  });
});

describe("store host routing", () => {
  it("keeps the handoff on the app side of a store host (it is not a storefront page)", () => {
    expect(isSubdomainAppPath("/auth/handoff")).toBe(true);
    expect(isSubdomainAppPath("/auth/open-store")).toBe(true); // a store host answers it itself (see the route), never a storefront 404
  });
});
