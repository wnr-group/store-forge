import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

vi.mock("next/image", async () => {
  const { createElement: h } = await import("react");
  return { default: (p: { src: string; alt: string }) => h("img", { src: p.src, alt: p.alt }) };
});
vi.mock("next/link", async () => {
  const { createElement: h } = await import("react");
  return { default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => h("a", { href, ...rest }, children) };
});
const getPublicProductApi = vi.fn();
vi.mock("@/lib/api/endpoints/public-api", () => ({ getPublicProductApi: (...a: unknown[]) => getPublicProductApi(...a) }));

import { clampRating, BoutiqueTestimonials } from "@/components/storefront/engine/looks/boutique/testimonials";
import { inBand, niceNumber, priceBands } from "@/lib/storefront/price-bands";
import { MAX_WISHLIST, addItem, emptyWishlist, hasItem, parseWishlist, reconcileWishlist, removeItem, serializeWishlist, toggleItem, wishlistStorageKey, type WishlistItem } from "@/lib/wishlist/wishlist";
import { checkWishlistAction } from "../../app/s/[slug]/wishlist/actions";
import { quickAddAction } from "../../app/s/[slug]/cart/actions";

const item = (over: Partial<WishlistItem> = {}): WishlistItem => ({ productSlug: "linen", name: "Linen Dress", shortDescription: null, imagePath: null, priceMinor: 345000, compareAtMinor: null, available: true, ...over });

describe("wishlist", () => {
  it("toggles an item on and off, newest first", () => {
    let list = toggleItem(emptyWishlist(), item({ productSlug: "a", name: "A" })).list;
    const r = toggleItem(list, item({ productSlug: "b", name: "B" }));
    expect(r.saved).toBe(true);
    expect(r.list.items.map((i) => i.productSlug)).toEqual(["b", "a"]);
    list = toggleItem(r.list, item({ productSlug: "a", name: "A" })).list;
    expect(list.items.map((i) => i.productSlug)).toEqual(["b"]);
    expect(hasItem(list, "a")).toBe(false);
  });

  it("refreshes a saved item instead of duplicating it, refuses bad input and a full list", () => {
    let list = addItem(emptyWishlist(), item()).list;
    list = addItem(list, item({ priceMinor: 1 })).list;
    expect(list.items).toHaveLength(1);
    expect(list.items[0].priceMinor).toBe(1);
    expect(addItem(emptyWishlist(), item({ priceMinor: -1 })).ok).toBe(false);
    expect(addItem(emptyWishlist(), item({ name: "" })).ok).toBe(false);
    let full = emptyWishlist();
    for (let i = 0; i < MAX_WISHLIST; i++) full = addItem(full, item({ productSlug: `p${i}` })).list;
    expect(addItem(full, item({ productSlug: "extra" })).ok).toBe(false);
    expect(removeItem(full, "p0").items).toHaveLength(MAX_WISHLIST - 1);
  });

  it("round-trips and drops malformed stored entries one by one", () => {
    const list = addItem(emptyWishlist(), item({ compareAtMinor: 400000, imagePath: "t/a.jpg", shortDescription: "Soft" })).list;
    expect(parseWishlist(serializeWishlist(list))).toEqual(list);
    const raw = JSON.stringify({ items: [{ productSlug: "ok", name: "Ok", priceMinor: 100 }, { productSlug: "ok", name: "Dup", priceMinor: 100 }, { productSlug: "bad", name: "Bad", priceMinor: -1 }, { productSlug: "", name: "x", priceMinor: 1 }, "junk", null] });
    expect(parseWishlist(raw).items.map((i) => i.productSlug)).toEqual(["ok"]);
    expect(parseWishlist("not json").items).toEqual([]);
    expect(parseWishlist(null).items).toEqual([]);
  });

  it("keeps each store's list under its own key", () => {
    expect(wishlistStorageKey("silk-route")).not.toBe(wishlistStorageKey("northline"));
  });

  it("reconcile removes gone products, refreshes the others and keeps unanswered ones", () => {
    const list = { items: [item({ productSlug: "a", name: "A" }), item({ productSlug: "b", name: "B" }), item({ productSlug: "c", name: "C" })] };
    const r = reconcileWishlist(list, [
      { status: "gone", productSlug: "a" },
      { status: "ok", ...item({ productSlug: "b", name: "B2", priceMinor: 5, available: false }) },
    ]);
    expect(r.removed).toEqual(["A"]);
    expect(r.list.items.map((i) => [i.productSlug, i.name, i.priceMinor, i.available])).toEqual([["b", "B2", 5, false], ["c", "C", 345000, true]]);
  });
});

describe("price bands", () => {
  it("rounds to nice numbers", () => {
    expect(niceNumber(4700)).toBe(5000);
    expect(niceNumber(1180)).toBe(1000);
    expect(niceNumber(2300)).toBe(2500);
    expect(niceNumber(0)).toBe(0);
  });

  it("makes bands from the list's own prices that cover every product exactly once", () => {
    const prices = [29000, 34000, 38000, 42000, 45000, 52000, 69000, 98000, 145000, 290000, 420000, 890000].map((p) => p);
    const bands = priceBands(prices, 2);
    expect(bands.length).toBeGreaterThanOrEqual(3);
    for (const p of prices) expect(bands.filter((b) => inBand(p, b))).toHaveLength(1);
    expect(bands[0].minMinor).toBeNull();
    expect(bands[bands.length - 1].maxMinor).toBeNull();
  });

  it("offers no price filter for a short or uniform list", () => {
    expect(priceBands([100, 200, 300], 2)).toEqual([]);
    expect(priceBands([500, 500, 500, 500, 500, 500, 500], 2)).toEqual([]);
  });
});

describe("quickAddAction", () => {
  beforeEach(() => {
    getPublicProductApi.mockReset();
  });
  const data = (over: Record<string, unknown> = {}, variants: unknown[] = []) => ({ product: { name: "Linen", price_minor: 100, compare_at_price_minor: null, available: true, ...over }, images: [{ id: "i", path: "t/a.jpg" }], variants });

  it("adds a plain product at its live price", async () => {
    getPublicProductApi.mockResolvedValue(data({ price_minor: 777 }));
    expect(await quickAddAction({ storeSlug: "s", productSlug: "linen" })).toEqual({ status: "ok", item: { productSlug: "linen", variantId: null, name: "Linen", variantTitle: null, imagePath: "t/a.jpg", unitPriceMinor: 777, compareAtMinor: null } });
    expect(getPublicProductApi).toHaveBeenCalledWith("s", "linen");
  });

  it("sends products with variants to their page, and refuses sold-out and deleted ones", async () => {
    getPublicProductApi.mockResolvedValueOnce(data({}, [{ id: "v" }]));
    expect(await quickAddAction({ storeSlug: "s", productSlug: "a" })).toEqual({ status: "options" });
    getPublicProductApi.mockResolvedValueOnce(data({ available: false }));
    expect(await quickAddAction({ storeSlug: "s", productSlug: "a" })).toEqual({ status: "unavailable" });
    getPublicProductApi.mockRejectedValueOnce(new AppError("NOT_FOUND", "x"));
    expect(await quickAddAction({ storeSlug: "s", productSlug: "a" })).toEqual({ status: "gone" });
    getPublicProductApi.mockRejectedValueOnce(new Error("down"));
    expect(await quickAddAction({ storeSlug: "s", productSlug: "a" })).toEqual({ status: "error" });
  });

  it("rejects malformed input without calling the API", async () => {
    expect(await quickAddAction({ storeSlug: "../x", productSlug: "a" })).toEqual({ status: "error" });
    expect(await quickAddAction(null)).toEqual({ status: "error" });
    expect(getPublicProductApi).not.toHaveBeenCalled();
  });
});

describe("checkWishlistAction", () => {
  beforeEach(() => {
    getPublicProductApi.mockReset();
  });
  it("refreshes live products, reports deleted ones, and ignores network failures", async () => {
    getPublicProductApi.mockImplementation(async (_s: string, slug: string) => {
      if (slug === "gone") throw new AppError("NOT_FOUND", "x");
      if (slug === "flaky") throw new Error("down");
      return { product: { name: "Live", short_description: "d", price_minor: 9, compare_at_price_minor: null, available: false }, images: [{ id: "i", path: "p.jpg" }], variants: [] };
    });
    const out = await checkWishlistAction({ storeSlug: "s", productSlugs: ["ok", "gone", "flaky", "ok"] });
    expect(out.find((c) => c.productSlug === "ok")).toMatchObject({ status: "ok", name: "Live", priceMinor: 9, available: false, imagePath: "p.jpg" });
    expect(out.find((c) => c.productSlug === "gone")).toEqual({ status: "gone", productSlug: "gone" });
    expect(out.find((c) => c.productSlug === "flaky")).toBeUndefined();
    expect(getPublicProductApi).toHaveBeenCalledTimes(3);
    expect(await checkWishlistAction({ storeSlug: "Bad Slug", productSlugs: [] })).toEqual([]);
  });
});

describe("boutique reviews", () => {
  const review = (quote: string, author: string, rating: number, role = "Chennai", company = "Linen Saree") => ({ type: "testimonial", settings: { quote, author, rating, role, company }, blocks: {}, block_order: [] });
  const node = (blocks: Record<string, unknown>) => ({ type: "testimonials", settings: { eyebrow: "Reviews", heading: "What customers say", columns: 3 }, blocks, block_order: Object.keys(blocks) }) as never;
  const render = (n: never, mode: "public" | "preview" = "public") => renderToStaticMarkup(createElement(BoutiqueTestimonials, { node: n, context: { store: { name: "S", slug: "s" }, mode } as never }));

  it("clamps ratings to 1-5 whole stars", () => {
    expect(clampRating(4)).toBe(4);
    expect(clampRating(0)).toBe(1);
    expect(clampRating(9)).toBe(5);
    expect(clampRating(undefined)).toBe(5);
    expect(clampRating(3.6)).toBe(4);
  });

  it("renders the merchant's reviews as cards with stars, quote, name, place and product", () => {
    const html = render(node({ r1: review("Wore it to a family function.", "Kiran R.", 4), r2: review("Quality is great.", "Swathi J.", 5, "Bengaluru", "Chanderi Saree") }));
    expect(html).toContain("Reviews");
    expect(html).toContain("What customers say");
    expect(html).toContain("Rated 4 out of 5");
    expect(html).toContain("Kiran R.");
    expect(html).toContain("Chennai · on Linen Saree");
    expect(html).toContain("Bengaluru · on Chanderi Saree");
  });

  it("shows nothing to shoppers without reviews, and a hint to the merchant", () => {
    expect(render(node({}))).toBe("");
    expect(render(node({}), "preview")).toContain("Add testimonials");
  });
});
