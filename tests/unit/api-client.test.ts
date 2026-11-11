import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/** The business API client against a local HTTP server standing in for the StoreForge API. Only `cookies()` is replaced. */

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [...jar].map(([name, value]) => ({ name, value })) }),
}));

const jwt = `h.${Buffer.from(JSON.stringify({ exp: 4102444800, sub: "u1" })).toString("base64url")}.s`;
const sessionCookie = `base64-${Buffer.from(JSON.stringify({ access_token: jwt, refresh_token: "RT", expires_at: 4102444800 })).toString("base64url")}`;

type Seen = { method?: string; url?: string; headers: IncomingMessage["headers"]; body: string };
let seen: Seen[] = [];
let reply: { status: number; body: unknown } = { status: 200, body: { success: true, data: [] } };
let server: Server;

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      seen.push({ method: req.method, url: req.url, headers: req.headers, body });
      res.writeHead(reply.status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(reply.body));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as AddressInfo;
  process.env.AUTH_API_URL = `http://127.0.0.1:${port}/api/v1`;
  process.env.AUTH_BFF_SECRET = "s".repeat(40);
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));
beforeEach(() => {
  seen = [];
  jar.clear();
  jar.set("sb-proj-auth-token", sessionCookie);
  reply = { status: 200, body: { success: true, data: [] } };
});

const ORG = "11111111-1111-4111-8111-111111111111";

describe("serializeQuery / base URL", () => {
  it("skips empty values and encodes the rest", async () => {
    const { serializeQuery } = await import("@/lib/api/client");
    expect(serializeQuery({ q: "a b&c", page: 2, status: "", x: undefined, y: null, on: false })).toBe("?q=a+b%26c&page=2&on=false");
    expect(serializeQuery({})).toBe("");
  });

  it("needs the API to be configured; there is no direct-database alternative", async () => {
    const { apiBaseUrl } = await import("@/lib/api/config");
    expect(apiBaseUrl({ AUTH_API_URL: "http://localhost:4000/api/v1/", AUTH_BFF_SECRET: "s".repeat(40) })).toBe("http://localhost:4000/api/v1");
    expect(() => apiBaseUrl({})).toThrow(/AUTH_API_URL/);
    expect(() => apiBaseUrl({ AUTH_API_URL: "http://localhost:4000/api/v1" })).toThrow(/AUTH_BFF_SECRET/);
  });
});

describe("apiRequest", () => {
  it("sends the cookie's access token as a Bearer token and the organization header, never a body on GET", async () => {
    const { apiRequest } = await import("@/lib/api/client");
    reply = { status: 200, body: { success: true, data: [{ id: "c1" }], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } } };
    const result = await apiRequest("/categories", { organizationId: ORG, query: { page: 1 } });
    expect(result.data).toEqual([{ id: "c1" }]);
    expect(result.meta?.total).toBe(1);
    expect(seen[0].url).toBe("/api/v1/categories?page=1");
    expect(seen[0].headers.authorization).toBe(`Bearer ${jwt}`);
    expect(seen[0].headers["x-organization-id"]).toBe(ORG);
    expect(seen[0].body).toBe("");
  });

  it("omits the organization header when none is given and sends JSON bodies", async () => {
    const { apiRequest } = await import("@/lib/api/client");
    await apiRequest("/users/me", { method: "PATCH", json: { fullName: "Ada" } });
    expect(seen[0].headers["x-organization-id"]).toBeUndefined();
    expect(seen[0].headers["content-type"]).toBe("application/json");
    expect(JSON.parse(seen[0].body)).toEqual({ fullName: "Ada" });
  });

  it("fails as UNAUTHENTICATED without calling the API when there is no session", async () => {
    const { apiRequest } = await import("@/lib/api/client");
    jar.clear();
    await expect(apiRequest("/categories")).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    expect(seen).toHaveLength(0);
  });

  it.each([
    [400, "VALIDATION"],
    [401, "UNAUTHENTICATED"],
    [403, "FORBIDDEN"],
    [404, "NOT_FOUND"],
    [409, "CONFLICT"],
    [429, "RATE_LIMITED"],
  ])("maps HTTP %i to %s and keeps the API's safe message and field errors", async (status, code) => {
    const { apiRequest } = await import("@/lib/api/client");
    reply = { status, body: { success: false, message: "Safe message", error: { code: "X", details: { slug: "Already used." } } } };
    await expect(apiRequest("/categories")).rejects.toMatchObject({ code, message: "Safe message", fieldErrors: { slug: "Already used." } });
  });

  it("hides 5xx detail behind the generic message", async () => {
    const { apiRequest } = await import("@/lib/api/client");
    reply = { status: 500, body: { success: false, message: "select * from secrets failed", error: { code: "UNKNOWN", details: null } } };
    await expect(apiRequest("/categories")).rejects.toMatchObject({ code: "UNKNOWN", message: "Something went wrong. Please try again." });
  });

  it("ignores validation lists that are not per-field", async () => {
    const { toAppError } = await import("@/lib/api/client");
    const error = toAppError(400, { success: false, message: "Please check the details you entered.", error: { details: ["name must be a string"] } });
    expect(error.fieldErrors).toBeUndefined();
  });

  it("turns a network failure into the generic error", async () => {
    const { apiRequest } = await import("@/lib/api/client");
    const original = process.env.AUTH_API_URL;
    process.env.AUTH_API_URL = "http://127.0.0.1:1/api/v1";
    try {
      await expect(apiRequest("/categories", { timeoutMs: 2000 })).rejects.toMatchObject({ code: "UNKNOWN" });
    } finally {
      process.env.AUTH_API_URL = original;
    }
  });
});
