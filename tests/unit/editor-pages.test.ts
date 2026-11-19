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

import { PublishedView } from "@/components/storefront/published-view";
import { defaultPageDocument, pageKeyForHref, routeForHref, withPageContent, storedPageDocument, withSearchTerm } from "@/lib/storefront/pages";
import { themeSettingsSchema } from "@/lib/templates/engine/root-schema";
import { validateDocument } from "@/lib/templates/engine/validate";
import { getRegistry } from "@/lib/templates/registry/index";
import { createState, dirtyDocs, setSetting, type EditorState } from "@/lib/themes/editor/state";
import { foldVirtualPages, openVirtualPage, rebuildVirtualPages, resetVirtualPage, virtualId } from "@/lib/themes/editor/virtual";

vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
const TENANT = "11111111-1111-4111-8111-111111111111";
const theme = () => ({ schemaVersion: 1, settings: { colors: { primary: "#111111" } } });
const start = (): EditorState => createState("p", [
  { templateId: "p", kind: "index", name: "Home", revision: 1, document: { schemaVersion: 1, layout: "classic", sections: {}, order: [] } },
  { templateId: "t", kind: "theme_settings", name: "Theme", revision: 4, document: theme() },
]);
type Loose = { settings?: { pages?: Record<string, { sections: Record<string, { settings: Record<string, unknown> }> }> } };

describe("generated pages as theme-stored documents", () => {
  it("every default page validates inside a theme document, with ids repeating across pages", () => {
    const pages = { products: defaultPageDocument("products"), search: defaultPageDocument("search"), cart: defaultPageDocument("cart"), wishlist: defaultPageDocument("wishlist"), collections: defaultPageDocument("collections") };
    expect(themeSettingsSchema.safeParse({ schemaVersion: 1, settings: { pages } }).success).toBe(true);
    const r = validateDocument("theme_settings", { schemaVersion: 1, settings: { pages } }, getRegistry(), { tenantId: TENANT });
    expect(r.issues.filter((i) => i.level === "error")).toEqual([]);
  });

  it("rejects an unknown page key", () => {
    expect(themeSettingsSchema.safeParse({ schemaVersion: 1, settings: { pages: { checkout: defaultPageDocument("cart") } } }).success).toBe(false);
  });

  it("opening a page adds it clean, from the default or from the saved version", () => {
    let s = openVirtualPage(start(), "t", "products");
    expect(dirtyDocs(s)).toHaveLength(0);
    expect(s.docs[virtualId("products")].document).toEqual(defaultPageDocument("products"));
    expect(openVirtualPage(s, "t", "products")).toBe(s);
    const saved = { schemaVersion: 1, settings: { pages: { cart: { ...defaultPageDocument("cart"), order: ["cart"] } } } };
    s = openVirtualPage(createState("p", [{ templateId: "t", kind: "theme_settings", name: "T", revision: 1, document: saved }]), "t", "cart");
    expect(dirtyDocs(s)).toHaveLength(0);
  });

  it("an edit marks the page changed; folding moves it into the theme document, which then needs saving", () => {
    let s = openVirtualPage(start(), "t", "products");
    s = setSetting(s, virtualId("products"), "intro", "title", "text", "Everything we sell");
    expect(dirtyDocs(s).map((d) => d.templateId)).toEqual([virtualId("products")]);
    s = foldVirtualPages(s, "t");
    expect(dirtyDocs(s).map((d) => d.templateId)).toEqual(["t"]);
    const stored = (s.docs.t.document as Loose).settings!.pages!.products;
    expect(storedPageDocument(s.docs.t.document, "products")).not.toBeNull();
    expect((stored.sections.intro as unknown as { blocks: Record<string, { settings: Record<string, unknown> }> }).blocks.title.settings.text).toBe("Everything we sell");
    expect((s.docs.t.document as Loose).settings).toMatchObject({ colors: { primary: "#111111" } });
    // Folding again changes nothing.
    expect(foldVirtualPages(s, "t")).toBe(s);
  });

  it("an unedited page is never stored", () => {
    const s = openVirtualPage(start(), "t", "cart");
    expect(foldVirtualPages(s, "t")).toBe(s);
  });

  it("reset removes the saved page and restores the default", () => {
    let s = openVirtualPage(start(), "t", "products");
    s = foldVirtualPages(setSetting(s, virtualId("products"), "intro", "title", "text", "X"), "t");
    // The page was saved to the server earlier.
    s = { ...s, docs: { ...s.docs, t: { ...s.docs.t, saved: JSON.stringify(s.docs.t.document) } } };
    s = resetVirtualPage(s, "t", "products");
    expect((s.docs.t.document as Loose).settings!.pages).toBeUndefined();
    expect(s.docs[virtualId("products")].document).toEqual(defaultPageDocument("products"));
    expect(dirtyDocs(s).map((d) => d.templateId)).toEqual(["t"]);
  });

  it("rebuilds open pages from a replaced theme document", () => {
    let s = openVirtualPage(start(), "t", "products");
    s = foldVirtualPages(setSetting(s, virtualId("products"), "intro", "title", "text", "X"), "t");
    const restored = { ...s, docs: { ...s.docs, t: { ...s.docs.t, document: theme() } } };
    expect(rebuildVirtualPages(restored, "t").docs[virtualId("products")].document).toEqual(defaultPageDocument("products"));
  });

  it("maps storefront links to generated pages", () => {
    expect(pageKeyForHref("/products")).toBe("products");
    expect(pageKeyForHref("/search?q=a")).toBe("search");
    expect(pageKeyForHref("/products/shirt")).toBeNull();
    expect(routeForHref("/")).toEqual({ page: "home" });
    expect(routeForHref("/products/blue-shirt")).toEqual({ page: "product", slug: "blue-shirt" });
    expect(routeForHref("/collections/sale/")).toEqual({ page: "collection", slug: "sale" });
    expect(routeForHref("/about")).toEqual({ page: "about" });
    expect(routeForHref("/shipping")).toEqual({ page: "content", slug: "shipping" });
    expect(routeForHref("/search?q=a")).toEqual({ page: "search" });
    expect(routeForHref("/login")).toBeNull();
    expect(routeForHref("https://example.com")).toBeNull();
    expect(routeForHref("//evil.com")).toBeNull();
    expect(routeForHref("/a/b/c")).toBeNull();
  });

  it("the search page keeps its live title unless the merchant renamed it", () => {
    const stored = defaultPageDocument("search");
    expect((withSearchTerm(stored, "shoes", "2 results").sections.intro.blocks.title.settings.text)).toBe("Search: shoes");
    const renamed = structuredClone(stored);
    renamed.sections.intro.blocks.title.settings.text = "Find things";
    expect(withSearchTerm(renamed, "shoes", "n").sections.intro.blocks.title.settings.text).toBe("Find things");
    expect(withSearchTerm(renamed, "shoes", "2 results").sections.intro.blocks.note.settings.content).toBe("2 results");
  });
});

describe("the live storefront uses the saved page", () => {
  const store = { name: "Shop", slug: "shop", currency: "INR", products: [], collections: [] } as never;
  const view = (themeDoc: Record<string, unknown>) =>
    renderToStaticMarkup(createElement(PublishedView, { store, frame: { layout: { theme: themeDoc, groups: {} }, collections: [] } as never, document: defaultPageDocument("products"), page: "products" }));

  it("shows the default page until the theme holds an edited one", () => {
    expect(view(theme())).toContain("All products");
  });

  it("shows the merchant's page when the theme holds one", () => {
    const edited = defaultPageDocument("products");
    edited.sections.intro.blocks.title.settings.text = "Our whole range";
    const html = view({ schemaVersion: 1, settings: { pages: { products: edited } } });
    expect(html).toContain("Our whole range");
    expect(html).not.toContain("All products");
  });
});

describe("content pages share one layout", () => {
  it("the stored layout is an empty frame; showing a page puts its title and text in", () => {
    const layout = defaultPageDocument("content");
    expect(layout.sections.content.block_order).toEqual([]);
    const shown = withPageContent(layout, { title: "About us", body: "# Story\n\nHello" });
    expect(Object.values(shown.sections.content.blocks).map((b) => b.settings.text ?? b.settings.content)).toEqual(["About us", "Story", "Hello"]);
    expect(layout.sections.content.block_order).toEqual([]);
  });

  it("keeps the changes made around the content and restores a deleted content section", () => {
    const layout = defaultPageDocument("content");
    layout.sections.content.settings._style = { base: { paddingTop: 80 } };
    expect(withPageContent(layout, { title: "T", body: "b" }).sections.content.settings._style).toEqual({ base: { paddingTop: 80 } });
    const shown = withPageContent({ ...layout, sections: {}, order: [] }, { title: "T", body: "b" });
    expect(shown.order).toEqual(["content"]);
    expect(shown.sections.content.block_order.length).toBe(2);
  });
});

describe("a content page on the live storefront", () => {
  const store = { name: "Shop", slug: "shop", currency: "INR", products: [], collections: [] } as never;
  const page = { title: "About us", body: "We make things." };
  const view = (themeDoc: Record<string, unknown>) =>
    renderToStaticMarkup(
      createElement(PublishedView, {
        store,
        frame: { layout: { theme: themeDoc, groups: {} }, collections: [] } as never,
        document: defaultPageDocument("content"),
        page: "content",
        adapt: (layout) => withPageContent(layout, page),
      }),
    );

  it("shows the page's own title and text in the saved layout", () => {
    const layout = defaultPageDocument("content");
    layout.sections.band = { type: "rich-text", settings: {}, blocks: { h: { type: "heading", settings: { text: "Visit our shop" }, blocks: {}, block_order: [] } }, block_order: ["h"] };
    layout.order.push("band");
    const html = view({ schemaVersion: 1, settings: { pages: { content: layout } } });
    expect(html).toContain("About us");
    expect(html).toContain("We make things.");
    expect(html).toContain("Visit our shop");
  });

  it("without a saved layout the page is unchanged", () => {
    expect(view(theme())).not.toContain("Visit our shop");
  });
});
