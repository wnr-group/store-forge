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
import { featuredCollectionSlugs, MAX_FEATURED_COLLECTIONS, resolveCollection } from "@/lib/storefront/featured";
import type { TemplateDocument } from "@/lib/templates/document";
import { hasStoreProducts, previewData } from "@/lib/themes/preview-data";
import { SAMPLE_PRODUCTS } from "@/lib/themes/sample-data";
import type { PreviewStoreData } from "@/lib/themes/types";

const product = (name: string, extra: Record<string, unknown> = {}) => ({
  name,
  slug: name.toLowerCase().replace(/\s+/g, "-"),
  short_description: null,
  price_minor: 99900,
  compare_at_price_minor: null,
  image_path: null,
  ...extra,
});

// Tenant A: a fashion catalogue. Tenant B: electronics. Different names everywhere.
const tenantA = { name: "Urban Nest", slug: "urban", description: null, logo_path: null, currency: "INR", products: [product("Linen Shirt"), product("Wool Scarf"), product("Sold Out Tee", { available: false })] };
const tenantB = { name: "Volt", slug: "volt", description: null, logo_path: null, currency: "INR", products: [product("Gaming Mouse"), product("USB Cable")] };
const collectionsA = [
  { id: "c-1", name: "Winter", slug: "winter", description: null, image_path: null, product_count: 1 },
  { id: "c-2", name: "Summer", slug: "summer", description: null, image_path: null, product_count: 0 },
];

const featured = (settings: Record<string, unknown> = {}): TemplateDocument => ({
  schemaVersion: 1,
  layout: "classic",
  order: ["feat"],
  sections: { feat: { type: "featured-collection", settings: { title: "New arrivals", productsToShow: 8, ...settings }, blocks: {}, block_order: [] } },
});
const grid: TemplateDocument = { schemaVersion: 1, layout: "classic", order: ["g"], sections: { g: { type: "product-grid", settings: {}, blocks: {}, block_order: [] } } };

const theme = { settings: { colors: { primary: "#171717", accent: "#9a3412", background: "#faf7f2", text: "#1c1917" } } };
const render = (document: TemplateDocument, context: Partial<RenderContext>) =>
  renderToStaticMarkup(createElement(TemplateRenderer, { document, mode: "public", context: { store: tenantA, theme, ...context } as RenderContext }));

describe("featured collection uses the tenant's own products", () => {
  it("with no collection chosen, shows the store's newest active products", () => {
    const html = render(featured(), {});
    expect(html).toContain("Linen Shirt");
    expect(html).toContain("Wool Scarf");
  });

  it("with a collection chosen, shows THAT collection's products, not the store's first ones", () => {
    const html = render(featured({ collectionId: "winter" }), { collections: collectionsA, collectionProducts: { winter: [product("Wool Scarf")] } });
    expect(html).toContain("Wool Scarf");
    expect(html).not.toContain("Linen Shirt");
    expect(html).toContain('href="/collections/winter"');
  });

  it("accepts the collection's id as well as its address", () => {
    const html = render(featured({ collectionId: "c-1" }), { collections: collectionsA, collectionProducts: { winter: [product("Wool Scarf")] } });
    expect(html).toContain("Wool Scarf");
    expect(html).not.toContain("Linen Shirt");
  });

  it("hides the section from shoppers when its collection is empty or deleted", () => {
    expect(render(featured({ collectionId: "summer" }), { collections: collectionsA, collectionProducts: { summer: [] } })).not.toContain("New arrivals");
    expect(render(featured({ collectionId: "gone" }), { collections: collectionsA, collectionProducts: {} })).not.toContain("New arrivals");
  });

  it("tells the merchant, not the shopper, why it is empty", () => {
    const html = renderToStaticMarkup(createElement(TemplateRenderer, { document: featured({ collectionId: "summer" }), mode: "preview", context: { store: tenantA, theme, collections: collectionsA, collectionProducts: { summer: [] } } as RenderContext }));
    expect(html).toContain("Nothing in Summer yet");
    expect(html).toContain("Add products in Products");
  });

  it("never mixes tenants: each renders only its own products", () => {
    const a = render(featured(), { store: tenantA });
    const b = render(featured(), { store: tenantB });
    expect(a).toContain("Linen Shirt");
    expect(a).not.toContain("Gaming Mouse");
    expect(b).toContain("Gaming Mouse");
    expect(b).not.toContain("Linen Shirt");
  });
});

describe("empty catalogues", () => {
  const empty = { ...tenantA, products: [] };
  it("shows a calm empty state to shoppers, with no invented products", () => {
    for (const doc of [featured(), grid]) {
      const html = render(doc, { store: empty });
      expect(html).toContain("New products are on their way");
      expect(html).not.toContain("Sample product");
      expect(html).not.toContain("Add products in Products");
    }
  });
  it("shows the merchant how to fill it", () => {
    const html = renderToStaticMarkup(createElement(TemplateRenderer, { document: grid, mode: "editor", context: { store: empty, theme } as RenderContext }));
    expect(html).toContain("No products to show yet");
    expect(html).toContain("Add products in Products");
  });
});

describe("sold out", () => {
  it("marks unavailable products on the card, and only those", () => {
    const html = render(featured(), {});
    expect(html).toContain("Sold out");
    expect(html.match(/Sold out/g)).toHaveLength(1);
  });
});

describe("preview data: store and demo never mix", () => {
  const real: PreviewStoreData = { store: tenantA, collections: collectionsA, collectionProducts: { winter: [product("Wool Scarf")] } };

  it("store mode is the tenant's data, untouched", () => {
    const p = previewData(real, "store");
    expect(p.store.products.map((x) => x.name)).toEqual(["Linen Shirt", "Wool Scarf", "Sold Out Tee"]);
    expect(p.collections).toEqual(collectionsA);
    expect(p.collectionProducts).toEqual(real.collectionProducts);
  });

  it("demo mode is sample content only, with the store's own identity", () => {
    const p = previewData(real, "demo");
    expect(p.store.name).toBe("Urban Nest");
    expect(p.store.products).toEqual(SAMPLE_PRODUCTS);
    expect(JSON.stringify(p)).not.toContain("Linen Shirt");
    expect(p.collections.every((c) => c.slug.startsWith("sample-"))).toBe(true);
  });

  it("does not fall back to demo when the store has no products", () => {
    const emptyStore: PreviewStoreData = { store: { ...tenantA, products: [] }, collections: [] };
    expect(hasStoreProducts(emptyStore)).toBe(false);
    expect(previewData(emptyStore, "store").store.products).toEqual([]);
  });

  it("never changes the data it is given", () => {
    const before = JSON.stringify(real);
    previewData(real, "demo");
    previewData(real, "store");
    expect(JSON.stringify(real)).toBe(before);
  });
});

describe("featuredCollectionSlugs", () => {
  const doc = (ids: string[]): TemplateDocument => ({
    schemaVersion: 1,
    layout: "classic",
    order: ids.map((_, i) => `s${i}`),
    sections: Object.fromEntries(ids.map((id, i) => [`s${i}`, { type: "featured-collection", settings: { collectionId: id }, blocks: {}, block_order: [] }])),
  });
  it("lists each referenced collection once, by slug, in page order", () => {
    expect(featuredCollectionSlugs([doc(["c-2", "winter", "summer", ""])], collectionsA)).toEqual(["summer", "winter"]);
  });
  it("ignores unknown collections and missing documents", () => {
    expect(featuredCollectionSlugs([null, undefined, doc(["nope"])], collectionsA)).toEqual([]);
  });
  it("skips disabled sections", () => {
    const d = doc(["winter"]);
    d.sections.s0.disabled = true;
    expect(featuredCollectionSlugs([d], collectionsA)).toEqual([]);
  });
  it("caps the fan-out", () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ id: `id-${i}`, slug: `c-${i}` }));
    expect(featuredCollectionSlugs([doc(many.map((c) => c.slug))], many)).toHaveLength(MAX_FEATURED_COLLECTIONS);
  });
  it("resolves a collection by slug or id", () => {
    expect(resolveCollection("winter", collectionsA)?.id).toBe("c-1");
    expect(resolveCollection("c-2", collectionsA)?.slug).toBe("summer");
    expect(resolveCollection("", collectionsA)).toBeUndefined();
  });
});
