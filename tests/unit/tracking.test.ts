import { beforeEach, describe, expect, it } from "vitest";
import { consentKey, parseConsent } from "../../lib/tracking/consent";
import { GA4_MEASUREMENT_ID, ga4Items, toGa4, toMajor, type TrackItem } from "../../lib/tracking/events";
import { loadGtag, stopGtag, type GtagWindow } from "../../lib/tracking/gtag";
import { markPurchaseTracked, purchaseKey, resetPurchaseMemory, wasPurchaseTracked } from "../../lib/tracking/purchase-guard";

const mug: TrackItem = { id: "ceramic-mug", name: "Ceramic mug", priceMinor: 49900, quantity: 2 };
const tee: TrackItem = { id: "tee", name: "Tee", variant: "M / Oat", priceMinor: 120050, quantity: 1 };

describe("money", () => {
  it("turns paise into rupees without floating point noise", () => {
    expect(toMajor(12345)).toBe(123.45);
    expect(toMajor(49900)).toBe(499);
    expect(toMajor(1)).toBe(0.01);
    expect(toMajor(0)).toBe(0);
    expect(toMajor(Number.NaN)).toBe(0);
    expect(toMajor(10.4)).toBe(0.1);
  });
});

describe("GA4 items", () => {
  it("uses the product handle as the id, rupees as the price, and names a variant only when there is one", () => {
    expect(ga4Items([mug, tee])).toEqual([
      { item_id: "ceramic-mug", item_name: "Ceramic mug", price: 499, quantity: 2 },
      { item_id: "tee", item_name: "Tee", item_variant: "M / Oat", price: 1200.5, quantity: 1 },
    ]);
  });

  it("never sends more than 50 items", () => {
    expect(ga4Items(Array.from({ length: 80 }, (_, i) => ({ ...mug, id: `p-${i}` })))).toHaveLength(50);
  });
});

describe("GA4 events", () => {
  it("maps a page view", () => {
    expect(toGa4({ type: "page_view", path: "/products/mug", title: "Mug" })).toEqual({ name: "page_view", params: { page_path: "/products/mug", page_title: "Mug" } });
    expect(toGa4({ type: "page_view", path: "/" }).params).toEqual({ page_path: "/" });
  });

  it("maps view_item and add_to_cart with currency, value and items", () => {
    for (const type of ["view_item", "add_to_cart"] as const) {
      const e = toGa4({ type, currency: "INR", items: [mug] });
      expect(e.name).toBe(type);
      expect(e.params).toEqual({ currency: "INR", value: 998, items: [{ item_id: "ceramic-mug", item_name: "Ceramic mug", price: 499, quantity: 2 }] });
    }
  });

  it("maps begin_checkout with the value of the bag and a coupon only when there is one", () => {
    const e = toGa4({ type: "begin_checkout", currency: "INR", items: [mug, tee] });
    expect(e.params.value).toBe(2198.5);
    expect(e.params).not.toHaveProperty("coupon");
    expect(toGa4({ type: "begin_checkout", currency: "INR", items: [mug], couponCode: "SAVE10" }).params.coupon).toBe("SAVE10");
  });

  it("maps a purchase: value after the discount, delivery and tax apart, and the transaction id", () => {
    const e = toGa4({ type: "purchase", transactionId: "1007", currency: "INR", items: [mug, tee], discountMinor: 20000, shippingMinor: 5000, taxMinor: 33950, couponCode: "SAVE10" });
    expect(e.name).toBe("purchase");
    expect(e.params).toMatchObject({ transaction_id: "1007", currency: "INR", value: 1998.5, shipping: 50, tax: 339.5, coupon: "SAVE10" });
    expect(e.params.items).toHaveLength(2);
  });

  it("never reports a negative value", () => {
    expect(toGa4({ type: "purchase", transactionId: "1", currency: "INR", items: [mug], discountMinor: 999999, shippingMinor: 0, taxMinor: 0 }).params.value).toBe(0);
  });
});

describe("Measurement ID shape", () => {
  it("accepts a GA4 ID and refuses anything that could be put in a script address", () => {
    expect(GA4_MEASUREMENT_ID.test("G-ABCDE12345")).toBe(true);
    for (const bad of ["g-abcde12345", "G-SHORT", "UA-1234-1", "G-ABCDE12345&x=1", "G-ABCDE12345/../x", " G-ABCDE12345", "G-ABCDE12345\n"]) expect(GA4_MEASUREMENT_ID.test(bad)).toBe(false);
  });
});

describe("consent", () => {
  it("is only ever one of two answers, otherwise no answer", () => {
    expect(parseConsent("granted")).toBe("granted");
    expect(parseConsent("denied")).toBe("denied");
    for (const raw of [null, "", "true", "GRANTED", "granted ", "1", "{\"analytics\":true}"]) expect(parseConsent(raw)).toBeNull();
  });

  it("is remembered per store", () => {
    expect(consentKey("alpha")).not.toBe(consentKey("beta"));
  });
});

describe("purchase guard", () => {
  const storage = () => {
    const data = new Map<string, string>();
    return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), data };
  };
  beforeEach(() => resetPurchaseMemory());

  it("reports an order once, per store and order number", () => {
    const s = storage();
    expect(wasPurchaseTracked(s, "alpha", 1001)).toBe(false);
    markPurchaseTracked(s, "alpha", 1001);
    expect(wasPurchaseTracked(s, "alpha", 1001)).toBe(true);
    expect(wasPurchaseTracked(s, "alpha", 1002)).toBe(false);
    expect(wasPurchaseTracked(s, "beta", 1001)).toBe(false);
    expect(s.data.get(purchaseKey("alpha", 1001))).toBe("1");
  });

  it("still catches a repeat within the visit when storage is blocked", () => {
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(wasPurchaseTracked(blocked, "alpha", 5)).toBe(false);
    expect(() => markPurchaseTracked(blocked, "alpha", 5)).not.toThrow();
    expect(wasPurchaseTracked(blocked, "alpha", 5)).toBe(true);
    expect(wasPurchaseTracked(null, "alpha", 6)).toBe(false);
  });
});

describe("loading Google's tag", () => {
  const fakes = () => {
    const scripts: { async: boolean; src: string; dataset: Record<string, string>; onerror: (() => void) | null }[] = [];
    const doc = {
      cookie: "",
      cookies: [] as string[],
      querySelector: (selector: string) => scripts.find((s) => selector === `script[data-sf-gtag="${s.dataset.sfGtag}"]`) ?? null,
      createElement: () => ({ async: false, src: "", dataset: {} as Record<string, string>, onerror: null as (() => void) | null }),
      head: { appendChild: (n: unknown) => scripts.push(n as (typeof scripts)[number]) },
    };
    // Record every cookie assignment, like a browser would apply them.
    let last = "";
    Object.defineProperty(doc, "cookie", { get: () => last, set: (v: string) => void doc.cookies.push((last = v)) });
    return { win: {} as GtagWindow, doc, scripts };
  };

  it("adds Google's own script for the ID exactly once, however often it is called", () => {
    const { win, doc, scripts } = fakes();
    loadGtag(win, doc as never, "G-ABCDE12345");
    loadGtag(win, doc as never, "G-ABCDE12345");
    expect(scripts).toHaveLength(1);
    expect(scripts[0].src).toBe("https://www.googletagmanager.com/gtag/js?id=G-ABCDE12345");
    expect(scripts[0].async).toBe(true);
  });

  it("configures the tag once, however many events ask for it, and switches back on after an opt-out", () => {
    const { win, doc } = fakes();
    for (let i = 0; i < 5; i += 1) loadGtag(win, doc as never, "G-ABCDE12345");
    const configs = (win.dataLayer as unknown[]).map((a) => Array.from(a as ArrayLike<unknown>)).filter((c) => c[0] === "config");
    expect(configs).toHaveLength(1);
    stopGtag(win, doc as never, "G-ABCDE12345");
    loadGtag(win, doc as never, "G-ABCDE12345");
    expect(win["ga-disable-G-ABCDE12345"]).toBe(false);
  });

  it("keeps ads and personalization off, and sends no page view by itself", () => {
    const { win, doc } = fakes();
    loadGtag(win, doc as never, "G-ABCDE12345");
    const calls = (win.dataLayer as unknown[]).map((a) => Array.from(a as ArrayLike<unknown>));
    expect(calls[0]).toEqual(["consent", "default", { analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" }]);
    expect(calls[1][0]).toBe("js");
    expect(calls[2]).toEqual(["config", "G-ABCDE12345", { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false }]);
  });

  it("queues what gtag.js expects: the arguments object, not an array", () => {
    const { win, doc } = fakes();
    loadGtag(win, doc as never, "G-ABCDE12345");
    for (const entry of win.dataLayer as unknown[]) expect(Array.isArray(entry)).toBe(false);
    win.gtag?.("event", "page_view", { page_path: "/" });
    expect(Object.prototype.toString.call((win.dataLayer as unknown[]).at(-1))).toBe("[object Arguments]");
  });

  it("refuses anything that is not a Measurement ID, so it can never become part of a script address", () => {
    const { win, doc, scripts } = fakes();
    for (const bad of ["", "G-ABCDE12345&x=1", "https://evil.example/x.js", "G-abcde12345", "G-ABCDE12345\"><script"]) expect(() => loadGtag(win, doc as never, bad)).toThrow();
    expect(scripts).toHaveLength(0);
    expect(win.gtag).toBeUndefined();
  });

  it("reports a script that cannot load, without throwing", () => {
    const { win, doc, scripts } = fakes();
    let failed = 0;
    loadGtag(win, doc as never, "G-ABCDE12345", () => (failed += 1));
    scripts[0].onerror?.();
    expect(failed).toBe(1);
  });

  it("opts out and clears Google's cookies when the shopper takes their agreement back", () => {
    const { win, doc } = fakes();
    loadGtag(win, doc as never, "G-ABCDE12345");
    expect(win["ga-disable-G-ABCDE12345"]).toBe(false);
    stopGtag(win, doc as never, "G-ABCDE12345");
    expect(win["ga-disable-G-ABCDE12345"]).toBe(true);
    expect(doc.cookies).toEqual(["_ga=; Max-Age=0; path=/", "_ga_ABCDE12345=; Max-Age=0; path=/"]);
  });
});
