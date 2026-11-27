import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The storefront checkout server actions against a local HTTP server standing in for the StoreForge API. Browsing, pricing and the
 * order-token reads are anonymous (no owner/staff session is ever read); placing an order sends the shopper's own account session
 * from its HttpOnly cookie. The order token and the idempotency key travel as headers, and bad input never reaches the API.
 */

const SHOPPER = "S".repeat(43);
const cookiesRead = vi.fn();
const shopperCookie = vi.fn<() => string | undefined>(() => SHOPPER);
vi.mock("next/headers", () => ({
  cookies: async () => (
    cookiesRead(),
    {
      getAll: () => [],
      get: (name: string) => (name === "sf_cust_acme_store" && shopperCookie() ? { name, value: shopperCookie()! } : undefined),
      delete: vi.fn(),
    }
  ),
}));

type Seen = { method?: string; url?: string; headers: IncomingMessage["headers"]; body: string };
let seen: Seen[] = [];
let reply: { status: number; body: unknown } = { status: 200, body: { success: true, data: {} } };
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
  process.env.API_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
  process.env.AUTH_BFF_SECRET = "s".repeat(40);
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));
beforeEach(() => {
  seen = [];
  cookiesRead.mockClear();
  shopperCookie.mockImplementation(() => SHOPPER);
  reply = { status: 200, body: { success: true, data: {} } };
});

const VARIANT = "22222222-2222-4222-8222-222222222222";
const address = { fullName: "Asha Rao", phone: "9876543210", line1: "12 MG Road", city: "Bengaluru", state: "Karnataka", postalCode: "560001" };
const order = (over: Record<string, unknown> = {}) => ({
  storeSlug: "acme-store",
  idempotencyKey: "key-12345678",
  lines: [{ productSlug: "mug", variantId: null, quantity: 2, expectedUnitPriceMinor: 49900 }],
  customer: { fullName: "Asha Rao", email: "asha@example.com", phone: "9876543210" },
  shippingAddress: address,
  billingSameAsShipping: true,
  paymentMethod: "cod",
  ...over,
});

describe("placeOrderAction", () => {
  it("sends the cart with the idempotency key and the shopper's session, never an owner token and never the browser's idea of a total", async () => {
    reply = { status: 201, body: { success: true, data: { orderNumber: 1001, accessToken: "tok".repeat(12) } } };
    const { placeOrderAction } = await import("@/app/s/[slug]/checkout/actions");
    const result = await placeOrderAction(order({ shippingMethodId: VARIANT }));
    expect(result.ok).toBe(true);
    expect(seen).toHaveLength(1);
    expect(seen[0]!.method).toBe("POST");
    expect(seen[0]!.url).toBe("/api/v1/public/stores/acme-store/orders");
    expect(seen[0]!.headers["idempotency-key"]).toBe("key-12345678");
    expect(seen[0]!.headers.authorization).toBeUndefined();
    expect(seen[0]!.headers["x-customer-session"]).toBe(SHOPPER);
    const body = JSON.parse(seen[0]!.body) as Record<string, unknown>;
    expect(body).not.toHaveProperty("totalMinor");
    expect(body).not.toHaveProperty("idempotencyKey");
    expect(body.shippingMethodId).toBe(VARIANT);
    expect(body.billingAddress).toBeUndefined();
  });

  it("rejects an invalid PIN code, state and phone before calling the API", async () => {
    const { placeOrderAction } = await import("@/app/s/[slug]/checkout/actions");
    const result = await placeOrderAction(order({ shippingAddress: { ...address, postalCode: "12345", state: "Atlantis", phone: "123" } }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors).toMatchObject({ "shippingAddress.postalCode": expect.any(String), "shippingAddress.state": expect.any(String), "shippingAddress.phone": expect.any(String) });
    }
    expect(seen).toHaveLength(0);
  });

  it("needs a billing address when it is not the same as shipping", async () => {
    const { placeOrderAction } = await import("@/app/s/[slug]/checkout/actions");
    const result = await placeOrderAction(order({ billingSameAsShipping: false }));
    expect(result.ok).toBe(false);
    expect(seen).toHaveLength(0);
  });

  it("only offers Razorpay and cash on delivery", async () => {
    const { placeOrderAction } = await import("@/app/s/[slug]/checkout/actions");
    for (const paymentMethod of ["stripe", "paypal", ""]) expect((await placeOrderAction(order({ paymentMethod }))).ok).toBe(false);
    expect(seen).toHaveLength(0);
  });

  it("rejects a weak idempotency key and an empty bag", async () => {
    const { placeOrderAction } = await import("@/app/s/[slug]/checkout/actions");
    expect((await placeOrderAction(order({ idempotencyKey: "x" }))).ok).toBe(false);
    expect((await placeOrderAction(order({ lines: [] }))).ok).toBe(false);
    expect(seen).toHaveLength(0);
  });

  it("hands the per-item problems of a 409 CHECKOUT_ISSUES back to the page", async () => {
    reply = { status: 409, body: { success: false, message: "Some items in your cart need attention.", error: { code: "CHECKOUT_ISSUES", details: { issues: [{ code: "OUT_OF_STOCK", productSlug: "mug", variantId: null, available: 1 }] } } } };
    const { placeOrderAction } = await import("@/app/s/[slug]/checkout/actions");
    const result = await placeOrderAction(order());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.details).toEqual({ issues: [{ code: "OUT_OF_STOCK", productSlug: "mug", variantId: null, available: 1 }] });
  });
});

describe("placing an order needs a signed-in shopper", () => {
  it("asks to sign in, without calling the API, when there is no shopper session", async () => {
    shopperCookie.mockImplementation(() => undefined);
    const { placeOrderAction } = await import("@/app/s/[slug]/checkout/actions");
    const result = await placeOrderAction(order());
    expect(result).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
    expect(seen).toHaveLength(0);
  });

  it("asks to sign in again when the API no longer accepts the session", async () => {
    reply = { status: 401, body: { success: false, message: "Sign in to continue.", error: { code: "CUSTOMER_LOGIN_REQUIRED" } } };
    const { placeOrderAction } = await import("@/app/s/[slug]/checkout/actions");
    const result = await placeOrderAction(order());
    expect(result).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
    expect(seen).toHaveLength(1);
  });
});

describe("order token actions", () => {
  const token = "t".repeat(32);

  it("sends the order token as a header, never in the URL or the body", async () => {
    const { getOrderAction, cancelOrderAction, startRazorpayAction } = await import("@/app/s/[slug]/checkout/actions");
    await getOrderAction({ storeSlug: "acme-store", orderNumber: 1001, token });
    await cancelOrderAction({ storeSlug: "acme-store", orderNumber: 1001, token });
    await startRazorpayAction({ storeSlug: "acme-store", orderNumber: 1001, token });
    expect(seen.map((s) => s.url)).toEqual(["/api/v1/public/stores/acme-store/orders/1001", "/api/v1/public/stores/acme-store/orders/1001/cancel", "/api/v1/public/stores/acme-store/orders/1001/payments/razorpay"]);
    for (const s of seen) {
      expect(s.headers["x-order-token"]).toBe(token);
      expect(s.url).not.toContain(token);
      expect(s.body).not.toContain(token);
    }
  });

  it("refuses a missing or malformed token without calling the API", async () => {
    const { getOrderAction } = await import("@/app/s/[slug]/checkout/actions");
    expect((await getOrderAction({ storeSlug: "acme-store", orderNumber: 1001, token: "short" })).ok).toBe(false);
    expect((await getOrderAction({ storeSlug: "acme-store", orderNumber: 0, token })).ok).toBe(false);
    expect((await getOrderAction({ storeSlug: "../other", orderNumber: 1, token })).ok).toBe(false);
    expect(seen).toHaveLength(0);
  });

  it("shows an unknown order and a wrong token the same way", async () => {
    reply = { status: 404, body: { success: false, message: "We could not find that order.", error: { code: "NOT_FOUND" } } };
    const { getOrderAction } = await import("@/app/s/[slug]/checkout/actions");
    const result = await getOrderAction({ storeSlug: "acme-store", orderNumber: 1001, token });
    expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });
});

describe("Razorpay confirmation", () => {
  const token = "t".repeat(32);
  const good = { storeSlug: "acme-store", orderNumber: 1001, token, razorpay_order_id: "order_Abc12345678", razorpay_payment_id: "pay_Abc12345678", razorpay_signature: "a".repeat(64) };

  it("forwards the three Razorpay values for the server to verify", async () => {
    const { verifyRazorpayAction } = await import("@/app/s/[slug]/checkout/actions");
    expect((await verifyRazorpayAction(good)).ok).toBe(true);
    expect(JSON.parse(seen[0]!.body)).toEqual({ razorpay_order_id: "order_Abc12345678", razorpay_payment_id: "pay_Abc12345678", razorpay_signature: "a".repeat(64) });
    expect(seen[0]!.url).toBe("/api/v1/public/stores/acme-store/orders/1001/payments/razorpay/verify");
  });

  it("rejects a malformed signature or ids before calling the API", async () => {
    const { verifyRazorpayAction, reportRazorpayFailureAction } = await import("@/app/s/[slug]/checkout/actions");
    expect((await verifyRazorpayAction({ ...good, razorpay_signature: "nothex" })).ok).toBe(false);
    expect((await verifyRazorpayAction({ ...good, razorpay_order_id: "x" })).ok).toBe(false);
    expect((await reportRazorpayFailureAction({ ...good, razorpay_payment_id: "../" })).ok).toBe(false);
    expect(seen).toHaveLength(0);
  });
});

describe("price actions", () => {
  it("asks the API for delivery options and the full quote, passing the chosen option and payment method", async () => {
    const { shippingOptionsAction, quoteAction, paymentOptionsAction } = await import("@/app/s/[slug]/checkout/actions");
    const input = { storeSlug: "acme-store", lines: [{ productSlug: "mug", variantId: null, quantity: 1 }], address: { state: "Karnataka", city: "Bengaluru", postalCode: "560001" }, paymentMethod: "cod" as const };
    await shippingOptionsAction(input);
    await quoteAction({ ...input, shippingMethodId: VARIANT });
    await paymentOptionsAction({ storeSlug: "acme-store", subtotalMinor: 49900 });
    expect(seen.map((s) => s.url)).toEqual(["/api/v1/public/stores/acme-store/shipping/options", "/api/v1/public/stores/acme-store/checkout/quote", "/api/v1/public/stores/acme-store/payment-methods?subtotalMinor=49900"]);
    expect(JSON.parse(seen[1]!.body)).toMatchObject({ shippingMethodId: VARIANT, paymentMethod: "cod" });
  });

  it("does not call the API for an address with no valid PIN code", async () => {
    const { shippingOptionsAction } = await import("@/app/s/[slug]/checkout/actions");
    const result = await shippingOptionsAction({ storeSlug: "acme-store", lines: [{ productSlug: "mug", variantId: null, quantity: 1 }], address: { state: "Karnataka", postalCode: "56" } });
    expect(result.ok).toBe(false);
    expect(seen).toHaveLength(0);
  });
});

describe("apiRequest extra headers", () => {
  it("never lets a caller override the Authorization header", async () => {
    const { apiRequest } = await import("@/lib/api/client");
    await apiRequest("/public/ping", { anonymous: true, headers: { Authorization: "Bearer attacker", "X-Order-Token": "abc" } });
    expect(seen[0]!.headers.authorization).toBeUndefined();
    expect(seen[0]!.headers["x-order-token"]).toBe("abc");
  });
});
