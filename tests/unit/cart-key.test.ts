import { describe, expect, it } from "vitest";
import { cartKeyStorageKey, clearCartKey, getCartKey, newCartKey, prefillKey, savePrefill, takePrefill } from "../../lib/checkout/cart-key";
import { cartKeySchema, discountCodeSchema, placeOrderSchema } from "../../lib/validations/checkout";

const storage = () => {
  const data = new Map<string, string>();
  return { data, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) };
};

describe("the browser's cart id", () => {
  it("is 32 URL-safe characters that the API accepts, and different every time", () => {
    const a = newCartKey();
    expect(a).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(cartKeySchema.safeParse(a).success).toBe(true);
    expect(newCartKey()).not.toBe(a);
  });

  it("is created once per store and then kept", () => {
    const s = storage();
    const first = getCartKey("alpha", s);
    expect(getCartKey("alpha", s)).toBe(first);
    expect(getCartKey("beta", s)).not.toBe(first);
    expect(s.data.get(cartKeyStorageKey("alpha"))).toBe(first);
  });

  it("replaces a damaged saved value instead of sending it on", () => {
    const s = storage();
    s.data.set(cartKeyStorageKey("alpha"), "short");
    const key = getCartKey("alpha", s);
    expect(key).not.toBe("short");
    expect(key).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });

  it("starts a new cart after an order, and still works when storage is blocked", () => {
    const s = storage();
    const first = getCartKey("alpha", s);
    clearCartKey("alpha", s);
    expect(getCartKey("alpha", s)).not.toBe(first);
    const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => { throw new Error("blocked"); } };
    const k = getCartKey("gamma", blocked);
    expect(getCartKey("gamma", blocked)).toBe(k);
    expect(() => clearCartKey("gamma", blocked)).not.toThrow();
    expect(getCartKey("gamma", null)).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });
});

describe("what a recovery link leaves for the checkout", () => {
  it("is read once and forgotten", () => {
    const s = storage();
    savePrefill("alpha", { email: "asha@example.com", fullName: "Asha" }, s);
    expect(takePrefill("alpha", s)).toEqual({ email: "asha@example.com", fullName: "Asha" });
    expect(takePrefill("alpha", s)).toBeNull();
    expect(s.data.has(prefillKey("alpha"))).toBe(false);
  });

  it("ignores anything that is not the expected shape", () => {
    const s = storage();
    for (const raw of ["not json", "null", "5", JSON.stringify({ email: 5, fullName: ["x"] }), JSON.stringify({ email: "a".repeat(300) })]) {
      s.data.set(prefillKey("alpha"), raw);
      const got = takePrefill("alpha", s);
      expect(got === null || (got.email === null && got.fullName === null)).toBe(true);
    }
  });

  it("is per store", () => {
    const s = storage();
    savePrefill("alpha", { email: "a@example.com", fullName: null }, s);
    expect(takePrefill("beta", s)).toBeNull();
  });
});

describe("discount codes and cart ids in the order", () => {
  it("upper-cases a code and refuses anything that is not one", () => {
    expect(discountCodeSchema.parse(" welcome10 ")).toBe("WELCOME10");
    for (const bad of ["", "ab", "has space", "<script>", "a".repeat(40), "-DASH"]) expect(discountCodeSchema.safeParse(bad).success).toBe(false);
  });

  it("allows both to be left out of an order", () => {
    const base = {
      storeSlug: "alpha",
      idempotencyKey: "abcdefgh12345678",
      lines: [{ productSlug: "mug", variantId: null, quantity: 1 }],
      customer: { fullName: "Asha Rao", email: "asha@example.com", phone: "9876543210" },
      shippingAddress: { fullName: "Asha Rao", phone: "9876543210", line1: "12 MG Road", city: "Bengaluru", state: "Karnataka", postalCode: "560001" },
      billingSameAsShipping: true,
      paymentMethod: "cod",
    };
    expect(placeOrderSchema.safeParse(base).success).toBe(true);
    const withBoth = placeOrderSchema.parse({ ...base, discountCode: "save10", cartKey: newCartKey() });
    expect(withBoth.discountCode).toBe("SAVE10");
    expect(placeOrderSchema.safeParse({ ...base, discountCode: "no spaces allowed" }).success).toBe(false);
    expect(placeOrderSchema.safeParse({ ...base, cartKey: "short" }).success).toBe(false);
  });
});
