import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The shopper account on the frontend: the session cookie is HttpOnly and per store, sign-in goes through the API, and the
 * checkout cannot place an order without a signed-in shopper. The API is mocked at the endpoint layer; the real rules (who
 * may see which order) are tested against the real API in store-forge-api (customer-accounts.e2e-spec).
 */

const TOKEN = "A".repeat(43);
const jar = new Map<string, { value: string; options?: Record<string, unknown> }>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (n: string) => (jar.has(n) ? { name: n, value: jar.get(n)!.value } : undefined),
    set: (n: string, value: string, options?: Record<string, unknown>) => void jar.set(n, { value, options }),
    delete: (n: string) => void jar.delete(n),
  }),
}));

const api = {
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  orders: vi.fn(),
  order: vi.fn(),
  profile: vi.fn(),
  addresses: vi.fn(),
};
vi.mock("@/lib/api/endpoints/customer-account-api", () => ({
  loginCustomerApi: (...a: unknown[]) => api.login(...a),
  registerCustomerApi: (...a: unknown[]) => api.register(...a),
  logoutCustomerApi: (...a: unknown[]) => api.logout(...a),
  listCustomerOrdersApi: (...a: unknown[]) => api.orders(...a),
  getCustomerOrderApi: (...a: unknown[]) => api.order(...a),
  getCustomerProfileApi: (...a: unknown[]) => api.profile(...a),
  listCustomerAddressesApi: (...a: unknown[]) => api.addresses(...a),
  addCustomerAddressApi: vi.fn(),
  updateCustomerAddressApi: vi.fn(),
  deleteCustomerAddressApi: vi.fn(),
  updateCustomerProfileApi: vi.fn(),
  changeCustomerPasswordApi: vi.fn(),
  cancelCustomerOrderApi: vi.fn(),
}));
const placeOrder = vi.fn();
vi.mock("@/lib/api/endpoints/checkout-api", () => ({
  placeOrderApi: (...a: unknown[]) => placeOrder(...a),
  cancelPublicOrderApi: vi.fn(),
  getPaymentOptionsApi: vi.fn(),
  getPublicOrderApi: vi.fn(),
  getQuoteApi: vi.fn(),
  getShippingOptionsApi: vi.fn(),
  reportRazorpayFailureApi: vi.fn(),
  startRazorpayApi: vi.fn(),
  validateDiscountApi: vi.fn(),
  verifyRazorpayApi: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  jar.clear();
});

describe("session cookie", () => {
  it("is HttpOnly, SameSite=Lax, named per store, and only a token-shaped value is ever read back", async () => {
    const { writeCustomerSession, readCustomerToken, customerCookieName, clearCustomerSession } = await import("@/lib/customer/session");
    await writeCustomerSession("urban-shop", TOKEN, "2030-01-01T00:00:00.000Z");
    const saved = jar.get(customerCookieName("urban-shop"))!;
    expect(saved.options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
    expect(customerCookieName("urban-shop")).not.toBe(customerCookieName("other-shop"));
    expect(customerCookieName("urban-shop")).not.toMatch(/^sb-/);
    expect(await readCustomerToken("urban-shop")).toBe(TOKEN);
    expect(await readCustomerToken("other-shop")).toBeUndefined();
    jar.set(customerCookieName("urban-shop"), { value: "not a token" });
    expect(await readCustomerToken("urban-shop")).toBeUndefined();
    await clearCustomerSession("urban-shop");
    expect(jar.size).toBe(0);
  });

  it("only returns to a fixed set of storefront pages after sign-in", async () => {
    const { safeNext } = await import("@/lib/customer/session");
    for (const ok of ["/checkout", "/cart", "/account", "/account/orders", "/account/orders/1042", "/account/addresses"]) expect(safeNext(ok)).toBe(ok);
    for (const bad of ["https://evil.test", "//evil.test", "/dashboard", "/login", "/account/../dashboard", "/account/orders/abc", "javascript:alert(1)", "/checkout?x=1", undefined, ""]) expect(safeNext(bad)).toBe("/account");
    expect(safeNext(["/cart", "/x"])).toBe("/cart");
  });
});

describe("sign in and sign up actions", () => {
  it("store the API's session in the cookie and return only the profile (never the token)", async () => {
    const { loginCustomerAction } = await import("@/app/s/[slug]/account/actions");
    api.login.mockResolvedValue({ sessionToken: TOKEN, expiresAt: "2030-01-01T00:00:00.000Z", profile: { fullName: "Asha", email: "asha@example.test", phone: null } });
    const res = await loginCustomerAction({ storeSlug: "urban-shop", email: "asha@example.test", password: "Shopper123" });
    expect(res).toEqual({ ok: true, data: { fullName: "Asha", email: "asha@example.test", phone: null } });
    expect(JSON.stringify(res)).not.toContain(TOKEN);
    expect(jar.get("sf_cust_urban_shop")?.value).toBe(TOKEN);
  });

  it("validate the password rule before calling the API", async () => {
    const { registerCustomerAction } = await import("@/app/s/[slug]/account/actions");
    const res = await registerCustomerAction({ storeSlug: "urban-shop", fullName: "Asha", email: "asha@example.test", password: "short" });
    expect(res.ok).toBe(false);
    expect(api.register).not.toHaveBeenCalled();
  });

  it("sign out clears the cookie even when the API cannot be reached", async () => {
    const { logoutCustomerAction } = await import("@/app/s/[slug]/account/actions");
    jar.set("sf_cust_urban_shop", { value: TOKEN });
    api.logout.mockRejectedValue(new Error("down"));
    expect((await logoutCustomerAction({ storeSlug: "urban-shop" })).ok).toBe(true);
    expect(jar.has("sf_cust_urban_shop")).toBe(false);
  });
});

describe("account reads", () => {
  it("send the cookie's token, never one supplied by the browser, and ask for sign-in without a cookie", async () => {
    const { listOrdersAction, getAccountOrderAction } = await import("@/app/s/[slug]/account/actions");
    const none = await listOrdersAction({ storeSlug: "urban-shop", page: 1 });
    expect(none).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
    expect(api.orders).not.toHaveBeenCalled();

    jar.set("sf_cust_urban_shop", { value: TOKEN });
    api.order.mockResolvedValue({ orderNumber: 7 });
    await getAccountOrderAction({ storeSlug: "urban-shop", orderNumber: 7, token: "attacker-supplied", customerId: "someone-else" });
    expect(api.order).toHaveBeenCalledWith("urban-shop", TOKEN, 7);
  });

  it("drop a session the API no longer accepts, so the next page asks to sign in", async () => {
    const { AppError } = await import("@/lib/errors");
    const { listOrdersAction } = await import("@/app/s/[slug]/account/actions");
    jar.set("sf_cust_urban_shop", { value: TOKEN });
    api.orders.mockRejectedValue(new AppError("UNAUTHENTICATED", "Sign in to continue.", undefined, "CUSTOMER_LOGIN_REQUIRED"));
    expect(await listOrdersAction({ storeSlug: "urban-shop", page: 1 })).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
    expect(jar.has("sf_cust_urban_shop")).toBe(false);
  });

  it("report 'not signed in' to the checkout as a normal answer", async () => {
    const { checkoutAccountAction } = await import("@/app/s/[slug]/account/actions");
    expect(await checkoutAccountAction({ storeSlug: "urban-shop" })).toEqual({ ok: true, data: { signedIn: false } });
    jar.set("sf_cust_urban_shop", { value: TOKEN });
    api.profile.mockResolvedValue({ fullName: "Asha", email: "a@b.co", phone: null });
    api.addresses.mockResolvedValue([]);
    expect(await checkoutAccountAction({ storeSlug: "urban-shop" })).toMatchObject({ ok: true, data: { signedIn: true } });
  });
});

describe("checkout needs an account", () => {
  const order = {
    storeSlug: "urban-shop",
    idempotencyKey: "key-12345678",
    lines: [{ productSlug: "mug", variantId: null, quantity: 1 }],
    customer: { fullName: "Asha Rao", email: "asha@example.test", phone: "9876543210" },
    shippingAddress: { fullName: "Asha Rao", phone: "9876543210", line1: "12 MG Road", city: "Bengaluru", state: "Karnataka", postalCode: "560001" },
    billingSameAsShipping: true,
    paymentMethod: "cod",
  };

  it("refuses to place an order without a signed-in shopper, and never calls the API", async () => {
    const { placeOrderAction } = await import("@/app/s/[slug]/checkout/actions");
    const res = await placeOrderAction(order);
    expect(res).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
    expect(placeOrder).not.toHaveBeenCalled();
  });

  it("sends the cookie's session with the order", async () => {
    const { placeOrderAction } = await import("@/app/s/[slug]/checkout/actions");
    jar.set("sf_cust_urban_shop", { value: TOKEN });
    placeOrder.mockResolvedValue({ orderNumber: 1001 });
    expect((await placeOrderAction(order)).ok).toBe(true);
    expect(placeOrder).toHaveBeenCalledWith("urban-shop", expect.objectContaining({ paymentMethod: "cod" }), "key-12345678", TOKEN);
  });
});
