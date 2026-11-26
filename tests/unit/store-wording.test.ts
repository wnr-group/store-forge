import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Shopping wording: the five theme-wide words (lib/storefront/wording.ts). The helper is tested directly; the storefront pieces
 * that use it are rendered to static markup with the bag and wishlist providers replaced by plain state, because the real ones
 * only report "ready" after the browser has read its saved bag.
 */

const cartState = {
  storeSlug: "shop",
  currency: "INR",
  preview: false,
  lines: [] as unknown[],
  count: 0,
  subtotalMinor: 0,
  ready: true,
  drawerOpen: true,
  openDrawer: () => {},
  closeDrawer: () => {},
  add: () => true,
  setQuantity: () => {},
  remove: () => {},
  clear: () => {},
  revalidate: async () => null,
  toast: null,
  dismissToast: () => {},
  notify: () => {},
};
const wishlistState = { ready: true, items: [] as unknown[], count: 0, has: () => false, toggle: () => true, revalidate: async () => null };

vi.mock("@/components/storefront/cart/cart-provider", () => ({ useOptionalCart: () => cartState, useCart: () => cartState }));
vi.mock("@/components/storefront/wishlist/wishlist-provider", () => ({ useOptionalWishlist: () => wishlistState }));
vi.mock("@/components/storefront/tracking/tracking-provider", () => ({ useTracker: () => ({ track: () => {} }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }), useSearchParams: () => new URLSearchParams() }));
vi.mock("next/link", async () => {
  const { createElement: h } = await import("react");
  return { default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => h("a", { href, ...rest }, children) };
});
vi.mock("next/image", async () => {
  const { createElement: h } = await import("react");
  return { default: (p: { src: string; alt: string }) => h("img", { src: p.src, alt: p.alt }) };
});
vi.mock("@/app/s/[slug]/cart/actions", () => ({ checkCartAction: async () => [], checkpointCartAction: async () => undefined }));
vi.mock("@/app/s/[slug]/wishlist/actions", () => ({ checkWishlistAction: async () => [] }));
vi.mock("@/app/s/[slug]/checkout/actions", () => ({
  paymentOptionsAction: async () => ({ ok: false }),
  placeOrderAction: async () => ({ ok: false }),
  quoteAction: async () => ({ ok: false }),
  shippingOptionsAction: async () => ({ ok: false }),
  validateDiscountAction: async () => ({ ok: false }),
}));

import { CartChrome } from "@/components/storefront/cart/cart-drawer";
import { CartPageSection } from "@/components/storefront/cart/cart-page";
import { CheckoutPageSection } from "@/components/storefront/checkout/checkout-page";
import { StorefrontContext } from "@/components/storefront/engine/context";
import { WishlistPageSection } from "@/components/storefront/wishlist/wishlist-page";
import { DEFAULT_WORDING, WORDING_KEYS, WORDING_MAX, wordingOf } from "@/lib/storefront/wording";

const themeWith = (words: Record<string, unknown>) => ({ schemaVersion: 1, settings: { brand: { look: "boutique" }, productCards: words } });
const BOUTIQUE = { schemaVersion: 1, settings: { brand: { look: "boutique" } } };

describe("wordingOf", () => {
  it("returns the current storefront words when the theme has no wording", () => {
    for (const theme of [undefined, null, {}, { settings: {} }, { settings: { productCards: {} } }, BOUTIQUE, "text", 5, []]) expect(wordingOf(theme)).toEqual(DEFAULT_WORDING);
  });

  it("returns a copy, so a caller cannot change the defaults", () => {
    const w = wordingOf(undefined);
    w.addToBagLabel = "changed";
    expect(wordingOf(undefined).addToBagLabel).toBe("Add to bag");
    expect(DEFAULT_WORDING.addToBagLabel).toBe("Add to bag");
  });

  it("reads each custom value, from the theme document or from its settings alone", () => {
    const words = { addToBagLabel: "Buy now", emptyCartTitle: "Nothing here", emptyCartMessage: "Add something.", emptyWishlistTitle: "No favourites", emptyWishlistMessage: "Tap the heart." };
    expect(wordingOf(themeWith(words))).toEqual(words);
    expect(wordingOf({ productCards: words })).toEqual(words);
  });

  it("changes only the values that are set", () => {
    expect(wordingOf(themeWith({ emptyCartTitle: "Empty" }))).toEqual({ ...DEFAULT_WORDING, emptyCartTitle: "Empty" });
  });

  it("trims every value", () => {
    expect(wordingOf(themeWith({ addToBagLabel: "   Buy now \n" })).addToBagLabel).toBe("Buy now");
  });

  it("uses the default for blank, whitespace-only and non-text values", () => {
    for (const bad of ["", "   ", "\n\t", null, undefined, 5, true, {}, [], ["Buy"]]) {
      const w = wordingOf(themeWith(Object.fromEntries(WORDING_KEYS.map((k) => [k, bad]))));
      expect({ bad: String(bad), w }).toEqual({ bad: String(bad), w: DEFAULT_WORDING });
    }
  });

  it("ignores a wording group that is not an object, and inherited keys", () => {
    for (const group of ["text", 5, null, [], true]) expect(wordingOf({ settings: { productCards: group } })).toEqual(DEFAULT_WORDING);
    expect(wordingOf({ settings: JSON.parse('{"productCards":{"__proto__":{"addToBagLabel":"x"}}}') })).toEqual(DEFAULT_WORDING);
  });

  it("cuts a value that is longer than its limit (a hand-edited document), never past the limit", () => {
    for (const key of WORDING_KEYS) {
      const w = wordingOf(themeWith({ [key]: "x".repeat(WORDING_MAX[key] + 50) }));
      expect({ key, length: w[key].length }).toEqual({ key, length: WORDING_MAX[key] });
    }
  });
});

describe("the empty states use the wording", () => {
  beforeEach(() => {
    cartState.lines = [];
    cartState.drawerOpen = true;
    wishlistState.items = [];
  });

  const node = (type: string) => ({ type, settings: {}, blocks: {}, block_order: [] }) as never;
  const store = { name: "Shop", slug: "shop", currency: "INR", products: [] };
  const context = (theme: unknown) => ({ store, collections: [], theme, mode: "public", basePath: "" }) as never;
  const page = (Section: typeof CartPageSection, type: string, theme: unknown) => renderToStaticMarkup(createElement(Section, { node: node(type), context: context(theme), sectionId: type }));
  const drawer = (theme: unknown) => renderToStaticMarkup(createElement(StorefrontContext.Provider, { value: context(theme) }, createElement(CartChrome)));

  const CUSTOM = {
    emptyCartTitle: "Your basket awaits",
    emptyCartMessage: "Nothing in the basket yet.",
    emptyWishlistTitle: "No favourites yet",
    emptyWishlistMessage: "Tap a heart to save a piece.",
  };

  describe("cart page", () => {
    it("shows the original title and message when nothing is set", () => {
      const html = page(CartPageSection, "cart", BOUTIQUE);
      expect(html).toContain(DEFAULT_WORDING.emptyCartTitle);
      expect(html).toContain(DEFAULT_WORDING.emptyCartMessage);
    });
    it("shows the custom title and message", () => {
      const html = page(CartPageSection, "cart", themeWith(CUSTOM));
      expect(html).toContain(CUSTOM.emptyCartTitle);
      expect(html).toContain(CUSTOM.emptyCartMessage);
      expect(html).not.toContain(DEFAULT_WORDING.emptyCartTitle);
      expect(html).not.toContain(DEFAULT_WORDING.emptyCartMessage);
    });
    it("is not affected by the wishlist wording", () => {
      const html = page(CartPageSection, "cart", themeWith({ emptyWishlistTitle: "Wishlist words", emptyWishlistMessage: "More wishlist words" }));
      expect(html).toContain(DEFAULT_WORDING.emptyCartTitle);
      expect(html).not.toContain("Wishlist words");
      expect(html).not.toContain("More wishlist words");
    });
    it("keeps the other links of the empty page", () => {
      const html = page(CartPageSection, "cart", themeWith(CUSTOM));
      expect(html).toContain("Continue shopping");
      expect(html).toContain("Track an order");
    });
  });

  describe("wishlist page", () => {
    it("shows the original title and message when nothing is set", () => {
      const html = page(WishlistPageSection, "wishlist", BOUTIQUE);
      expect(html).toContain(DEFAULT_WORDING.emptyWishlistTitle);
      expect(html).toContain(DEFAULT_WORDING.emptyWishlistMessage);
    });
    it("shows the custom title and message", () => {
      const html = page(WishlistPageSection, "wishlist", themeWith(CUSTOM));
      expect(html).toContain(CUSTOM.emptyWishlistTitle);
      expect(html).toContain(CUSTOM.emptyWishlistMessage);
      expect(html).not.toContain(DEFAULT_WORDING.emptyWishlistTitle);
      expect(html).not.toContain(DEFAULT_WORDING.emptyWishlistMessage);
    });
    it("is not affected by the cart wording, and never says the bag is empty", () => {
      const html = page(WishlistPageSection, "wishlist", themeWith({ emptyCartTitle: "Cart words", emptyCartMessage: "More cart words" }));
      expect(html).toContain(DEFAULT_WORDING.emptyWishlistTitle);
      expect(html).not.toContain("Cart words");
      expect(html).not.toContain("More cart words");
      expect(html).not.toMatch(/bag is empty/i);
    });
    it("still lists saved products instead of the empty state", () => {
      wishlistState.items = [{ productSlug: "linen", name: "Linen Dress", shortDescription: null, imagePath: null, priceMinor: 1000, compareAtMinor: null, available: true }];
      wishlistState.count = 1;
      const html = page(WishlistPageSection, "wishlist", themeWith(CUSTOM));
      expect(html).toContain("Linen Dress");
      expect(html).not.toContain(CUSTOM.emptyWishlistTitle);
      wishlistState.count = 0;
    });
  });

  describe("cart drawer", () => {
    it("shows the original title when nothing is set", () => {
      expect(drawer(BOUTIQUE)).toContain(DEFAULT_WORDING.emptyCartTitle);
    });
    it("shows the custom cart title, the same one as the cart page, and not the page message or the wishlist words", () => {
      const html = drawer(themeWith(CUSTOM));
      expect(html).toContain(CUSTOM.emptyCartTitle);
      expect(html).not.toContain(DEFAULT_WORDING.emptyCartTitle);
      expect(html).not.toContain(CUSTOM.emptyCartMessage);
      expect(html).not.toContain(CUSTOM.emptyWishlistTitle);
    });
    it("renders nothing while closed", () => {
      cartState.drawerOpen = false;
      expect(drawer(themeWith(CUSTOM))).not.toContain(CUSTOM.emptyCartTitle);
    });
    it("falls back to the original title outside a storefront (no theme)", () => {
      expect(renderToStaticMarkup(createElement(CartChrome))).toContain(DEFAULT_WORDING.emptyCartTitle);
    });
  });

  describe("checkout", () => {
    it("shows the original title when nothing is set", () => {
      expect(page(CheckoutPageSection, "checkout", BOUTIQUE)).toContain(DEFAULT_WORDING.emptyCartTitle);
    });
    it("shows the custom cart title and not the wishlist words", () => {
      const html = page(CheckoutPageSection, "checkout", themeWith(CUSTOM));
      expect(html).toContain(CUSTOM.emptyCartTitle);
      expect(html).not.toContain(DEFAULT_WORDING.emptyCartTitle);
      expect(html).not.toContain(CUSTOM.emptyWishlistTitle);
      expect(html).toContain("Continue shopping");
    });
  });
});

describe("what the wording does not touch", () => {
  const read = (file: string) => readFileSync(join(__dirname, "..", "..", file), "utf8");

  it("Market's Add to cart buttons and the Sold out / Select options labels do not use the wording", () => {
    for (const file of ["components/storefront/engine/looks/market/buy-box.tsx", "components/storefront/engine/looks/market/card-actions.tsx"]) {
      const source = read(file);
      expect(source, file).not.toMatch(/wording|useWording/);
      expect(source, file).toContain("Add to cart");
    }
    const addToBag = read("components/storefront/cart/add-to-bag.tsx");
    expect(addToBag).toContain('"Sold out"');
    expect(addToBag).toContain('"Select options"');
  });
});
