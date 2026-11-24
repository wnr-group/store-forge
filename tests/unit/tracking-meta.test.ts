import { describe, expect, it } from "vitest";
import { consentCopy } from "../../lib/tracking/consent";
import { META_PIXEL_ID, purchaseEventId, toMeta, type TrackItem } from "../../lib/tracking/events";
import { loadFbq, stopFbq, type FbqWindow } from "../../lib/tracking/fbq";

const mug: TrackItem = { id: "ceramic-mug", name: "Ceramic mug", priceMinor: 49900, quantity: 2 };
const tee: TrackItem = { id: "tee", name: "Tee", variant: "M / Oat", priceMinor: 120050, quantity: 1 };

describe("Meta Pixel events", () => {
  let n = 0;
  const id = () => `evt-${++n}`;
  const bag = [mug, tee];

  it("maps a page view", () => {
    expect(toMeta({ type: "page_view", path: "/" }, id)).toEqual({ name: "PageView", params: {}, eventId: expect.stringMatching(/^evt-/) });
  });

  it("maps ViewContent and AddToCart with the product, its price and currency", () => {
    for (const [type, name] of [
      ["view_item", "ViewContent"],
      ["add_to_cart", "AddToCart"],
    ] as const) {
      const e = toMeta({ type, currency: "INR", items: [mug] }, id);
      expect(e.name).toBe(name);
      expect(e.params).toEqual({
        content_type: "product",
        content_ids: ["ceramic-mug"],
        content_name: "Ceramic mug",
        contents: [{ id: "ceramic-mug", quantity: 2, item_price: 499 }],
        currency: "INR",
        value: 998,
      });
    }
  });

  it("maps InitiateCheckout with the number of items and the value of the bag", () => {
    const e = toMeta({ type: "begin_checkout", currency: "INR", items: bag }, id);
    expect(e.name).toBe("InitiateCheckout");
    expect(e.params).toMatchObject({ num_items: 3, value: 2198.5, content_ids: ["ceramic-mug", "tee"] });
    expect(e.params).not.toHaveProperty("content_name");
  });

  it("maps a Purchase with its value after the discount, and always the same event id for the same order", () => {
    const purchase = { type: "purchase", transactionId: "1007", currency: "INR", items: bag, discountMinor: 20000, shippingMinor: 5000, taxMinor: 0 } as const;
    const a = toMeta(purchase, id);
    const b = toMeta(purchase, id);
    expect(a.name).toBe("Purchase");
    expect(a.params).toMatchObject({ value: 1998.5, num_items: 3, currency: "INR" });
    expect(a.eventId).toBe("purchase_1007");
    expect(b.eventId).toBe(a.eventId);
    expect(purchaseEventId("1007")).toBe("purchase_1007");
    expect(toMeta({ ...purchase, eventId: "custom" }, id).eventId).toBe("custom");
  });

  it("gives every event without an order a fresh id, so none are counted as one", () => {
    const a = toMeta({ type: "add_to_cart", currency: "INR", items: [mug] }, id).eventId;
    const b = toMeta({ type: "add_to_cart", currency: "INR", items: [mug] }, id).eventId;
    expect(a).not.toBe(b);
  });
});

describe("Pixel ID shape", () => {
  it("accepts 15 or 16 digits and refuses anything that could reach the script as something else", () => {
    expect(META_PIXEL_ID.test("123456789012345")).toBe(true);
    expect(META_PIXEL_ID.test("1234567890123456")).toBe(true);
    for (const bad of ["12345678901234", "12345678901234567", "12345678901234a", "123456789012345'); alert(1);//", " 123456789012345", "123456789012345\n"]) expect(META_PIXEL_ID.test(bad)).toBe(false);
  });
});

describe("loading the Meta script", () => {
  const fakes = () => {
    const scripts: { async: boolean; src: string; dataset: Record<string, string>; onerror: (() => void) | null }[] = [];
    const cookies: string[] = [];
    const doc = {
      querySelector: (selector: string) => (selector === "script[data-sf-fbq]" ? (scripts[0] ?? null) : null),
      createElement: () => ({ async: false, src: "", dataset: {} as Record<string, string>, onerror: null as (() => void) | null }),
      head: { appendChild: (n: unknown) => scripts.push(n as (typeof scripts)[number]) },
    };
    Object.defineProperty(doc, "cookie", { get: () => cookies.at(-1) ?? "", set: (v: string) => void cookies.push(v) });
    return { win: {} as FbqWindow, doc, scripts, cookies };
  };
  const calls = (win: FbqWindow) => (win.fbq?.queue ?? []).map((a) => Array.from(a as ArrayLike<unknown>));

  it("adds the script once, with automatic configuration off before the Pixel is initialised", () => {
    const { win, doc, scripts } = fakes();
    loadFbq(win, doc as never, "123456789012345");
    loadFbq(win, doc as never, "123456789012345");
    expect(scripts).toHaveLength(1);
    expect(scripts[0].src).toBe("https://connect.facebook.net/en_US/fbevents.js");
    expect(calls(win)).toEqual([
      ["set", "autoConfig", false, "123456789012345"],
      ["init", "123456789012345"],
    ]);
  });

  it("sends no page view by itself", () => {
    const { win, doc } = fakes();
    loadFbq(win, doc as never, "123456789012345");
    expect(calls(win).some((c) => c[0] === "track")).toBe(false);
  });

  it("queues events as arguments objects until the Meta script takes over", () => {
    const { win, doc } = fakes();
    loadFbq(win, doc as never, "123456789012345");
    win.fbq?.("track", "ViewContent", { value: 1 }, { eventID: "e1" });
    expect(calls(win).at(-1)).toEqual(["track", "ViewContent", { value: 1 }, { eventID: "e1" }]);
    for (const entry of win.fbq?.queue ?? []) expect(Array.isArray(entry)).toBe(false);
  });

  it("refuses anything that is not a Pixel ID", () => {
    const { win, doc, scripts } = fakes();
    for (const bad of ["", "G-ABCDE12345", "123", "123456789012345'); evil(", "https://evil.example"]) expect(() => loadFbq(win, doc as never, bad)).toThrow();
    expect(scripts).toHaveLength(0);
    expect(win.fbq).toBeUndefined();
  });

  it("revokes consent and clears the cookies when the shopper takes their agreement back, and grants it again if they return", () => {
    const { win, doc, cookies } = fakes();
    loadFbq(win, doc as never, "123456789012345");
    stopFbq(win, doc as never);
    expect(calls(win).at(-1)).toEqual(["consent", "revoke"]);
    expect(cookies).toEqual(["_fbp=; Max-Age=0; path=/", "_fbc=; Max-Age=0; path=/"]);
    loadFbq(win, doc as never, "123456789012345");
    expect(calls(win).at(-1)).toEqual(["consent", "grant"]);
    loadFbq(win, doc as never, "123456789012345");
    expect(calls(win).filter((c) => c[0] === "consent")).toHaveLength(2);
  });

  it("stopping before anything was loaded does nothing harmful", () => {
    const { win, doc } = fakes();
    expect(() => stopFbq(win, doc as never)).not.toThrow();
  });
});

describe("what the shopper is asked to agree to", () => {
  it("names exactly the services that are switched on", () => {
    expect(consentCopy(["ga4"])).toMatch(/Google Analytics/);
    expect(consentCopy(["ga4"])).not.toMatch(/Meta/);
    expect(consentCopy(["meta_pixel"])).toMatch(/Meta Pixel/);
    expect(consentCopy(["meta_pixel"])).not.toMatch(/Google/);
    expect(consentCopy(["ga4", "meta_pixel"])).toMatch(/Google Analytics and the Meta Pixel/);
  });
});
