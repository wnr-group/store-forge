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

import { LOOKS, lookCard, lookSection } from "@/components/storefront/engine/looks";
import { MarketCollectionList } from "@/components/storefront/engine/looks/market/collection-list";
import { MarketFeaturedCollection } from "@/components/storefront/engine/looks/market/featured-collection";
import { MarketFooter } from "@/components/storefront/engine/looks/market/footer";
import { MarketHeader } from "@/components/storefront/engine/looks/market/header";
import { MarketHero } from "@/components/storefront/engine/looks/market/hero";
import { MarketListing } from "@/components/storefront/engine/looks/market/listing";
import { MarketRichText } from "@/components/storefront/engine/looks/market/rich-text";
import { BoutiqueRichText } from "@/components/storefront/engine/looks/boutique/rich-text";
import { SportRichText } from "@/components/storefront/engine/looks/sport/rich-text";
import { MarketSearch } from "@/components/storefront/engine/looks/market/search";
import { searchUrl } from "@/components/storefront/engine/use-search-submit";
import { MarketProductCard } from "@/components/storefront/engine/looks/market/product-card";
import { discount } from "@/components/storefront/engine/looks/market/ui";
import { lookOf, themeToStyle } from "@/lib/templates/engine/theme-style";

vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");

const marketTheme = { settings: { brand: { look: "market" }, colors: { primary: "#0d1420", secondary: "#106762", accent: "#ff5a17", background: "#f6f7f9", text: "#1b2435" }, typography: { headingFont: "plus-jakarta-sans", bodyFont: "inter", headingWeight: 700 } } };
const ctx = (extra: Record<string, unknown> = {}) => ({ store: { name: "Bazaar", slug: "b", currency: "INR" }, theme: marketTheme, mode: "public", ...extra }) as never;
const node = (type: string, settings: Record<string, unknown> = {}, blocks: Record<string, unknown> = {}) => ({ type, settings, blocks, block_order: Object.keys(blocks) }) as never;
const col = (i: number) => ({ id: `c${i}`, name: `Collection ${i}`, slug: `c${i}`, image_path: null, product_count: i });
const product = (i: number, extra: Record<string, unknown> = {}) => ({ name: `Item ${i}`, slug: `i${i}`, price_minor: 10000 * i, ...extra });

describe("market look registration", () => {
  it("is selected by settings.brand.look and draws its own sections and product card", () => {
    expect(lookOf(marketTheme)).toBe("market");
    for (const type of ["header", "footer", "hero", "collection-list", "featured-collection", "product-grid", "main-product", "related-products"]) {
      expect(lookSection(marketTheme, type)).toBeDefined();
    }
    expect(lookCard(marketTheme)).toBe(MarketProductCard);
    expect(LOOKS.market.cart).toBe(true);
  });

  it("keeps the theme colours on the wrapper so the dark ink, teal and orange come through", () => {
    const style = themeToStyle(marketTheme);
    expect(style["--primary"]).toBe("#0d1420");
    expect(style["--secondary"]).toBe("#106762");
    expect(style["--accent"]).toBe("#ff5a17");
  });
});

describe("market rendering", () => {
  it("shows a sale tag and the discount on a card, and a disabled button on a sold-out one", () => {
    expect(discount(80000, 100000)).toBe(20);
    expect(discount(100000, 80000)).toBe(0);
    const sale = renderToStaticMarkup(createElement(MarketProductCard, { product: product(8, { compare_at_price_minor: 100000 }), currency: "INR", href: "/products/i8" }));
    expect(sale).toContain("Sale");
    expect(sale).toContain("20% off");
    const sold = renderToStaticMarkup(createElement(MarketProductCard, { product: product(5, { available: false }), currency: "INR", href: "/products/i5" }));
    expect(sold).toContain("Sold out");
    expect(sold).toContain("Out of stock");
    expect(sold).toContain("disabled");
  });

  it("draws collections as shortcut tiles, or as cards under a title with See all", () => {
    const six = [1, 2, 3, 4, 5, 6].map(col);
    const tiles = renderToStaticMarkup(createElement(MarketCollectionList, { node: node("collection-list", { layout: "auto" }), context: ctx({ collections: six }) }));
    expect(tiles.match(/Collection \d/g)).toHaveLength(6);
    expect(tiles).not.toContain("See all");
    const cards = renderToStaticMarkup(createElement(MarketCollectionList, { node: node("collection-list", { title: "Shop by category", layout: "grid", columns: 4, showProductCount: true }), context: ctx({ collections: six }) }));
    expect(cards).toContain("Shop by category");
    expect(cards).toContain("See all");
    expect(cards).toContain("3 items");
  });

  it("draws a shelf of the newest products and never invents any", () => {
    const store = { name: "Bazaar", slug: "b", currency: "INR", products: [1, 2, 3].map((i) => product(i)) };
    const shelf = renderToStaticMarkup(createElement(MarketFeaturedCollection, { node: node("featured-collection", { title: "New arrivals", productsToShow: 2 }), context: ctx({ store }) }));
    expect(shelf).toContain("New arrivals");
    expect(shelf).toContain("Item 1");
    expect(shelf).toContain("Item 2");
    expect(shelf).not.toContain("Item 3");
    const empty = renderToStaticMarkup(createElement(MarketFeaturedCollection, { node: node("featured-collection", { title: "Picked", collectionId: "gone" }), context: ctx() }));
    expect(empty).toBe("");
  });

  it("draws the hero from its slide blocks, with a gradient when a slide has no picture", () => {
    const blocks = { s1: { type: "hero-slide", settings: { mediaType: "image", heading: "Everything in one place", subheading: "Browse the range", buttonLabel: "Shop now", link: "/products" }, blocks: {}, block_order: [] } };
    const html = renderToStaticMarkup(createElement(MarketHero, { node: node("hero", { eyebrow: "Just in" }, blocks), context: ctx() }));
    expect(html).toContain("Everything in one place");
    expect(html).toContain("Just in");
    expect(html).toContain('href="/products"');
    expect(html).toContain("<svg");
  });

  it("draws the header with a search form, the collections row and the call-to-action", () => {
    const blocks = {
      l1: { type: "link", settings: { label: "About", url: "/about" }, blocks: {}, block_order: [] },
      cta: { type: "button", settings: { label: "Top picks", link: "/products" }, blocks: {}, block_order: [] },
    };
    const html = renderToStaticMarkup(createElement(MarketHeader, { node: node("header", {}, blocks), context: ctx({ collections: [col(1), col(2)] }) }));
    expect(html).toContain('action="/search"');
    expect(html).toContain("All categories");
    expect(html).toContain("Collection 1");
    expect(html).toContain("Top picks");
  });

  it("moves a footer with no colour to the ink and leaves a chosen colour alone", () => {
    const plain = renderToStaticMarkup(createElement(MarketFooter, { node: node("footer", {}), context: ctx() }));
    expect(plain).toContain("#0d1420");
    const chosen = renderToStaticMarkup(createElement(MarketFooter, { node: node("footer", { backgroundColor: "#123456", textColor: "#ffffff" }), context: ctx() }));
    expect(chosen).toContain("#123456");
    expect(chosen).not.toContain("#0d1420");
  });

  it("lists products with a filter panel, a count and a sort menu", () => {
    const products = [1, 2, 3, 4].map((i) => product(i));
    const html = renderToStaticMarkup(createElement(MarketListing, { products, currency: "INR", columns: 4, basePath: "", linked: true, collections: [{ slug: "men", name: "Men" }], activeCollection: null }));
    expect(html).toContain("Filters");
    expect(html).toContain("Sort products");
    expect(html).toContain("Men");
    expect(html.match(/Item \d/g)).toHaveLength(4);
  });
});

describe("search page", () => {
  const intro = (title: string) => node("rich-text", {}, { title: { type: "heading", settings: { text: title }, blocks: {}, block_order: [] }, note: { type: "text", settings: { content: "2 results" }, blocks: {}, block_order: [] } });
  for (const [name, Section] of [["market", MarketRichText], ["sport", SportRichText], ["boutique", BoutiqueRichText]] as const) {
    it(`${name}: shows a search field holding the term, posting to the store's own /search`, () => {
      const html = renderToStaticMarkup(createElement(Section, { node: intro("Search: linen"), context: ctx({ basePath: "/s/b" }), sectionId: "intro" }));
      expect(html).toContain('action="/s/b/search"');
      expect(html).toContain('name="q"');
      expect(html).toContain('value="linen"');
    });
    it(`${name}: leaves other rich text without a search field`, () => {
      const html = renderToStaticMarkup(createElement(Section, { node: intro("All products"), context: ctx(), sectionId: "intro" }));
      expect(html).not.toContain('name="q"');
    });
  }
});

describe("market search bar", () => {
  it("builds the search address, with the category only when one is chosen", () => {
    expect(searchUrl("/search", " linen shirt ", "all")).toBe("/search?q=linen+shirt");
    expect(searchUrl("/search", "linen", "men")).toBe("/search?q=linen&cat=men");
    expect(searchUrl("/s/b/search", "", null)).toBe("/s/b/search");
  });

  it("draws a category menu, the field with the real product count and an orange search button", () => {
    const html = renderToStaticMarkup(createElement(MarketSearch, { storeSlug: "b", storeName: "Bazaar", currency: "INR", products: [{ name: "Linen Shirt", slug: "l", price_minor: 100000 }, { name: "Scarf", slug: "s", price_minor: 50000 }], collections: [{ name: "Men", slug: "men" }], action: "/search" }));
    expect(html).toContain('name="cat"');
    expect(html).toContain("All categories");
    expect(html).toContain("Men");
    expect(html).toContain('placeholder="Search 2 products in Bazaar"');
    expect(html).toContain('aria-label="Search"');
    expect(html).toContain("bg-accent");
  });

  it("leaves out the category menu for a store with no collections", () => {
    const html = renderToStaticMarkup(createElement(MarketSearch, { storeSlug: "b", storeName: "Bazaar", currency: "INR", products: [], collections: [], action: "/search" }));
    expect(html).not.toContain('name="cat"');
    expect(html).toContain('placeholder="Search Bazaar"');
  });
});
