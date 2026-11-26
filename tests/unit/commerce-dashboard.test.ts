import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { can, type Actor } from "@/lib/auth/permissions";
import { AppError } from "@/lib/errors";

/**
 * The commerce dashboard (orders, payments, shipping, tax) against a local HTTP server standing in for the StoreForge API.
 * Checks that permissions are enforced BEFORE any API call, that the organization always comes from the verified membership,
 * and that forms are converted to what the API expects (money to paise, lists to arrays).
 */

const ORG = "11111111-1111-4111-8111-111111111111";
const ZONE = "33333333-3333-4333-8333-333333333333";
let membership: Actor & { tenant: { id: string } };
const as = (role: Actor["role"], permissions: Actor["permissions"] = {}) => (membership = { role, permissions, tenant: { id: ORG } });

vi.mock("@/lib/tenant/context", () => ({
  requireActiveTenant: async (permission?: Parameters<typeof can>[1]) => {
    if (permission && !can(membership, permission)) throw new AppError("FORBIDDEN", "You do not have permission to do that.");
    return membership;
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [{ name: "sb-proj-auth-token", value: SESSION }] }),
}));

const jwt = `h.${Buffer.from(JSON.stringify({ exp: 4102444800, sub: "u1" })).toString("base64url")}.s`;
const SESSION = `base64-${Buffer.from(JSON.stringify({ access_token: jwt, refresh_token: "RT", expires_at: 4102444800 })).toString("base64url")}`;

type Seen = { method?: string; url?: string; headers: IncomingMessage["headers"]; body: string };
let seen: Seen[] = [];
let server: Server;
beforeAll(async () => {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      seen.push({ method: req.method, url: req.url, headers: req.headers, body });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, data: { id: ZONE, status: "pending", valid: true, message: "ok" } }));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  process.env.API_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
  process.env.AUTH_BFF_SECRET = "s".repeat(40);
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));
beforeEach(() => {
  seen = [];
  as("owner");
});

const body = (i = 0) => JSON.parse(seen[i]!.body) as Record<string, unknown>;

describe("who may do what (mirrors the API's permission rules)", () => {
  const manager: Actor = { role: "admin", permissions: { products: "write", orders: "read", customers: "write", settings: "write" } };
  const viewer: Actor = { role: "admin", permissions: { products: "read", orders: "read", customers: "read", settings: "read" } };
  const orderWriter: Actor = { role: "admin", permissions: { orders: "write", settings: "read" } };
  const nobody: Actor = { role: "admin", permissions: {} };

  it("keeps payments and carrier accounts Owner-only", () => {
    expect(can({ role: "owner", permissions: {} }, "payments:manage")).toBe(true);
    expect(can({ role: "owner", permissions: {} }, "carriers:manage")).toBe(true);
    for (const m of [manager, viewer, orderWriter, nobody]) {
      expect(can(m, "payments:manage")).toBe(false);
      expect(can(m, "carriers:manage")).toBe(false);
    }
  });

  it("lets store-settings writers manage zones, methods and GST, and readers only look", () => {
    expect(can(manager, "shipping:manage")).toBe(true);
    expect(can(manager, "tax:manage")).toBe(true);
    expect(can(viewer, "shipping:view")).toBe(true);
    expect(can(viewer, "shipping:manage")).toBe(false);
    expect(can(viewer, "tax:manage")).toBe(false);
  });

  it("lets only orders-write members change, cancel and ship orders; the tax report follows orders", () => {
    expect(can(orderWriter, "orders:manage")).toBe(true);
    expect(can(manager, "orders:manage")).toBe(false);
    expect(can(viewer, "orders:view")).toBe(true);
    expect(can(viewer, "tax:report")).toBe(true);
    expect(can(nobody, "tax:report")).toBe(false);
  });
});

describe("services check the permission before any call, and use the verified organization", () => {
  it("never reaches the API for a member without the permission", async () => {
    as("admin", { orders: "read", settings: "read" });
    const orders = await import("@/services/order.service");
    const ledger = await import("@/services/payment-ledger.service");
    const shipping = await import("@/services/shipping.service");
    const tax = await import("@/services/tax.service");
    await expect(orders.cancelOrder(ZONE, "x")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(orders.bookShipment(ZONE, {})).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(ledger.getCodSettings()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(ledger.listTransactions({ page: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(shipping.listCarriers()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(shipping.createZone({ name: "z", areas: { country: true } })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(tax.saveTaxSettings({ enabled: false, pricesIncludeTax: false, defaultRateBps: 1800, chargesTaxable: false, chargesRateBps: 0 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(seen).toHaveLength(0);
  });

  it("sends the active organization, and lets a member read what they may", async () => {
    as("admin", { orders: "read", settings: "read" });
    const { listOrders } = await import("@/services/order.service");
    await listOrders({ page: 2, search: "asha", status: "confirmed" });
    expect(seen[0]!.headers["x-organization-id"]).toBe(ORG);
    expect(seen[0]!.url).toBe("/api/v1/orders?page=2&search=asha&status=confirmed&limit=20");
    expect(seen[0]!.headers.authorization).toMatch(/^Bearer /);
  });
});

describe("orders actions", () => {
  it("rejects a malformed order id, and an empty cancellation reason, without calling the API", async () => {
    const { cancelOrderAction, changeOrderStatusAction } = await import("@/app/(dashboard)/dashboard/orders/actions");
    expect((await cancelOrderAction("nope", { reason: "x" })).ok).toBe(false);
    expect((await cancelOrderAction(ZONE, { reason: "   " })).ok).toBe(false);
    expect((await changeOrderStatusAction(ZONE, { status: "" })).ok).toBe(false);
    expect(seen).toHaveLength(0);
  });

  it("books a shipment with the chosen carrier and parcel size", async () => {
    const { bookShipmentAction } = await import("@/app/(dashboard)/dashboard/orders/actions");
    const r = await bookShipmentAction(ZONE, { providerCode: "delhivery", weightGrams: 750, lengthCm: 20 });
    expect(r.ok).toBe(true);
    expect(seen[0]!.url).toBe(`/api/v1/orders/${ZONE}/shipments`);
    expect(body()).toEqual({ providerCode: "delhivery", weightGrams: 750, lengthCm: 20 });
    expect((await bookShipmentAction(ZONE, { providerCode: "Not A Code" })).ok).toBe(false);
  });
});

describe("refund and COD actions", () => {
  const TX = "44444444-4444-4444-8444-444444444444";
  const base = { currency: "INR", reason: "Item damaged", idempotencyKey: "refund-key-1234" };

  it("converts a partial refund to paise and sends the idempotency key", async () => {
    const { refundAction } = await import("@/app/(dashboard)/dashboard/payments/ledger-actions");
    expect((await refundAction(TX, { ...base, full: false, amount: "125.50" })).ok).toBe(true);
    expect(seen[0]!.url).toBe(`/api/v1/payments/transactions/${TX}/refunds`);
    expect(seen[0]!.headers["idempotency-key"]).toBe("refund-key-1234");
    expect(body()).toEqual({ amountMinor: 12550, reason: "Item damaged" });
  });

  it("omits the amount for a full refund, and refuses a zero, malformed or reason-less one", async () => {
    const { refundAction } = await import("@/app/(dashboard)/dashboard/payments/ledger-actions");
    expect((await refundAction(TX, { ...base, full: true, amount: "" })).ok).toBe(true);
    expect(body()).toEqual({ reason: "Item damaged" });
    seen = [];
    expect((await refundAction(TX, { ...base, full: false, amount: "0" })).ok).toBe(false);
    expect((await refundAction(TX, { ...base, full: false, amount: "12.345" })).ok).toBe(false);
    expect((await refundAction(TX, { ...base, full: false, amount: "abc" })).ok).toBe(false);
    expect((await refundAction(TX, { ...base, full: true, amount: "", reason: " " })).ok).toBe(false);
    expect((await refundAction(TX, { ...base, full: true, amount: "", idempotencyKey: "short" })).ok).toBe(false);
    expect(seen).toHaveLength(0);
  });

  it("saves COD rules in paise and refuses a maximum below the minimum", async () => {
    const { saveCodSettingsAction } = await import("@/app/(dashboard)/dashboard/payments/ledger-actions");
    expect((await saveCodSettingsAction({ enabled: true, min: "500", max: "20000", fee: "49", currency: "INR" })).ok).toBe(true);
    expect(body()).toEqual({ enabled: true, minOrderMinor: 50000, maxOrderMinor: 2000000, feeMinor: 4900 });
    seen = [];
    expect((await saveCodSettingsAction({ enabled: true, min: "500", max: "100", fee: "0", currency: "INR" })).ok).toBe(false);
    expect((await saveCodSettingsAction({ enabled: true, min: "x", max: "", fee: "0", currency: "INR" })).ok).toBe(false);
    expect(seen).toHaveLength(0);
  });

  it("allows no maximum", async () => {
    const { saveCodSettingsAction } = await import("@/app/(dashboard)/dashboard/payments/ledger-actions");
    await saveCodSettingsAction({ enabled: false, min: "", max: "", fee: "", currency: "INR" });
    expect(body()).toEqual({ enabled: false, minOrderMinor: 0, maxOrderMinor: null, feeMinor: 0 });
  });
});

describe("shipping actions", () => {
  const zone = { name: "South", enabled: true, codAllowed: true, country: false, states: ["Karnataka"], cities: "Mysuru, Karnataka\nPune, Maharashtra", postalCodes: "560001, 560002\n560003", postalRanges: "560010-560099" };

  it("turns the zone form into the API's areas", async () => {
    const { saveZoneAction } = await import("@/app/(dashboard)/dashboard/shipping/actions");
    expect((await saveZoneAction(null, zone)).ok).toBe(true);
    expect(seen[0]!.method).toBe("POST");
    expect(body()).toEqual({
      name: "South",
      enabled: true,
      codAllowed: true,
      areas: { states: ["Karnataka"], cities: [{ city: "Mysuru", state: "Karnataka" }, { city: "Pune", state: "Maharashtra" }], postalCodes: ["560001", "560002", "560003"], postalRanges: [{ from: "560010", to: "560099" }] },
    });
  });

  it("updates an existing zone with PUT, and refuses malformed cities and ranges", async () => {
    const { saveZoneAction } = await import("@/app/(dashboard)/dashboard/shipping/actions");
    await saveZoneAction(ZONE, zone);
    expect(seen[0]!.method).toBe("PUT");
    expect(seen[0]!.url).toBe(`/api/v1/shipping/zones/${ZONE}`);
    seen = [];
    const badCity = await saveZoneAction(null, { ...zone, cities: "Mysuru" });
    const badRange = await saveZoneAction(null, { ...zone, postalRanges: "56-99" });
    expect(badCity.ok).toBe(false);
    expect(badRange.ok).toBe(false);
    expect(seen).toHaveLength(0);
  });

  const method = { zoneId: ZONE, name: "Standard", kind: "standard", pricingType: "flat", currency: "INR", flatRate: "49", freeOver: "999", handling: "", minOrder: "", maxOrder: "", minWeight: "", maxWeight: "", daysMin: "3", daysMax: "5", codAllowed: true, carrierCode: "", sortOrder: "1", enabled: true, tiers: [] };

  it("converts a flat-rate method to paise and delivery days to numbers", async () => {
    const { saveMethodAction } = await import("@/app/(dashboard)/dashboard/shipping/actions");
    expect((await saveMethodAction(null, method)).ok).toBe(true);
    expect(body()).toMatchObject({ zoneId: ZONE, pricingType: "flat", flatRateMinor: 4900, freeOverMinor: 99900, estimatedDaysMin: 3, estimatedDaysMax: 5, sortOrder: 1, minOrderMinor: 0, maxOrderMinor: null });
    expect(body()).not.toHaveProperty("tiers", expect.anything());
  });

  it("converts weight bands (grams) and order-value bands (money)", async () => {
    const { saveMethodAction } = await import("@/app/(dashboard)/dashboard/shipping/actions");
    await saveMethodAction(null, { ...method, pricingType: "weight", flatRate: "", tiers: [{ from: "0", to: "500", rate: "40" }, { from: "500", to: "", rate: "90.50" }] });
    expect(body().tiers).toEqual([{ from: 0, to: 500, rateMinor: 4000 }, { from: 500, to: null, rateMinor: 9050 }]);
    await saveMethodAction(null, { ...method, pricingType: "order_value", flatRate: "", tiers: [{ from: "0", to: "1000", rate: "60" }, { from: "1000", to: "", rate: "0" }] });
    expect(body(1).tiers).toEqual([{ from: 0, to: 100000, rateMinor: 6000 }, { from: 100000, to: null, rateMinor: 0 }]);
  });

  it("asks for both delivery days or neither, and a price for a flat method", async () => {
    const { saveMethodAction } = await import("@/app/(dashboard)/dashboard/shipping/actions");
    expect((await saveMethodAction(null, { ...method, daysMax: "" })).ok).toBe(false);
    expect((await saveMethodAction(null, { ...method, flatRate: "" })).ok).toBe(false);
    expect((await saveMethodAction(null, { ...method, flatRate: "free" })).ok).toBe(false);
    expect((await saveMethodAction(null, { ...method, zoneId: "nope" })).ok).toBe(false);
    expect(seen).toHaveLength(0);
  });

  it("sends only typed carrier fields, never echoes secrets, and checks the carrier code", async () => {
    const { saveCarrierAction, testCarrierAction } = await import("@/app/(dashboard)/dashboard/shipping/actions");
    const saved = await saveCarrierAction("delhivery", { apiToken: "super-secret-token" });
    expect(saved.ok).toBe(true);
    expect(JSON.stringify(saved)).not.toContain("super-secret-token");
    expect(body()).toEqual({ values: { apiToken: "super-secret-token" } });
    expect((await saveCarrierAction("../x", {})).ok).toBe(false);
    expect((await testCarrierAction("Bad Code")).ok).toBe(false);
    expect(seen).toHaveLength(1);
  });

  it("only offers the three selection strategies", async () => {
    const { savePreferencesAction } = await import("@/app/(dashboard)/dashboard/shipping/actions");
    expect((await savePreferencesAction({ selectionMode: "automatic", strategy: "fastest" })).ok).toBe(true);
    expect((await savePreferencesAction({ selectionMode: "automatic", strategy: "cheapest-ish" })).ok).toBe(false);
    expect(seen).toHaveLength(1);
  });
});

describe("tax settings action", () => {
  const ok = { enabled: true, gstin: "27AAPFU0939F1ZV", legalName: "Acme Traders", pricesIncludeTax: true, defaultRateBps: 1800, chargesTaxable: true, chargesRateBps: 1800 };

  it("saves valid GST settings", async () => {
    const { saveTaxSettingsAction } = await import("@/app/(dashboard)/dashboard/taxes/actions");
    expect((await saveTaxSettingsAction({ ...ok, gstin: "27aapfu0939f1zv" })).ok).toBe(true);
    expect(body()).toMatchObject({ enabled: true, gstin: "27AAPFU0939F1ZV", pricesIncludeTax: true, defaultRateBps: 1800 });
  });

  it("refuses a malformed GSTIN, charging tax with no GSTIN, and a rate that is not a GST slab", async () => {
    const { saveTaxSettingsAction } = await import("@/app/(dashboard)/dashboard/taxes/actions");
    expect((await saveTaxSettingsAction({ ...ok, gstin: "NOTAGSTIN" })).ok).toBe(false);
    expect((await saveTaxSettingsAction({ ...ok, gstin: "" })).ok).toBe(false);
    expect((await saveTaxSettingsAction({ ...ok, defaultRateBps: 1500 })).ok).toBe(false);
    expect(seen).toHaveLength(0);
  });

  it("lets GST be switched off with no GSTIN", async () => {
    const { saveTaxSettingsAction } = await import("@/app/(dashboard)/dashboard/taxes/actions");
    expect((await saveTaxSettingsAction({ ...ok, enabled: false, gstin: "" })).ok).toBe(true);
    expect(body()).toMatchObject({ enabled: false, gstin: null });
  });
});
