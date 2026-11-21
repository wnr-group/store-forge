import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Pictures are served from the storage bucket; without its address a collection card draws no <img> at all.
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://storage.example.test");

vi.mock("next/image", async () => {
  const { createElement: h } = await import("react");
  return { default: (p: { src: string; alt: string }) => h("img", { src: p.src, alt: p.alt }) };
});
vi.mock("next/link", async () => {
  const { createElement: h } = await import("react");
  return { default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => h("a", { href, ...rest }, children) };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }), usePathname: () => "/" }));

import { CollectionListSection } from "@/components/storefront/engine/sections/collection-list";
import { BoutiqueCollectionList } from "@/components/storefront/engine/looks/boutique/collection-list";
import { MarketCollectionList } from "@/components/storefront/engine/looks/market/collection-list";
import { SportCollectionList } from "@/components/storefront/engine/looks/sport/collection-list";
import { COLLECTION_CARD_PARTS, cardKindOf, collectionCardPartSettings, countOnByDefault, readCollectionCardParts } from "@/lib/templates/card-parts";
import { getRegistry } from "@/lib/templates/registry/index";

const collections = [{ id: "c-1", name: "Summer Linen", slug: "summer-linen", description: null, image_path: "shop/a.jpg", product_count: 7 }];
const context = { store: { name: "S", slug: "s", currency: "INR", products: [] }, collections, mode: "editor" } as never;
const html = (node: { type: string; settings: Record<string, unknown>; blocks: object; block_order: string[] }, Section: React.ComponentType<never>) => renderToStaticMarkup(createElement(Section as never, { node, context, sectionId: "s1" }));
const node = (settings: Record<string, unknown>) => ({ type: "collection-list", settings, blocks: {}, block_order: [] });

describe("collection card settings", () => {
  it("every part is on unless chosen off; the count follows the look", () => {
    expect(readCollectionCardParts(undefined, true)).toEqual({ image: true, title: true, count: true });
    expect(readCollectionCardParts({ showTitle: false, showImage: false }, true)).toEqual({ image: false, title: false, count: true });
    expect(readCollectionCardParts({}, false).count).toBe(false);
    expect(readCollectionCardParts({ showProductCount: true }, false).count).toBe(true);
    expect(countOnByDefault("market")).toBe(false);
    expect(countOnByDefault("sport")).toBe(false);
    expect(countOnByDefault("boutique")).toBe(true);
    expect(countOnByDefault(undefined)).toBe(true);
  });

  it("is registered on the collection list with the product count reusing its own setting", () => {
    const ids = getRegistry().sections["collection-list"].settings.map((d) => d.id);
    for (const d of collectionCardPartSettings) expect(ids).toContain(d.id);
    expect(collectionCardPartSettings.map((d) => d.id)).toEqual(["showImage", "showTitle"]);
    expect(ids.filter((id) => id === "showProductCount")).toHaveLength(1);
    expect(COLLECTION_CARD_PARTS.map((p) => p.setting)).toEqual(["showImage", "showTitle", "showProductCount"]);
  });

  it("tells product cards from collection cards by section type", () => {
    expect(cardKindOf("product-grid")).toBe("product");
    expect(cardKindOf("collection-list")).toBe("collection");
    expect(cardKindOf("hero")).toBeNull();
    expect(cardKindOf(undefined)).toBeNull();
  });
});

describe("collection cards draw only the parts that are on", () => {
  const layouts: [string, React.ComponentType<never>, Record<string, unknown>][] = [
    ["standard grid", CollectionListSection as never, { layout: "grid" }],
    ["standard editorial", CollectionListSection as never, { layout: "editorial" }],
    ["boutique", BoutiqueCollectionList as never, {}],
    ["market tiles", MarketCollectionList as never, {}],
    ["market panel", MarketCollectionList as never, { layout: "grid", showProductCount: true }],
    ["sport compact", SportCollectionList as never, { showProductCount: true }],
    ["sport grid", SportCollectionList as never, { layout: "grid", showProductCount: true }],
    ["sport editorial", SportCollectionList as never, { layout: "editorial", showProductCount: true }],
  ];

  for (const [name, Section, base] of layouts) {
    it(`${name}: the card is marked with its collection so the editor can select it`, () => {
      const out = html(node(base), Section);
      expect(out.match(/data-sf-card/g)).toHaveLength(1);
      expect(out).toContain('data-sf-collection="c-1"');
    });

    it(`${name}: the name and the picture can be removed on their own`, () => {
      const on = html(node(base), Section);
      // The visible name, not the picture's alt text (which keeps the name for screen readers).
      expect(on).toMatch(/>Summer Linen</);
      expect(on).toContain("<img");
      const noName = html(node({ ...base, showTitle: false }), Section);
      expect(noName).not.toMatch(/>Summer Linen</);
      const noImage = html(node({ ...base, showImage: false }), Section);
      expect(noImage).not.toContain("<img");
      expect(noImage).toMatch(/>Summer Linen</);
    });
  }

  it("the product count still has its own switch", () => {
    expect(html(node({ layout: "grid", showProductCount: true }), CollectionListSection as never)).toContain("7 products");
    expect(html(node({ layout: "grid", showProductCount: false }), CollectionListSection as never)).not.toContain("7 products");
  });
});
