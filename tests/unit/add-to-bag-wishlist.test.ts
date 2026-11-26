import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/s/[slug]/cart/actions", () => ({ checkCartAction: async () => [] }));
vi.mock("@/app/s/[slug]/wishlist/actions", () => ({ checkWishlistAction: async () => [] }));

import { AddToBag } from "@/components/storefront/cart/add-to-bag";
import { CartProvider } from "@/components/storefront/cart/cart-provider";
import { StorefrontContext } from "@/components/storefront/engine/context";
import { WishlistProvider } from "@/components/storefront/wishlist/wishlist-provider";

const product = { name: "Linen Dress", slug: "linen", price_minor: 345000, available: true } as never;
const render = (withWishlist: boolean) => {
  const button = createElement(AddToBag, { product, selectedOptions: {} });
  // Providers are typed with required `children`; createElement's own children argument is what the lint rule wants.
  const inner = withWishlist ? createElement(WishlistProvider as never, { storeSlug: "s", persist: false }, button) : button;
  return renderToStaticMarkup(createElement(CartProvider as never, { storeSlug: "s", currency: "INR", persist: false }, inner));
};

describe("product page: wishlist next to Add to bag", () => {
  it("shows an Add to wishlist heart beside Add to bag", () => {
    const html = render(true);
    expect(html).toContain("Add to bag");
    expect(html).toContain('aria-label="Add to wishlist"');
    expect(html).toContain('aria-pressed="false"');
  });

  it("shows no heart where the store has no wishlist", () => {
    expect(render(false)).not.toContain("wishlist");
  });
});

describe("product page: the Add to bag label is the store's shopping wording", () => {
  const theme = (label: unknown) => ({ schemaVersion: 1, settings: { brand: { look: "boutique" }, productCards: { addToBagLabel: label } } });
  const renderWith = (product: Record<string, unknown>, selected: Record<string, string>, themeValue?: unknown) => {
    const button = createElement(AddToBag, { product: product as never, selectedOptions: selected });
    const cart = createElement(CartProvider as never, { storeSlug: "s", currency: "INR", persist: false }, button);
    return renderToStaticMarkup(createElement(StorefrontContext.Provider, { value: { store: {}, theme: themeValue } as never }, cart));
  };
  const plain = { name: "Linen Dress", slug: "linen", price_minor: 345000, available: true };
  const withVariants = { ...plain, variants: [{ id: "v1", title: "S", price_minor: 345000, option_values: { Size: "S" } }] };

  it("keeps the original label when the theme has no wording, or no theme at all", () => {
    expect(renderWith(plain, {})).toContain(">Add to bag<");
    expect(renderWith(plain, {}, { schemaVersion: 1, settings: {} })).toContain(">Add to bag<");
    expect(renderWith(plain, {}, theme("   "))).toContain(">Add to bag<");
  });

  it("shows the custom label, trimmed", () => {
    const html = renderWith(plain, {}, theme("  Buy now "));
    expect(html).toContain(">Buy now<");
    expect(html).not.toContain(">Add to bag<");
  });

  it("leaves Sold out and Select options alone", () => {
    const soldOut = renderWith({ ...plain, available: false }, {}, theme("Buy now"));
    expect(soldOut).toContain(">Sold out<");
    expect(soldOut).not.toContain(">Buy now<");
    const needsOptions = renderWith(withVariants, {}, theme("Buy now"));
    expect(needsOptions).toContain(">Select options<");
    expect(needsOptions).not.toContain(">Buy now<");
    // Once an option is chosen the custom label comes back.
    expect(renderWith(withVariants, { Size: "S" }, theme("Buy now"))).toContain(">Buy now<");
  });

  it("keeps the wishlist heart and its own labels", () => {
    const html = renderToStaticMarkup(
      createElement(StorefrontContext.Provider, { value: { store: {}, theme: theme("Buy now") } as never },
        createElement(CartProvider as never, { storeSlug: "s", currency: "INR", persist: false },
          createElement(WishlistProvider as never, { storeSlug: "s", persist: false }, createElement(AddToBag, { product: plain as never, selectedOptions: {} })))),
    );
    expect(html).toContain('aria-label="Add to wishlist"');
    expect(html).toContain(">Buy now<");
  });
});
