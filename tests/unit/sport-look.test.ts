import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/image", async () => {
  const { createElement: h } = await import("react");
  return { default: (p: { src: string; alt: string }) => h("img", { src: p.src, alt: p.alt }) };
});
vi.mock("next/link", async () => {
  const { createElement: h } = await import("react");
  return { default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => h("a", { href, ...rest }, children) };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }), usePathname: () => "/" }));

import { LOOKS, lookCard, lookSection } from "@/components/storefront/engine/looks";
import { splitHeading } from "@/components/storefront/engine/looks/sport/hero-slider";
import { SportHero } from "@/components/storefront/engine/looks/sport/hero";
import { parseRow, SportImageWithText } from "@/components/storefront/engine/looks/sport/image-with-text";
import { toMinor } from "@/components/storefront/engine/looks/sport/listing";
import { SportCollectionList } from "@/components/storefront/engine/looks/sport/collection-list";
import { SportProductCard } from "@/components/storefront/engine/looks/sport/product-card";
import { Highlighted } from "@/components/storefront/engine/looks/sport/ui";
import { themeSettingsSchema } from "@/lib/templates/engine/root-schema";
import { themeToStyle, lookOf } from "@/lib/templates/engine/theme-style";

vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");

const sportTheme = { settings: { brand: { look: "sport" }, colors: { primary: "#0d1033", secondary: "#272f86", accent: "#fbc826", background: "#ffffff", text: "#0d1033" }, typography: { headingFont: "archivo", bodyFont: "plus-jakarta-sans", headingWeight: 800 } } };

describe("sport look registration", () => {
  it("is selected by settings.brand.look and draws its own sections and product card", () => {
    expect(lookOf(sportTheme)).toBe("sport");
    expect(lookSection(sportTheme, "hero")).toBe(SportHero);
    expect(lookSection(sportTheme, "footer")).toBeUndefined();
    expect(lookCard(sportTheme)).toBe(SportProductCard);
    expect(LOOKS.sport.cart).toBe(true);
  });

  it("the theme schema accepts the sport look and its fonts", () => {
    expect(themeSettingsSchema.safeParse({ schemaVersion: 1, settings: sportTheme.settings }).success).toBe(true);
  });

  it("tints soft panels with the secondary colour (lavender), not the yellow accent", () => {
    const style = themeToStyle(sportTheme);
    expect(style["--tint"]).toBe("#272f86");
    // A look that does not ask for it keeps the engine's rule (the accent when the primary is dark and grey-ish).
    expect(themeToStyle({ settings: { colors: { primary: "#0d1033", secondary: "#272f86", accent: "#fbc826" } } })["--tint"]).toBe("#fbc826");
  });
});

describe("sport text conventions", () => {
  it("reads bullet, stat and feature rows, and leaves paragraphs alone", () => {
    expect(parseRow("• Gents wear")).toEqual({ kind: "bullet", text: "Gents wear" });
    expect(parseRow("1979 | The trade begins")).toEqual({ kind: "stat", value: "1979", text: "The trade begins" });
    expect(parseRow("Quality policy :: We check every piece")).toEqual({ kind: "feature", title: "Quality policy", text: "We check every piece" });
    expect(parseRow("Just a sentence.")).toBeNull();
    expect(parseRow("This value is far too long to be a stat | text")).toBeNull();
  });

  it("splits a headline so the first sentence is white and the rest yellow", () => {
    expect(splitHeading("Move better. Live brighter.")).toEqual(["Move better.", "Live brighter."]);
    expect(splitHeading("One sentence only")).toEqual(["One sentence only", ""]);
    expect(splitHeading("Built to move. Made to last. Always.")[1]).toBe("Made to last. Always.");
  });

  it("colours {{marked}} words in a heading", () => {
    const html = renderToStaticMarkup(createElement(Highlighted, { text: "Good {{quality}} wear", className: "hl" }));
    expect(html).toContain('<span class="hl">quality</span>');
    expect(html).toContain("<span>Good </span>");
  });

  it("turns a typed price into minor units", () => {
    expect(toMinor("1,250.50", 2)).toBe(125050);
    expect(toMinor("300", 2)).toBe(30000);
    expect(toMinor("", 2)).toBeNull();
    expect(toMinor("abc", 2)).toBeNull();
  });
});

describe("sport rendering", () => {
  const ctx = (extra: Record<string, unknown> = {}) => ({ store: { name: "Stride", slug: "s", currency: "INR" }, theme: sportTheme, mode: "public", ...extra }) as never;
  const col = (i: number) => ({ id: `c${i}`, name: `Collection ${i}`, slug: `c${i}`, image_path: null, product_count: i });
  const six = [1, 2, 3, 4, 5, 6].map(col);

  it("shows every collection in the compact layout but only as many as columns in the big-card layout", () => {
    const compact = renderToStaticMarkup(createElement(SportCollectionList, { node: { type: "collection-list", settings: { title: "Range", layout: "auto", columns: 6 }, blocks: {}, block_order: [] } as never, context: ctx({ collections: six }) }));
    const overlay = renderToStaticMarkup(createElement(SportCollectionList, { node: { type: "collection-list", settings: { title: "Shop by category", layout: "grid", columns: 4 }, blocks: {}, block_order: [] } as never, context: ctx({ collections: six }) }));
    expect(compact.match(/Collection \d/g)).toHaveLength(6);
    expect(overlay.match(/Collection \d/g)).toHaveLength(4);
    expect(overlay).toContain("Shop now");
  });

  it("renders image-with-text rows from text blocks", () => {
    const blocks = {
      h: { type: "heading", settings: { text: "Made {{well}}" }, blocks: {}, block_order: [] },
      s1: { type: "text", settings: { content: "Fabric | Soft and light" }, blocks: {}, block_order: [] },
      f1: { type: "text", settings: { content: "Quality policy :: We check it" }, blocks: {}, block_order: [] },
      b: { type: "button", settings: { label: "Shop", link: "/products", style: "primary" }, blocks: {}, block_order: [] },
    };
    const html = renderToStaticMarkup(createElement(SportImageWithText, { node: { type: "image-with-text", settings: { variant: "plain", eyebrow: "Our story" }, blocks, block_order: Object.keys(blocks) } as never, context: ctx() }));
    expect(html).toContain("Our story");
    expect(html).toContain("Soft and light");
    expect(html).toContain("Quality policy");
    expect(html).toContain('href="/products"');
  });

  it("shows a product with its discount chip, a sold-out one with a badge, and never invents products", () => {
    const sale = renderToStaticMarkup(createElement(SportProductCard, { product: { name: "Shorts", slug: "s", price_minor: 80000, compare_at_price_minor: 100000 }, currency: "INR", href: "/products/s" }));
    expect(sale).toContain("20% off");
    expect(sale).toContain("Sale");
    const sold = renderToStaticMarkup(createElement(SportProductCard, { product: { name: "Track", slug: "t", price_minor: 50000, available: false }, currency: "INR", href: "/products/t" }));
    expect(sold).toContain("Sold out");
  });
});
