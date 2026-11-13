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

import { TemplateRenderer } from "@/components/storefront/engine/renderer";
import type { RenderContext } from "@/components/storefront/engine/types";
import type { TemplateDocument } from "@/lib/templates/document";
import { hasTheme, themeToStyle } from "@/lib/templates/engine/theme-style";
import { balancedColumns, gridColumns } from "@/components/storefront/engine/ui";

const store = {
  name: "Maison",
  slug: "maison",
  description: "A store",
  logo_path: null,
  currency: "INR",
  products: [
    { name: "Linen Shirt", slug: "linen-shirt", short_description: null, price_minor: 99900, compare_at_price_minor: 129900, image_path: null },
    { name: "Wool Scarf", slug: "wool-scarf", short_description: null, price_minor: 49900, compare_at_price_minor: null, image_path: null },
  ],
};

const theme = { settings: { colors: { primary: "#171717", accent: "#9a3412", background: "#faf7f2", text: "#1c1917", muted: "#a8a29e" } } };

const heroDoc = (settings: Record<string, unknown>): TemplateDocument => ({
  schemaVersion: 1,
  layout: "classic",
  order: ["hero"],
  sections: { hero: { type: "hero", settings: { heading: "The Autumn Edit", subheading: "Made to last", ...settings }, blocks: {}, block_order: [] } },
});

const render = (document: TemplateDocument, context: Partial<RenderContext> = {}) =>
  renderToStaticMarkup(createElement(TemplateRenderer, { document, mode: "public", context: { store, ...context } }));

describe("theme tokens", () => {
  it("derives readable secondary text, neutral surfaces and a colourful placeholder tint", () => {
    const style = themeToStyle(theme);
    expect(hasTheme(theme)).toBe(true);
    expect(style["--muted-foreground"]).toContain("var(--foreground) 68%");
    expect(style["--surface"]).toContain("var(--tint");
    // A near-black primary would make every placeholder grey, so the accent is used instead.
    expect(style["--tint"]).toBe("#9a3412");
  });
  it("uses a colourful primary as the tint", () => {
    expect(themeToStyle({ settings: { colors: { primary: "#15803d", accent: "#ea580c", background: "#ffffff", text: "#111111" } } })["--tint"]).toBe("#15803d");
  });
  it("reports no theme for empty settings", () => {
    expect(hasTheme(null)).toBe(false);
    expect(hasTheme({})).toBe(false);
  });
});

describe("hero variants", () => {
  const image = { asset: "atelier/hero.svg" };

  it("banner: a full-bleed picture with the text over it, shrinking height on small screens", () => {
    const html = render(heroDoc({ variant: "banner", height: "large", image }), { theme });
    expect(html).toContain('src="/themes/atelier/hero.svg"');
    expect(html).toContain("<h1");
    expect(html).toContain("The Autumn Edit");
    expect(html).toContain("min-h-[540px] sm:min-h-[640px] lg:min-h-[760px]");
  });

  it("banner without a picture shows a themed panel, not a broken image", () => {
    const html = render(heroDoc({ variant: "banner" }), { theme });
    expect(html).not.toContain("<img");
    expect(html).toContain("var(--tint");
  });

  it("dark text on a light picture lightens instead of darkening it", () => {
    const html = render(heroDoc({ variant: "banner", textTone: "dark", overlay: 20, image }), { theme });
    expect(html).toContain("rgba(255,255,255,0.2)");
    expect(html).not.toContain("text-white");
  });

  it("split: text and picture side by side from desktop width, stacked on phones", () => {
    const html = render(heroDoc({ variant: "split", image }), { theme });
    expect(html).toContain("lg:grid-cols-2");
    expect(html).toContain('src="/themes/atelier/hero.svg"');
  });

  it("keeps the built-in markup for stores without a theme", () => {
    const html = render(heroDoc({ variant: "classic", image }));
    expect(html).not.toContain("lg:grid-cols-2");
    expect(html).toContain("aspect-[16/5]");
  });
});

describe("header", () => {
  const header: TemplateDocument = {
    schemaVersion: 1,
    layout: "classic",
    order: ["header"],
    sections: {
      header: { type: "header", settings: {}, blocks: { a: { type: "link", settings: { label: "Shop", url: "/products" }, blocks: {}, block_order: [] } }, block_order: ["a"] },
    },
  };
  it("shows the menu on desktop and a menu button on phones, plus search", () => {
    const html = render(heroDoc({}), { theme, groupHeader: header });
    expect(html).toContain('aria-label="Open menu"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('href="/search"');
    expect(html).toContain("Shop");
  });
});

describe("grids", () => {
  it("fills rows: eight products in six columns become four", () => {
    expect(balancedColumns(8, 6)).toBe(4);
    expect(balancedColumns(12, 6)).toBe(6);
    expect(balancedColumns(5, 6)).toBe(6);
    expect(balancedColumns(7, 4)).toBe(4);
  });
  it("is two columns on phones at every setting", () => {
    for (const n of [2, 3, 4, 5, 6]) expect(gridColumns(n)).toContain("grid-cols-2");
  });
});
