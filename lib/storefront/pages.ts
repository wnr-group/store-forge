import type { ComponentNode, TemplateDocument } from "@/lib/templates/document";
import { cartDocument, collectionsDocument, pageDocument, productListDocument, wishlistDocument } from "./documents";

/**
 * Storefront pages the engine generates (no stored template of their own) that a merchant can still design. An edited page is
 * kept inside the theme document, `settings.pages[key]`, as a whole page document, so it is saved, published, versioned and
 * restored together with the theme. A page nobody edited keeps its generated default.
 *
 * `content` is the one layout shared by every content page (anything written under Pages). Its `content`
 * section is a frame: the page's own title and text are put into it when the page is shown (`withPageContent`).
 *
 * `about` and `contact` are whole designed pages a theme can ship (Maison does). They are shown at /about and /contact only when
 * the theme has saved a design for them and the store has not written a content page of the same name under Pages.
 */

export const PAGES_GROUP = "pages";
export const PAGE_KEYS = ["products", "collections", "search", "cart", "wishlist", "content", "about", "contact"] as const;
export type PageKey = (typeof PAGE_KEYS)[number];

export const PAGE_LABELS: Record<PageKey, string> = {
  products: "All products",
  collections: "Collections",
  search: "Search results",
  cart: "Cart",
  wishlist: "Wishlist",
  content: "Content pages (About, Contact ...)",
  about: "About page",
  contact: "Contact page",
};

export const isPageKey = (value: unknown): value is PageKey => typeof value === "string" && (PAGE_KEYS as readonly string[]).includes(value);

/**
 * A content page in the shared layout: the layout's `content` section gets the page's title and text (its settings, style and
 * text changes are kept). A layout whose content section was deleted gets a default one first, so a page is never empty.
 * `page` null leaves the section empty: how the layout is stored.
 */
export function withPageContent(layout: TemplateDocument, page: { title: string; body: string } | null): TemplateDocument {
  const next = structuredClone(layout);
  const generated = pageDocument(page?.title ?? "", page?.body ?? "").sections.content;
  let frame: ComponentNode | undefined = next.sections.content;
  if (!frame) {
    frame = { ...generated, blocks: {}, block_order: [] };
    next.sections.content = frame;
    next.order = ["content", ...next.order];
  }
  frame.blocks = page ? generated.blocks : {};
  frame.block_order = page ? generated.block_order : [];
  return next;
}

/** The page a key shows until it is edited. */
export function defaultPageDocument(key: PageKey): TemplateDocument {
  switch (key) {
    case "products":
      return productListDocument("All products");
    case "collections":
      return collectionsDocument();
    case "search":
      return productListDocument("Search");
    case "cart":
      return cartDocument();
    case "wishlist":
      return wishlistDocument();
    case "content":
      return withPageContent(pageDocument("", ""), null);
    case "about":
      return pageDocument("About us", "Tell your customers who you are, how you started and what you stand for.");
    case "contact":
      return pageDocument("Contact us", "Tell your customers how to reach you.");
  }
}

/** The edited page stored in a theme document, if there is one with the shape of a page. */
export function storedPageDocument(theme: Record<string, unknown> | null | undefined, key: PageKey): TemplateDocument | null {
  const pages = (theme?.settings as Record<string, unknown> | undefined)?.[PAGES_GROUP] as Record<string, unknown> | undefined;
  const doc = pages?.[key] as Partial<TemplateDocument> | undefined;
  if (!doc || typeof doc !== "object" || typeof doc.sections !== "object" || !Array.isArray(doc.order)) return null;
  return doc as TemplateDocument;
}

/** What the live page shows: the merchant's design, else the default. */
export const resolvePageDocument = (theme: Record<string, unknown> | null | undefined, key: PageKey, fallback: TemplateDocument): TemplateDocument => storedPageDocument(theme, key) ?? fallback;

/**
 * The search page keeps its live title and result note. An edited page still carries the words it was saved with, so the
 * title is made live only while it still reads "Search" (the merchant has not renamed it), and the note is added if missing.
 */
export function withSearchTerm(doc: TemplateDocument, term: string, note: string): TemplateDocument {
  const next = structuredClone(doc);
  const intro = next.sections.intro as ComponentNode | undefined;
  if (!intro) return next;
  const title = intro.blocks.title;
  if (title && title.settings.text === "Search" && term) title.settings.text = `Search: ${term}`;
  if (!intro.blocks.note) {
    intro.blocks.note = { type: "text", settings: { content: note, alignment: "left" }, blocks: {}, block_order: [] };
    intro.block_order.push("note");
  } else {
    intro.blocks.note.settings.content = note;
  }
  return next;
}

/** Where a storefront link leads, in terms of the editor's pages. `slug` names the product, collection or content page. */
export type StoreRoute =
  | { page: "home"; slug?: undefined }
  | { page: "product" | "collection" | "content"; slug: string }
  | { page: "products" | "collections" | "search" | "cart" | "wishlist" | "about" | "contact"; slug?: undefined };

const GENERATED: Record<string, "products" | "collections" | "search" | "cart" | "wishlist" | "about" | "contact"> = {
  products: "products",
  collections: "collections",
  search: "search",
  cart: "cart",
  wishlist: "wishlist",
  about: "about",
  contact: "contact",
};

/** Single-segment paths that are not content pages. */
const RESERVED = new Set(["login", "logout", "account", "checkout", "api", "admin", "dashboard", "s"]);

/** The page a link on the storefront leads to; null for anything else (another site, sign-in, a file). */
export function routeForHref(href: string): StoreRoute | null {
  if (!href.startsWith("/") || href.startsWith("//")) return null;
  const path = href.split(/[?#]/)[0].replace(/\/+$/, "");
  let parts: string[];
  try {
    parts = path.split("/").filter(Boolean).map((p) => decodeURIComponent(p).toLowerCase());
  } catch {
    return null;
  }
  if (parts.length === 0) return { page: "home" };
  const [first, second] = parts;
  if (parts.length === 1 && GENERATED[first]) return { page: GENERATED[first] };
  if (parts.length === 2 && first === "products") return { page: "product", slug: second };
  if (parts.length === 2 && first === "collections") return { page: "collection", slug: second };
  if (parts.length === 1 && /^[a-z0-9][a-z0-9-]*$/.test(first) && !RESERVED.has(first)) return { page: "content", slug: first };
  return null;
}

/** The generated page (not product, collection, home or content) a link leads to, if any. */
export function pageKeyForHref(href: string): PageKey | null {
  const route = routeForHref(href);
  return route && isPageKey(route.page) && route.page !== "content" ? route.page : null;
}
