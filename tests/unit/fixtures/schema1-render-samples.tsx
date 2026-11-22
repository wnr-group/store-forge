import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TemplateRenderer } from "@/components/storefront/engine/renderer";
import type { RenderContext } from "@/components/storefront/engine/types";
import type { ComponentNode, TemplateDocument } from "@/lib/templates/document";

const node = (type: string, settings: Record<string, unknown> = {}, blocks: Record<string, ComponentNode> = {}, extra: Partial<ComponentNode> = {}): ComponentNode => ({
  type,
  settings,
  blocks,
  block_order: Object.keys(blocks),
  ...extra,
});

/** Representative schema 1 documents: plain, style overrides with `_style.hidden`, and disabled nodes. */
export const SCHEMA1_SAMPLES: Record<string, TemplateDocument> = {
  plain: {
    schemaVersion: 1,
    layout: "classic",
    sections: {
      banner: node("announcement-bar", { text: "Flash sale!" }),
      hero: node("hero", { heading: "Welcome" }, { h1: node("heading", { text: "Craft" }), b1: node("button", { label: "Shop", link: "/products" }) }),
      story: node("rich-text", { alignment: "center", maxWidth: "normal" }, { h: node("heading", { text: "Our Story" }), t: node("text", { content: "Local artisans." }) }),
    },
    order: ["banner", "hero", "story"],
  },
  styled: {
    schemaVersion: 1,
    layout: "spotlight",
    sections: {
      hero: node("hero", { heading: "Styled", _style: { base: { backgroundColor: "#112233", hidden: false }, mobile: { hidden: true } } }, {
        b1: node("button", { label: "Go", link: "/products", _style: { tablet: { hidden: true }, base: { color: "#ffffff" } } }),
      }),
      story: node("rich-text", { alignment: "left", maxWidth: "normal", _style: { base: { hidden: true } } }, { t: node("text", { content: "Hidden everywhere" }) }),
    },
    order: ["hero", "story"],
  },
  disabled: {
    schemaVersion: 1,
    layout: "classic",
    sections: {
      a: node("rich-text", { alignment: "center", maxWidth: "normal" }, { t: node("text", { content: "Shown" }), d: node("text", { content: "Disabled block" }, {}, { disabled: true }) }),
      b: node("announcement-bar", { text: "Disabled section" }, {}, { disabled: true }),
    },
    order: ["a", "b"],
  },
};

export const SAMPLE_CONTEXT: RenderContext = {
  store: { name: "Apex Goods", slug: "apex-goods", description: "Essentials", logo_path: null, currency: "INR", products: [] },
};

export function renderSample(doc: TemplateDocument, mode: "public" | "preview" = "public", extra: Partial<RenderContext> = {}): string {
  return renderToStaticMarkup(createElement(TemplateRenderer, { document: doc, context: { ...SAMPLE_CONTEXT, ...extra }, mode }));
}
