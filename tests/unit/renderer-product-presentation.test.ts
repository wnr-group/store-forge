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

import { TemplateRenderer } from "@/components/storefront/engine/renderer";
import type { RenderContext } from "@/components/storefront/engine/types";
import type { TemplateDocument } from "@/lib/templates/document";
import { productPreset } from "@/lib/templates/registry/presets/product";
import { toProductResource } from "@/services/storefront.service";

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
const render = (doc: TemplateDocument, resource: Record<string, unknown>, mode: "public" | "editor" = "public") => {
  const context: RenderContext = { store, resource, collections: [] };
  return renderToStaticMarkup(createElement(TemplateRenderer, { document: doc, context, mode }));
};

describe("product page presentation: defaults", () => {
  it("presentation null, absent or invalid renders exactly like a product without one", () => {
    const base = render(page(), product("Tee"));
    expect(render(page(), product("Tee", { presentation: null }))).toBe(base);
    expect(render(page(), product("Tee", { presentation: { schemaVersion: 1 } }))).toBe(base);
    expect(render(page(), product("Tee", { presentation: "garbage" }))).toBe(base);
    expect(render(page(), product("Tee", { presentation: { schemaVersion: 99, gallery: { layout: "stacked" }, hiddenBlocks: ["product-sku"] } }))).toBe(base);
    expect(render(page(), product("Tee", { presentation: { schemaVersion: 1, gallery: { layout: "wow" }, focalPoint: { x: 500, y: "a" }, hiddenBlocks: ["product-title", 4] } }))).toBe(base);
  });

  it("the default product page keeps its thumbnail gallery, a main picture and no focal point style", () => {
    const html = render(page(), product("Tee"));
    expect(html).toContain('aria-label="Show picture 2"');
    expect(html).not.toContain('data-gallery="stacked"');
    expect(html).not.toContain("object-position");
    expect(html).toContain("SKU");
    expect(html).toContain("More like this");
  });
});

describe("gallery layout", () => {
  it("stacked shows every picture one under the other, with no thumbnail buttons", () => {
    const html = render(page(), product("Tee", { presentation: { schemaVersion: 1, gallery: { layout: "stacked" } } }));
    expect(html).toContain('data-gallery="stacked"');
    expect(html).not.toContain("Show picture");
    for (const file of ["first", "second", "third"]) expect(html).toContain(`t/p/${file}.webp`);
  });

  it("the product beats the section setting, and the section setting applies when the product has none", () => {
    expect(render(page({ galleryLayout: "stacked" }), product("Tee"))).toContain('data-gallery="stacked"');
    const override = render(page({ galleryLayout: "stacked" }), product("Tee", { presentation: { schemaVersion: 1, gallery: { layout: "thumbnails" } } }));
    expect(override).not.toContain('data-gallery="stacked"');
    expect(override).toContain("Show picture 2");
  });

  it("a product without pictures still renders a placeholder when stacked", () => {
    const html = render(page(), product("Tee", { image_path: null, images: [], presentation: { schemaVersion: 1, gallery: { layout: "stacked" } } }));
    expect(html).toContain("No product image");
  });
});

describe("media position", () => {
  it("right puts the pictures after the details on wide screens; left is the default", () => {
    expect(render(page(), product("Tee"))).not.toContain("lg:order-2");
    const right = render(page(), product("Tee", { presentation: { schemaVersion: 1, gallery: { mediaPosition: "right" } } }));
    expect(right).toContain("lg:order-2");
    expect(right).toContain("lg:order-1");
  });
  it("the product beats the section setting in both directions", () => {
    expect(render(page({ mediaPosition: "right" }), product("Tee"))).toContain("lg:order-2");
    expect(render(page({ mediaPosition: "right" }), product("Tee", { presentation: { schemaVersion: 1, gallery: { mediaPosition: "left" } } }))).not.toContain("lg:order-2");
  });
});

// The product page shows every picture whole (`object-contain`, see sections/main-product.tsx). A focal point only decides which part of a
// CROPPED picture stays in view, and on a picture that is not cropped `object-position` would only push it off-centre in its box, so
// this layout does not apply it. The focal point is still stored and still read (a product with one renders normally).
describe("focal point", () => {
  it("is not applied to the pictures, which are shown whole", () => {
    const html = render(page(), product("Tee", { presentation: { schemaVersion: 1, focalPoint: { x: 25, y: 75 } } }));
    expect(html).not.toContain("object-position");
    // The gallery's pictures (the main picture and its thumbnails) are shown whole. Other elements on the page are not looked at here;
    // main-product-layout.test.ts checks the section on its own.
    expect(html.match(/<img[^>]*class="[^"]*object-contain[^"]*"/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
  it("stacked does not apply it either, and still shows the pictures", () => {
    const html = render(page(), product("Tee", { presentation: { schemaVersion: 1, gallery: { layout: "stacked" }, focalPoint: { x: 0, y: 100 } } }));
    expect(html).not.toContain("object-position");
    expect(html).toContain('data-gallery="stacked"');
    expect(html).toContain("object-contain");
  });
});

describe("hidden blocks and section", () => {
  const hidden = (...ids: string[]) => product("Tee", { presentation: { schemaVersion: 1, hiddenBlocks: ids } });

  it("each block identifier hides that block only", () => {
    const text = { "product-description": "About Tee", "product-sku": "Tee-SKU", "product-type": "Tee-type", "product-category": "Tee-category", "social-share": "Share it" };
    for (const [id, marker] of Object.entries(text)) {
      const html = render(page(), hidden(id));
      expect(html, `${id} hidden`).not.toContain(marker);
      for (const [other, otherMarker] of Object.entries(text)) if (other !== id) expect(html, `${id} must not hide ${other}`).toContain(otherMarker);
    }
  });

  it("related-products is a section and is hidden as a whole", () => {
    const html = render(page(), hidden("related-products"));
    expect(html).not.toContain("More like this");
    expect(html).not.toContain("Neighbour");
    expect(html).toContain("Tee-SKU");
  });

  it("hiding works in the editor preview too, and the title and price stay", () => {
    const html = render(page(), hidden("product-sku", "social-share", "related-products"), "editor");
    expect(html).not.toContain("Tee-SKU");
    expect(html).not.toContain("Share it");
    expect(html).not.toContain("More like this");
    expect(html).toContain("Tee");
    expect(html).toContain("100");
  });

  it("hiding is render-time only: the page document is never changed", () => {
    const doc = page();
    const snapshot = JSON.stringify(doc);
    render(doc, hidden("product-sku", "product-description", "related-products"));
    expect(JSON.stringify(doc)).toBe(snapshot);
  });
});

describe("product isolation", () => {
  it("one shared page renders each product with its own settings", () => {
    const doc = page();
    const a = product("Alpha", { presentation: { schemaVersion: 1, gallery: { layout: "stacked" }, hiddenBlocks: ["product-sku"], focalPoint: { x: 10, y: 20 } } });
    const b = product("Beta");
    const c = product("Gamma", { presentation: { schemaVersion: 1, gallery: { mediaPosition: "right" } } });
    const [ha, hb, hc] = [render(doc, a), render(doc, b), render(doc, c)];
    expect(ha).toContain('data-gallery="stacked"');
    expect(ha).not.toContain("Alpha-SKU");
    expect(hb).not.toContain('data-gallery="stacked"');
    expect(hb).toContain("Beta-SKU");
    expect(hb).not.toContain("object-position");
    expect(hb).not.toContain("lg:order-2");
    expect(hc).toContain("lg:order-2");
    expect(hc).toContain("Gamma-SKU");
    expect(hc).not.toContain('data-gallery="stacked"');
    // and the order of rendering does not matter
    expect(render(doc, b)).toBe(hb);
  });

  it("works with the real product preset", () => {
    const html = render(productPreset, product("Tee", { presentation: { schemaVersion: 1, hiddenBlocks: ["product-description", "related-products"] } }));
    expect(html).not.toContain("About Tee");
    expect(html).toContain("Tee");
  });
});

describe("the storefront reads the published presentation defensively (toProductResource)", () => {
  const api = (presentation: unknown) =>
    ({
      store: { name: "S", slug: "s", description: null, logo_path: null, currency: "INR" },
      product: { name: "Tee", slug: "tee", description: null, short_description: null, product_type: null, sku: null, price_minor: 1, compare_at_price_minor: null, has_variants: false, category_name: null },
      images: [],
      options: [],
      variants: [],
      related: [],
      ...(presentation === undefined ? {} : { presentation }),
    }) as unknown as Parameters<typeof toProductResource>[0];

  it("a missing field (an API without the feature) and null both mean no presentation", () => {
    expect(toProductResource(api(undefined)).presentation).toBeNull();
    expect(toProductResource(api(null)).presentation).toBeNull();
  });
  it("a valid document is passed on, parsed", () => {
    expect(toProductResource(api({ schemaVersion: 1, gallery: { layout: "stacked" }, extra: true })).presentation).toEqual({ schemaVersion: 1, gallery: { layout: "stacked" } });
  });
  it("junk, a future version or a wrong type become null and never throw", () => {
    for (const bad of ["x", 5, [], { schemaVersion: 2 }, { gallery: { layout: "stacked" } }]) expect(toProductResource(api(bad)).presentation).toBeNull();
  });
});
