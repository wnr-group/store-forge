import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Mock next/image and next/link
vi.mock("next/image", async () => {
  const { createElement: h } = await import("react");
  return { default: (p: { src: string; alt: string }) => h("img", { src: p.src, alt: p.alt }) };
});
vi.mock("next/link", async () => {
  const { createElement: h } = await import("react");
  return { default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => h("a", { href, ...rest }, children) };
});

import { TemplateRenderer } from "@/components/storefront/engine/renderer";
import type { RenderContext } from "@/components/storefront/engine/types";
import type { TemplateDocument } from "@/lib/templates/document";

const sampleStore = {
  name: "Apex Goods",
  slug: "apex-goods",
  description: "Modern essentials for your daily routine",
  logo_path: null,
  currency: "INR",
  products: [
    {
      name: "Desk Mat",
      slug: "desk-mat",
      short_description: "Premium leather mat",
      price_minor: 150000,
      compare_at_price_minor: 180000,
      image_path: "tenant-1/store/mat.webp",
    },
  ],
};

const render = (doc: TemplateDocument, ctx: RenderContext, mode: "public" | "preview" = "public") =>
  renderToStaticMarkup(createElement(TemplateRenderer, { document: doc, context: ctx, mode }));

describe("TemplateRenderer Core Behaviors [AC-REN-001] [AC-REN-014] [AC-REN-015] [AC-REN-016]", () => {
  it("renders a minimal document in public mode [AC-REN-001]", () => {
    const doc: TemplateDocument = {
      schemaVersion: 1,
      layout: "classic",
      sections: {
        banner: {
          type: "announcement-bar",
          settings: { text: "Flash sale!" },
          blocks: {},
          block_order: [],
        },
      },
      order: ["banner"],
    };

    const html = render(doc, { store: sampleStore }, "public");
    expect(html).toContain("Flash sale!");
    expect(html).toContain("Apex Goods");
    expect(html).toContain("Powered by StoreForge");
  });

  it("skips unknown component types in public mode and shows warnings in preview mode [AC-REN-014]", () => {
    const doc: TemplateDocument = {
      schemaVersion: 1,
      layout: "classic",
      sections: {
        unknownSec: {
          type: "unregistered-alien-section",
          settings: { foo: "bar" },
          blocks: {},
          block_order: [],
        },
      },
      order: ["unknownSec"],
    };

    // Public mode: unknown section is silently skipped
    const publicHtml = render(doc, { store: sampleStore }, "public");
    expect(publicHtml).not.toContain("unregistered-alien-section");

    // Preview mode: warning message is rendered
    const previewHtml = render(doc, { store: sampleStore }, "preview");
    expect(previewHtml).toContain("Unknown section type:");
    expect(previewHtml).toContain("unregistered-alien-section");
  });

  it("does not render disabled sections or blocks in public mode [AC-REN-015]", () => {
    const doc: TemplateDocument = {
      schemaVersion: 1,
      layout: "classic",
      sections: {
        activeSec: {
          type: "rich-text",
          settings: {},
          blocks: {
            b1: {
              type: "heading",
              settings: { text: "Active Heading" },
              blocks: {},
              block_order: [],
              disabled: false,
            },
            b2: {
              type: "heading",
              settings: { text: "Disabled Secret Heading" },
              blocks: {},
              block_order: [],
              disabled: true,
            },
          },
          block_order: ["b1", "b2"],
        },
        disabledSec: {
          type: "rich-text",
          settings: {},
          blocks: {
            b3: {
              type: "heading",
              settings: { text: "Disabled Section Content" },
              blocks: {},
              block_order: [],
            },
          },
          block_order: ["b3"],
          disabled: true,
        },
      },
      order: ["activeSec", "disabledSec"],
    };

    const publicHtml = render(doc, { store: sampleStore }, "public");
    expect(publicHtml).toContain("Active Heading");
    expect(publicHtml).not.toContain("Disabled Secret Heading");
    expect(publicHtml).not.toContain("Disabled Section Content");
  });

  it("resolves data bindings and handles missing bound data with fallback in public and placeholder in preview [AC-REN-016]", () => {
    const doc: TemplateDocument = {
      schemaVersion: 1,
      layout: "classic",
      sections: {
        sec1: {
          type: "rich-text",
          settings: {},
          blocks: {
            boundStoreName: {
              type: "heading",
              settings: {
                text: { source: "store.name", fallback: "Fallback Store" },
              },
              blocks: {},
              block_order: [],
            },
            boundMissingWithFallback: {
              type: "heading",
              settings: {
                text: { source: "product.title", fallback: "Fallback Product Title" },
              },
              blocks: {},
              block_order: [],
            },
            boundMissingNoFallback: {
              type: "heading",
              settings: {
                text: { source: "collection.title" },
              },
              blocks: {},
              block_order: [],
            },
          },
          block_order: ["boundStoreName", "boundMissingWithFallback", "boundMissingNoFallback"],
        },
      },
      order: ["sec1"],
    };

    // Public mode (no product or collection resource in context)
    const publicHtml = render(doc, { store: sampleStore }, "public");
    expect(publicHtml).toContain("Apex Goods"); // bound to store.name
    expect(publicHtml).toContain("Fallback Product Title"); // missing product.title -> fallback

    // Preview mode
    const previewHtml = render(doc, { store: sampleStore }, "preview");
    expect(previewHtml).toContain("Apex Goods");
    expect(previewHtml).toContain("Fallback Product Title");
    expect(previewHtml).toContain("[collection.title]"); // placeholder when missing with no fallback
  });
});
