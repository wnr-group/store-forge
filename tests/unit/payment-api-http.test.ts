import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/** The payments API client against a local HTTP server standing in for the StoreForge API. Only `cookies()` is replaced. */

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [...jar].map(([name, value]) => ({ name, value })) }),
}));

const jwt = `h.${Buffer.from(JSON.stringify({ exp: 4102444800, sub: "u1" })).toString("base64url")}.s`;
const sessionCookie = `base64-${Buffer.from(JSON.stringify({ access_token: jwt, refresh_token: "RT", expires_at: 4102444800 })).toString("base64url")}`;

type Seen = { method?: string; url?: string; headers: IncomingMessage["headers"]; body: string };
let seen: Seen[] = [];
let reply: { status: number; body: unknown } = { status: 200, body: { success: true, data: { configured: false } } };
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
  process.env.API_BASE_URL = `http://127.0.0.1:${port}/api/v1`;
  process.env.AUTH_BFF_SECRET = "s".repeat(40);
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));
beforeEach(() => {
  seen = [];
  jar.clear();
  jar.set("sb-proj-auth-token", sessionCookie);
  reply = { status: 200, body: { success: true, data: { configured: false } } };
});

const ORG = "11111111-1111-4111-8111-111111111111";
const PAIR = { keyId: "rzp_test_AbCdEfGh12345678", keySecret: "SYNTHa1b2c3d4e5f6a7b8" };

describe("payments API client over HTTP [layer:FE]", () => {
  it("AC-FE-05: X-Organization-Id is sent on GET, PUT and DELETE, with the bearer token and the exact contract", async () => {
    const { getPaymentConfigApi, removePaymentConfigApi, savePaymentConfigApi } = await import("@/lib/api/endpoints/payment-api");
    await getPaymentConfigApi(ORG);
    await savePaymentConfigApi(ORG, PAIR);
    await removePaymentConfigApi(ORG);
    expect(seen.map((s) => `${s.method} ${s.url}`)).toEqual(["GET /api/v1/payments/razorpay", "PUT /api/v1/payments/razorpay", "DELETE /api/v1/payments/razorpay"]);
    for (const s of seen) {
      expect(s.headers["x-organization-id"]).toBe(ORG);
      expect(s.headers.authorization).toBe(`Bearer ${jwt}`);
    }
    // The body is exactly the two fields; the URL never carries a tenant id; GET and DELETE send no body.
    expect(JSON.parse(seen[1].body)).toEqual(PAIR);
    expect(Object.keys(JSON.parse(seen[1].body)).sort()).toEqual(["keyId", "keySecret"]);
    expect(seen[0].body).toBe("");
    expect(seen[2].body).toBe("");
    expect(seen.map((s) => s.url).join(" ")).not.toContain(ORG);
  });

  it("returns the status shapes untouched", async () => {
    const { getPaymentConfigApi } = await import("@/lib/api/endpoints/payment-api");
    reply = { status: 200, body: { success: true, data: { configured: true, keyIdMasked: "rzp_test_••••5678", mode: "test", updatedAt: "2026-11-19T12:45:00.000Z", updatedByName: null } } };
    await expect(getPaymentConfigApi(ORG)).resolves.toEqual({ configured: true, keyIdMasked: "rzp_test_••••5678", mode: "test", updatedAt: "2026-11-19T12:45:00.000Z", updatedByName: null });
  });

  it("keeps the API's machine code on a 503 while hiding its text (the service maps it to the Owner message)", async () => {
    const { savePaymentConfigApi } = await import("@/lib/api/endpoints/payment-api");
    reply = { status: 503, body: { success: false, message: "Payment settings are temporarily unavailable. Please contact support.", error: { code: "PAYMENTS_UNAVAILABLE", details: null } } };
    await expect(savePaymentConfigApi(ORG, PAIR)).rejects.toMatchObject({ code: "UNKNOWN", apiCode: "PAYMENTS_UNAVAILABLE", message: "Something went wrong. Please try again." });
  });

  it("maps 429 and 403 like every other API call, and never leaks the submitted secret into an error", async () => {
    const { savePaymentConfigApi } = await import("@/lib/api/endpoints/payment-api");
    reply = { status: 429, body: { success: false, message: "Too many requests. Please wait a moment and try again.", error: { code: "TOO_MANY_REQUESTS" } } };
    await expect(savePaymentConfigApi(ORG, PAIR)).rejects.toMatchObject({ code: "RATE_LIMITED" });
    reply = { status: 403, body: { success: false, message: "You do not have access to this workspace.", error: { code: "ORGANIZATION_ACCESS_DENIED" } } };
    const error = await savePaymentConfigApi(ORG, PAIR).catch((e: Error) => e);
    expect(error).toMatchObject({ code: "FORBIDDEN" });
    expect(JSON.stringify({ message: (error as Error).message, stack: (error as Error).stack ?? "" })).not.toContain(PAIR.keySecret);
  });
});
