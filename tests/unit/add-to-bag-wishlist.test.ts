import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/s/[slug]/cart/actions", () => ({ checkCartAction: async () => [] }));
vi.mock("@/app/s/[slug]/wishlist/actions", () => ({ checkWishlistAction: async () => [] }));

import { AddToBag } from "@/components/storefront/cart/add-to-bag";
import { CartProvider } from "@/components/storefront/cart/cart-provider";
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
