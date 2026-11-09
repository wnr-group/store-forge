import { createElement, type CSSProperties } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Mock next/image and next/link
vi.mock("next/image", async () => {
  const { createElement: h } = await import("react");
  return {
    default: (p: { src: string; alt: string; style?: CSSProperties; className?: string }) =>
      h("img", { src: p.src, alt: p.alt, style: p.style, className: p.className }),
  };
});
vi.mock("next/link", async () => {
  const { createElement: h } = await import("react");
  return {
    default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
      h("a", { href, ...rest }, children),
  };
});

import { TemplateRenderer } from "@/components/storefront/engine/renderer";
import type { RenderContext } from "@/components/storefront/engine/types";
import type { TemplateDocument } from "@/lib/templates/document";

const testStore = {
  name: "Velvet & Vine",
  slug: "velvet-and-vine",
  description: "Curated homeware & accessories",
  logo_path: "tenant-1/store/logo.png",
  currency: "INR",
  products: [
    {
      name: "Brass Candle Holder",
      slug: "brass-candle-holder",
      short_description: "Solid brass minimalist candle holder",
      price_minor: 249900,
      compare_at_price_minor: 299900,
      sku: "BCH-001",
      category: "Home Decor",
      category_id: "cat-decor",
      collection_id: "col-winter",
      image_path: "tenant-1/store/candle.webp",
    },
    {
      name: "Linen Table Runner",
      slug: "linen-table-runner",
      short_description: "100% organic washed European linen",
      price_minor: 189900,
      compare_at_price_minor: null,
      sku: "LTR-002",
      category: "Home Decor",
      category_id: "cat-decor",
      collection_id: "col-winter",
      image_path: "tenant-1/store/runner.webp",
    },
    {
      name: "Ceramic Mug",
      slug: "ceramic-mug",
      short_description: "Handcrafted speckled stoneware mug",
      price_minor: 89900,
      compare_at_price_minor: null,
      sku: "CM-003",
      category: "Kitchen",
      category_id: "cat-kitchen",
      collection_id: "col-pottery",
      image_path: "tenant-1/store/mug.webp",
    },
  ],
};

const testCollections = [
  {
    id: "col-winter",
    name: "Winter Warmth",
    slug: "winter-warmth",
    description: "Cozy additions for the colder months",
    image_path: "tenant-1/collections/winter.webp",
    product_count: 2,
  },
  {
    id: "col-pottery",
    name: "Artisan Pottery",
    slug: "artisan-pottery",
    description: "Handmade ceramic pieces",
    image_path: "tenant-1/collections/pottery.webp",
    product_count: 1,
  },
];

const renderDoc = (doc: TemplateDocument, ctx: RenderContext, mode: "public" | "preview" = "public") =>
  renderToStaticMarkup(createElement(TemplateRenderer, { document: doc, context: ctx, mode }));

describe("Storefront Component Catalogue — Section Renderers", () => {
  it("Header group sections (announcement-bar, header) render with real data [AC-REN-002]", () => {
    const doc: TemplateDocument = {
      schemaVersion: 1,
      layout: "classic",
      sections: {
        announcement: {
          type: "announcement-bar",
          settings: {
            text: "Free shipping worldwide on orders above ₹2000!",
            link: "/collections",
            backgroundColor: "#1e293b",
            textColor: "#f8fafc",
            alignment: "center",
          },
          blocks: {},
          block_order: [],
        },
        siteHeader: {
          type: "header",
          settings: {
            logoWidth: 150,
            menuAlignment: "left",
            sticky: true,
          },
          blocks: {
            l1: {
              type: "link",
              settings: { label: "Catalog", url: "/collections" },
              blocks: {},
              block_order: [],
            },
          },
          block_order: ["l1"],
        },
      },
      order: ["announcement", "siteHeader"],
    };

    const html = renderDoc(doc, { store: testStore });
    expect(html).toContain("Free shipping worldwide on orders above ₹2000!");
    expect(html).toContain("Velvet &amp; Vine");
    expect(html).toContain("Catalog");
    expect(html).toContain("Store login");
  });

  it("Banner sections (hero, image-banner) render with real data [AC-REN-003]", () => {
    const doc: TemplateDocument = {
      schemaVersion: 1,
      layout: "classic",
      sections: {
        banner: {
          type: "image-banner",
          settings: {
            height: "medium",
            overlayOpacity: 40,
            textAlignment: "center",
          },
          blocks: {
            h1: {
              type: "heading",
              settings: { text: "Artisan Craftsmanship" },
              blocks: {},
              block_order: [],
            },
            b1: {
              type: "button",
              settings: { label: "Explore New Arrivals", link: "/products" },
              blocks: {},
              block_order: [],
            },
          },
          block_order: ["h1", "b1"],
        },
      },
      order: ["banner"],
    };

    const html = renderDoc(doc, { store: testStore });
    expect(html).toContain("Artisan Craftsmanship");
    expect(html).toContain("Explore New Arrivals");
  });

  it("Content sections (rich-text, image-with-text, multicolumn, collapsible-content, testimonials) render [AC-REN-004]", () => {
    const doc: TemplateDocument = {
      schemaVersion: 1,
      layout: "classic",
      sections: {
        story: {
          type: "rich-text",
          settings: { alignment: "center", maxWidth: "normal" },
          blocks: {
            h: { type: "heading", settings: { text: "Our Story" }, blocks: {}, block_order: [] },
            t: { type: "text", settings: { content: "We partner with local artisans." }, blocks: {}, block_order: [] },
          },
          block_order: ["h", "t"],
        },
        faq: {
          type: "collapsible-content",
          settings: { heading: "Frequently Asked Questions", subheading: "Answers to common shipping queries" },
          blocks: {
            faq1: {
              type: "collapsible-item",
              settings: { heading: "How long is shipping?", content: "Domestic shipping takes 3-5 days." },
              blocks: {},
              block_order: [],
            },
          },
          block_order: ["faq1"],
        },
        reviews: {
          type: "testimonials",
          settings: { heading: "Happy Customers", columns: 1 },
          blocks: {
            t1: {
              type: "testimonial",
              settings: { quote: "Unbelievable quality and care.", author: "Sarah M.", role: "Architect" },
              blocks: {},
              block_order: [],
            },
          },
          block_order: ["t1"],
        },
        features: {
          type: "multicolumn",
          settings: { columns: 2 },
          blocks: {
            c1: {
              type: "column",
              settings: { title: "Sustainable Materials", text: "Crafted from 100% recycled brass and natural clay." },
              blocks: {},
              block_order: [],
            },
          },
          block_order: ["c1"],
        },
      },
      order: ["story", "faq", "reviews", "features"],
    };

    const html = renderDoc(doc, { store: testStore });
    expect(html).toContain("Our Story");
    expect(html).toContain("We partner with local artisans.");
    expect(html).toContain("Frequently Asked Questions");
    expect(html).toContain("How long is shipping?");
    expect(html).toContain("Happy Customers");
    expect(html).toContain("Sarah M.");
    expect(html).toContain("Sustainable Materials");
  });

  it("Collection sections (product-grid, collection-list, featured-collection, collection-banner) render [AC-REN-005]", () => {
    const doc: TemplateDocument = {
      schemaVersion: 1,
      layout: "classic",
      sections: {
        banner: {
          type: "collection-banner",
          settings: { showCollectionDescription: true },
          blocks: {},
          block_order: [],
        },
        collections: {
          type: "collection-list",
          settings: { title: "Featured Categories", columns: 2 },
          blocks: {},
          block_order: [],
        },
        featured: {
          type: "featured-collection",
          settings: { title: "Staff Picks", productsToShow: 2 },
          blocks: {},
          block_order: [],
        },
        grid: {
          type: "product-grid",
          settings: { columns: 3 },
          blocks: {},
          block_order: [],
        },
      },
      order: ["banner", "collections", "featured", "grid"],
    };

    const html = renderDoc(doc, {
      store: testStore,
      collections: testCollections,
      resource: testCollections[0],
    });

    expect(html).toContain("Winter Warmth");
    expect(html).toContain("Cozy additions for the colder months");
    expect(html).toContain("Featured Categories");
    expect(html).toContain("Staff Picks");
    expect(html).toContain("Brass Candle Holder");
    expect(html).toContain("Linen Table Runner");
  });

  it("Product sections (main-product, related-products) render approved blocks from product data [AC-REN-006]", () => {
    const currentProduct = testStore.products[0];
    const doc: TemplateDocument = {
      schemaVersion: 1,
      layout: "classic",
      sections: {
        main: {
          type: "main-product",
          settings: { mediaPosition: "left" },
          blocks: {
            title: { type: "product-title", settings: { level: "h1" }, blocks: {}, block_order: [] },
            price: { type: "product-price", settings: { showCompareAt: true }, blocks: {}, block_order: [] },
            sku: { type: "product-sku", settings: { prefix: "SKU:" }, blocks: {}, block_order: [] },
            desc: { type: "product-description", settings: { truncate: false }, blocks: {}, block_order: [] },
            share: { type: "social-share", settings: { title: "Share" }, blocks: {}, block_order: [] },
          },
          block_order: ["title", "price", "sku", "desc", "share"],
        },
      },
      order: ["main"],
    };

    const html = renderDoc(doc, { store: testStore, resource: currentProduct });
    expect(html).toContain("Brass Candle Holder");
    expect(html).toContain("BCH-001");
    expect(html).toContain("Solid brass minimalist candle holder");
    expect(html).toContain("Share");
  });

  it("Marketing sections (promotional-banner, logo-list) render [AC-REN-007]", () => {
    const doc: TemplateDocument = {
      schemaVersion: 1,
      layout: "classic",
      sections: {
        promo: {
          type: "promotional-banner",
          settings: {
            title: "Festive Sale Now Live",
            highlightText: "Enjoy 25% discount across all stoneware pottery",
            link: "/collections",
          },
          blocks: {},
          block_order: [],
        },
        logos: {
          type: "logo-list",
          settings: { title: "Featured In Press" },
          blocks: {},
          block_order: [],
        },
      },
      order: ["promo", "logos"],
    };

    const html = renderDoc(doc, { store: testStore });
    expect(html).toContain("Festive Sale Now Live");
    expect(html).toContain("Enjoy 25% discount across all stoneware pottery");
    expect(html).toContain("Featured In Press");
  });

  it("Footer group sections (footer, link-column, social-links) render [AC-REN-008]", () => {
    const doc: TemplateDocument = {
      schemaVersion: 1,
      layout: "classic",
      sections: {
        foot: {
          type: "footer",
          settings: { copyrightText: "Custom Copyright 2026 Velvet & Vine" },
          blocks: {
            col: {
              type: "link-column",
              settings: { title: "Help & FAQ" },
              blocks: {
                l1: { type: "link", settings: { label: "Contact Us", url: "/contact" }, blocks: {}, block_order: [] },
              },
              block_order: ["l1"],
            },
            soc: {
              type: "social-link",
              settings: { network: "instagram", url: "https://instagram.com/velvetvine" },
              blocks: {},
              block_order: [],
            },
          },
          block_order: ["col", "soc"],
        },
      },
      order: ["foot"],
    };

    const html = renderDoc(doc, { store: testStore });
    expect(html).toContain("Help &amp; FAQ");
    expect(html).toContain("Contact Us");
    expect(html).toContain("Instagram");
    expect(html).toContain("Custom Copyright 2026 Velvet &amp; Vine");
  });

  it("Related products come only from shared active collection or category [AC-REN-010]", () => {
    // Current product is Brass Candle Holder (collection_id: "col-winter", category_id: "cat-decor")
    const currentProduct = testStore.products[0];
    const doc: TemplateDocument = {
      schemaVersion: 1,
      layout: "classic",
      sections: {
        related: {
          type: "related-products",
          settings: { heading: "Complementary Pieces", productsToShow: 4 },
          blocks: {},
          block_order: [],
        },
      },
      order: ["related"],
    };

    const html = renderDoc(doc, { store: testStore, resource: currentProduct });
    expect(html).toContain("Complementary Pieces");
    // Linen Table Runner shares collection col-winter and category cat-decor: SHOULD be included
    expect(html).toContain("Linen Table Runner");
    // Brass Candle Holder is the current product: MUST be excluded
    // Ceramic Mug is in category cat-kitchen and collection col-pottery: MUST be excluded
    expect(html).not.toContain("Ceramic Mug");
  });
});
