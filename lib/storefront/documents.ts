import type { ComponentNode, TemplateDocument } from "@/lib/templates/document";
import { DOCUMENT_SCHEMA_VERSION } from "@/lib/templates/document";

/**
 * Small documents for storefront pages that are not designed in the editor (content pages, search results, the
 * collections index). They are built from the engine's own sections, so they get the store's header, footer and theme
 * like every other page and never need their own markup.
 */

const node = (type: string, settings: Record<string, unknown>, blocks: [string, ComponentNode][] = []): ComponentNode => ({
  type,
  settings,
  blocks: Object.fromEntries(blocks),
  block_order: blocks.map(([id]) => id),
});

const doc = (sections: [string, ComponentNode][]): TemplateDocument => ({
  schemaVersion: DOCUMENT_SCHEMA_VERSION,
  layout: "classic",
  sections: Object.fromEntries(sections),
  order: sections.map(([id]) => id),
});

/**
 * A content page. The body is plain text: a blank line starts a paragraph and a paragraph starting with "# " is a
 * heading. Everything else goes through the engine's rich text renderer, which strips HTML.
 */
export function pageDocument(title: string, body: string): TemplateDocument {
  const blocks: [string, ComponentNode][] = [["title", node("heading", { text: title, level: "h1", alignment: "left" })]];
  body
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 200)
    .forEach((part, i) => {
      blocks.push(
        part.startsWith("# ")
          ? [`b${i}`, node("heading", { text: part.slice(2).trim(), level: "h2", alignment: "left" })]
          : [`b${i}`, node("text", { content: part, alignment: "left" })],
      );
    });
  return doc([["content", node("rich-text", { alignment: "left", maxWidth: "normal", backgroundColor: "transparent" }, blocks)]]);
}

/** The collections index: the collection list section over every active collection. */
export function collectionsDocument(): TemplateDocument {
  return doc([["collections", node("collection-list", { title: "Collections", columns: 3, showProductCount: true })]]);
}

/** A product grid under a heading: used for the all-products page and for search results. */
export function productListDocument(title: string, note?: string): TemplateDocument {
  const intro: [string, ComponentNode][] = [["title", node("heading", { text: title, level: "h1", alignment: "left" })]];
  if (note) intro.push(["note", node("text", { content: note, alignment: "left" })]);
  return doc([
    ["intro", node("rich-text", { alignment: "left", maxWidth: "wide", backgroundColor: "transparent" }, intro)],
    ["grid", node("product-grid", {})],
  ]);
}

/** Case-insensitive search over name and short description; blank terms match nothing. */
export function searchProducts<T extends { name: string; short_description?: string | null }>(products: T[], term: string): T[] {
  const needle = term.trim().toLowerCase().slice(0, 100);
  if (!needle) return [];
  return products.filter((p) => p.name.toLowerCase().includes(needle) || (p.short_description ?? "").toLowerCase().includes(needle));
}

/** The bag page: one cart section. The lines live in the shopper's browser, so the page itself holds no store data. */
export function cartDocument(): TemplateDocument {
  return doc([["cart", node("cart", {})]]);
}

/** The wishlist page: one wishlist section. The saved products live in the shopper's browser. */
export function wishlistDocument(): TemplateDocument {
  return doc([["wishlist", node("wishlist", {})]]);
}
