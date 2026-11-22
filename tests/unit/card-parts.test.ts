import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/image", async () => {
  const { createElement: h } = await import("react");
  return { default: (p: { src: string; alt: string; className?: string }) => h("img", { src: p.src, alt: p.alt, className: p.className }) };
});
vi.mock("next/link", async () => {
  const { createElement: h } = await import("react");
  return { default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => h("a", { href, ...rest }, children) };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }), usePathname: () => "/" }));

import { BoutiqueProductCard } from "@/components/storefront/engine/looks/boutique/product-card";
import { MarketProductCard } from "@/components/storefront/engine/looks/market/product-card";
import { SportProductCard } from "@/components/storefront/engine/looks/sport/product-card";
import { ProductCard, type CardProduct } from "@/components/storefront/engine/ui";
import { CARD_PARTS, availableCardParts, cardPartSettings, descriptionOnByDefault, readCardParts } from "@/lib/templates/card-parts";
import { getRegistry } from "@/lib/templates/registry/index";

const product: CardProduct = { name: "Linen Throw", slug: "linen-throw", short_description: "Soft and heavy", price_minor: 4500, compare_at_price_minor: 6000, image_path: null, available: true };
const html = (el: React.ReactElement) => renderToStaticMarkup(el);

describe("card parts settings", () => {
  it("treats a part nobody chose as on, except the description which follows the look", () => {
    expect(readCardParts(undefined, false)).toMatchObject({ image: true, title: true, price: true, comparePrice: true, badge: true, quickAdd: true, description: false });
    expect(readCardParts({}, true).description).toBe(true);
  });

  it("follows an explicit choice, on or off", () => {
    expect(readCardParts({ showPrice: false, showDescription: true }, false)).toMatchObject({ price: false, description: true });
    // Anything that is not a boolean is ignored.
    expect(readCardParts({ showPrice: "no" }, false).price).toBe(true);
  });

  it("offers quick add only to looks whose cards have it", () => {
    for (const look of ["boutique", "sport", "market"]) expect(availableCardParts(look)).toContain("quickAdd");
    for (const look of [undefined, "standard"]) expect(availableCardParts(look)).not.toContain("quickAdd");
    expect(availableCardParts("boutique")).toHaveLength(CARD_PARTS.length);
  });

  it("keeps the description defaults the cards always had", () => {
    expect(descriptionOnByDefault("boutique", false)).toBe(true);
    expect(descriptionOnByDefault("sport", false)).toBe(true);
    expect(descriptionOnByDefault("market", true)).toBe(false);
    expect(descriptionOnByDefault(undefined, true)).toBe(true);
    expect(descriptionOnByDefault(undefined, false)).toBe(false);
  });

  it("is registered on every section that lists products, new sections starting with the description off", () => {
    const registry = getRegistry();
    for (const type of ["product-grid", "featured-collection", "related-products"]) {
      const ids = registry.sections[type].settings.map((d) => d.id);
      for (const d of cardPartSettings) expect(ids).toContain(d.id);
    }
    expect(cardPartSettings.every((d) => d.type === "toggle" && d.default === (d.id !== "showDescription"))).toBe(true);
  });
});

describe("cards draw only the parts that are on", () => {
  const all = readCardParts(undefined, true);
  const cards: [string, (parts: ReturnType<typeof readCardParts>) => React.ReactElement][] = [
    ["standard", (parts) => createElement(ProductCard, { product, currency: "INR", href: "/products/linen-throw", parts })],
    ["boutique", (parts) => createElement(BoutiqueProductCard, { product, currency: "INR", href: "/products/linen-throw", parts })],
    ["sport", (parts) => createElement(SportProductCard, { product, currency: "INR", href: "/products/linen-throw", parts })],
    ["market", (parts) => createElement(MarketProductCard, { product, currency: "INR", href: "/products/linen-throw", parts })],
  ];

  for (const [name, card] of cards) {
    it(`${name}: shows the name and description, and drops them when removed`, () => {
      const on = html(card(all));
      expect(on).toContain("Linen Throw");
      const off = html(card({ ...all, title: false, description: false }));
      expect(off).not.toContain("Linen Throw");
      expect(off).not.toContain("Soft and heavy");
    });

    it(`${name}: the card root is marked so the editor can select one card`, () => {
      expect(html(card(all)).match(/data-sf-card/g)).toHaveLength(1);
    });

    it(`${name}: price and compare-at price go on their own`, () => {
      const base = html(card(all));
      expect(base).toContain("line-through");
      const noCompare = html(card({ ...all, comparePrice: false }));
      expect(noCompare).not.toContain("line-through");
      const none = html(card({ ...all, price: false, comparePrice: false }));
      expect(none.length).toBeLessThan(base.length);
      expect(none).not.toContain("line-through");
    });

    it(`${name}: removing the image removes the picture and its tag`, () => {
      const noImage = html(card({ ...all, image: false }));
      expect(noImage).not.toMatch(/aspect-/);
      expect(noImage).not.toMatch(/>Sale<|>Reduced</);
      expect(noImage).toContain("Linen Throw");
    });

    it(`${name}: the sale tag can be removed alone`, () => {
      const withTag = html(card(all));
      expect(withTag).toMatch(/>Sale<|>Reduced</);
      const without = html(card({ ...all, badge: false }));
      expect(without).not.toMatch(/>Sale<|>Reduced</);
      expect(without).toMatch(/aspect-/);
    });
  }
});
