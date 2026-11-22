import { createElement, type CSSProperties } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/image", async () => {
  const { createElement: h } = await import("react");
  return {
    default: (p: { src: string; alt: string; style?: CSSProperties; className?: string }) => h("img", { src: p.src, alt: p.alt, style: p.style, className: p.className }),
  };
});
vi.mock("next/link", async () => {
  const { createElement: h } = await import("react");
  return { default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => h("a", { href, ...rest }, children) };
});

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));
import { TemplateRenderer } from "@/components/storefront/engine/renderer";
import type { RenderContext } from "@/components/storefront/engine/types";
import type { TemplateDocument } from "@/lib/templates/document";

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
});

const node = (type: string, settings: Record<string, unknown> = {}) => ({ type, settings, blocks: {}, block_order: [] as string[] });

/** A product page with every hideable item on it. */
const page = (mainSettings: Record<string, unknown> = {}): TemplateDocument => ({
  schemaVersion: 1,
  layout: "classic",
  sections: {
    main: {
      type: "main-product",
      settings: mainSettings,
      blocks: {
        title: node("product-title", { level: "h1" }),
        price: node("product-price", {}),
        type: node("product-type", {}),
        category: node("product-category", {}),
        sku: node("product-sku", { prefix: "SKU:" }),
        desc: node("product-description", {}),
        share: node("social-share", { title: "Share it" }),
      },
      block_order: ["title", "price", "type", "category", "sku", "desc", "share"],
    },
    related: { type: "related-products", settings: { heading: "More like this" }, blocks: {}, block_order: [] },
  },
  order: ["main", "related"],
});

const product = (name: string, extra: Record<string, unknown> = {}) => ({
  name,
  slug: name.toLowerCase(),
  short_description: `About ${name}`,
  price_minor: 10000,
  compare_at_price_minor: null,
  sku: `${name}-SKU`,
  type: `${name}-type`,
  category: `${name}-category`,
  image_path: "t/p/first.webp",
  images: ["t/p/first.webp", "t/p/second.webp", "t/p/third.webp"],
  options: [],
  variants: [],
  related: [{ name: "Neighbour", slug: "neighbour", price_minor: 500, image_path: "t/p/n.webp" }],
  ...extra,
});

const store = { name: "Shop", slug: "shop", description: null, logo_path: null, currency: "INR", products: [] };
const render = (doc: TemplateDocument, resource: Record<string, unknown>, look = "standard") => {
  const context: RenderContext = { store, resource, collections: [], theme: { settings: { brand: { look } } } } as RenderContext;
  return renderToStaticMarkup(createElement(TemplateRenderer, { document: doc, context, mode: "public" }));
};


/** AC-PP-1: a product's hidden blocks apply on every look, not only on the engine's own product page (defect D-009). */
describe.each(["standard", "boutique", "sport", "market"])("per-product hidden blocks on the %s look", (look) => {
  it("hides exactly what the product hides and nothing on other products", () => {
    const shown = render(page(), product("Tee"), look);
    expect(shown).toContain("About Tee");
    expect(shown).toContain("More like this");
    const hidden = render(page(), product("Tee", { presentation: { schemaVersion: 1, hiddenBlocks: ["product-description", "product-sku", "product-type", "product-category", "social-share", "related-products"] } }), look);
    expect(hidden).not.toContain("More like this");
    expect(hidden).not.toContain("Share it");
    expect(hidden).not.toContain("Tee-SKU");
    expect(hidden).not.toContain("Tee-category");
    expect(hidden).toContain("Tee"); // the title is not hideable
    expect(render(page(), product("Other"), look)).toContain("More like this");
  });
});
