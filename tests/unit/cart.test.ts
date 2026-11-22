import { describe, expect, it } from "vitest";
import {
  MAX_LINES,
  MAX_LINE_QUANTITY,
  addLine,
  emptyCart,
  itemCount,
  lineKey,
  parseCart,
  reconcile,
  removeLine,
  serializeCart,
  setQuantity,
  storageKey,
  subtotalMinor,
  type AddInput,
  type Cart,
} from "../../lib/cart/cart";
import { formatBagPrice } from "../../lib/cart/format";

const item = (over: Partial<AddInput> = {}): AddInput => ({
  productSlug: "linen-dress",
  variantId: null,
  name: "Linen Midi Dress",
  variantTitle: null,
  imagePath: null,
  unitPriceMinor: 345000,
  compareAtMinor: null,
  ...over,
});

const add = (cart: Cart, input: AddInput) => {
  const r = addLine(cart, input);
  if (!r.ok) throw new Error(r.reason);
  return r.cart;
};

describe("cart lines", () => {
  it("adds a line, and adding the same product and variant again raises its quantity", () => {
    let cart = add(emptyCart(), item());
    cart = add(cart, item({ quantity: 2 }));
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0].quantity).toBe(3);
  });

  it("keeps different variants of one product on separate lines", () => {
    const cart = add(add(emptyCart(), item({ variantId: "v1", variantTitle: "S / Oat" })), item({ variantId: "v2", variantTitle: "M / Oat" }));
    expect(cart.lines.map((l) => l.key)).toEqual([lineKey("linen-dress", "v1"), lineKey("linen-dress", "v2")]);
  });

  it("caps a line at the maximum quantity", () => {
    let cart = add(emptyCart(), item({ quantity: 8 }));
    cart = add(cart, item({ quantity: 8 }));
    expect(cart.lines[0].quantity).toBe(MAX_LINE_QUANTITY);
    expect(setQuantity(cart, cart.lines[0].key, 99).lines[0].quantity).toBe(MAX_LINE_QUANTITY);
  });

  it("refuses a new line when the bag is full, but still raises an existing one", () => {
    let cart = emptyCart();
    for (let i = 0; i < MAX_LINES; i++) cart = add(cart, item({ productSlug: `p${i}` }));
    expect(addLine(cart, item({ productSlug: "extra" }))).toMatchObject({ ok: false, reason: "full" });
    expect(addLine(cart, item({ productSlug: "p0" })).ok).toBe(true);
  });

  it("refuses invalid input", () => {
    expect(addLine(emptyCart(), item({ unitPriceMinor: -1 })).ok).toBe(false);
    expect(addLine(emptyCart(), item({ unitPriceMinor: 1.5 })).ok).toBe(false);
    expect(addLine(emptyCart(), item({ name: "" })).ok).toBe(false);
    expect(addLine(emptyCart(), item({ productSlug: "" })).ok).toBe(false);
  });

  it("sets and removes quantities; a quantity below one removes the line", () => {
    const cart = add(emptyCart(), item({ quantity: 2 }));
    const key = cart.lines[0].key;
    expect(setQuantity(cart, key, 4).lines[0].quantity).toBe(4);
    expect(setQuantity(cart, key, 0).lines).toHaveLength(0);
    expect(removeLine(cart, key).lines).toHaveLength(0);
    expect(removeLine(cart, "nope").lines).toHaveLength(1);
  });

  it("counts items and adds up the subtotal in minor units", () => {
    const cart = add(add(emptyCart(), item({ quantity: 2 })), item({ productSlug: "saree", name: "Saree", unitPriceMinor: 980000 }));
    expect(itemCount(cart)).toBe(3);
    expect(subtotalMinor(cart)).toBe(2 * 345000 + 980000);
  });
});

describe("stored cart", () => {
  it("round-trips", () => {
    const cart = add(add(emptyCart(), item({ variantId: "v1", variantTitle: "S / Oat", imagePath: "t/p/a.jpg", compareAtMinor: 400000 })), item({ productSlug: "saree", name: "Saree" }));
    expect(parseCart(serializeCart(cart))).toEqual(cart);
  });

  it("treats missing, broken or oversized data as an empty bag", () => {
    expect(parseCart(null).lines).toEqual([]);
    expect(parseCart("not json").lines).toEqual([]);
    expect(parseCart('{"lines":"x"}').lines).toEqual([]);
    expect(parseCart("x".repeat(300_000)).lines).toEqual([]);
  });

  it("drops bad lines one by one and fixes what it can", () => {
    const raw = JSON.stringify({
      lines: [
        { productSlug: "ok", name: "Ok", unitPriceMinor: 100, quantity: 3 },
        { productSlug: "bad-price", name: "Bad", unitPriceMinor: -5, quantity: 1 },
        { productSlug: "bad-float", name: "Bad", unitPriceMinor: 1.5, quantity: 1 },
        { productSlug: "", name: "No slug", unitPriceMinor: 100, quantity: 1 },
        { productSlug: "ok", name: "Duplicate", unitPriceMinor: 100, quantity: 1 },
        { productSlug: "big", name: "Big", unitPriceMinor: 100, quantity: 500, compareAtMinor: 50 },
        "junk",
        null,
      ],
    });
    const cart = parseCart(raw);
    expect(cart.lines.map((l) => l.productSlug)).toEqual(["ok", "big"]);
    expect(cart.lines[1].quantity).toBe(MAX_LINE_QUANTITY);
    expect(cart.lines[1].compareAtMinor).toBeNull();
  });

  it("never lets one store's saved bag be read under another store's key", () => {
    expect(storageKey("silk-route")).not.toBe(storageKey("northline"));
    expect(storageKey("silk-route")).toContain("silk-route");
  });
});

describe("reconcile with the store's live products", () => {
  const cart = add(add(add(emptyCart(), item({ productSlug: "a", name: "A" })), item({ productSlug: "b", name: "B", unitPriceMinor: 1000 })), item({ productSlug: "c", name: "C" }));

  it("removes gone and unavailable lines, refreshes the others, and leaves unanswered lines alone", () => {
    const result = reconcile(cart, [
      { key: lineKey("a", null), status: "gone" },
      { key: lineKey("b", null), status: "ok", name: "B renamed", variantTitle: null, imagePath: "x.jpg", unitPriceMinor: 1200, compareAtMinor: null },
    ]);
    expect(result.removed).toEqual(["A"]);
    expect(result.priceChanged).toEqual(["B renamed"]);
    expect(result.cart.lines.map((l) => [l.productSlug, l.name, l.unitPriceMinor])).toEqual([
      ["b", "B renamed", 1200],
      ["c", "C", 345000],
    ]);
    expect(reconcile(cart, [{ key: lineKey("c", null), status: "unavailable" }]).removed).toEqual(["C"]);
  });
});

describe("bag prices", () => {
  it("drops .00 on whole amounts and keeps real decimals", () => {
    expect(formatBagPrice(980000, "INR")).toBe("₹9,800");
    expect(formatBagPrice(980050, "INR")).toBe("₹9,800.50");
    expect(formatBagPrice(18900, "USD", "en-US")).toBe("$189");
  });
});
