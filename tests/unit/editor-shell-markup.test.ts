import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/image", async () => {
  const { createElement: h } = await import("react");
  return { default: (p: { src: string; alt: string }) => h("img", { src: p.src, alt: p.alt }) };
});
vi.mock("next/link", async () => {
  const { createElement: h } = await import("react");
  return { default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => h("a", { href, ...rest }, children) };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));
vi.mock("@/app/(dashboard)/dashboard/templates/actions", () => ({
  getPresentationAction: vi.fn(),
  getTemplateAction: vi.fn(),
  loadProductPreviewAction: vi.fn(),
  saveDraftAction: vi.fn(),
  savePresentationDraftAction: vi.fn(),
}));

import { EditorShell, type EditorInit } from "@/components/themes/editor/editor-shell";

vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");

const node = (type: string, settings: Record<string, unknown> = {}) => ({ type, settings, blocks: {}, block_order: [] as string[] });
const index = { schemaVersion: 1, layout: "classic", sections: { a: node("hero", { heading: "Hello" }), b: node("rich-text") }, order: ["a", "b"] };
const product = { schemaVersion: 1, layout: "classic", sections: { m: node("main-product") }, order: ["m"] };
const theme = { schemaVersion: 1, settings: { colors: { primary: "#111111" } } };

const base = (over: Partial<EditorInit> = {}): EditorInit => ({
  tenantId: "t1",
  canManage: true,
  storeSlug: "shop",
  storeHost: "shop.example.com",
  storeUrl: "https://shop.example.com",
  themeName: "Dawn",
  pages: [
    { id: "p-index", kind: "index", name: "Home" },
    { id: "p-product", kind: "product", name: "Product" },
  ],
  pageId: "p-index",
  docs: [
    { templateId: "p-index", kind: "index", name: "Home", revision: 1, document: index },
    { templateId: "p-product", kind: "product", name: "Product", revision: 1, document: product },
    { templateId: "t", kind: "theme_settings", name: "Theme", revision: 1, document: theme },
  ],
  data: {
    store: { name: "Shop", slug: "shop", description: null, logo_path: null, currency: "INR", products: [] },
    collections: [],
  } as unknown as EditorInit["data"],
  ...over,
});

// React's useId values follow the component tree path, so they are normalised: only structure and attributes are compared.
const render = (init: EditorInit) =>
  renderToStaticMarkup(createElement(QueryClientProvider, { client: new QueryClient() }, createElement(EditorShell, { init }))).replace(/_R_[0-9a-z]+_/g, "_R_id_");

describe("EditorShell markup (characterisation)", () => {
  it("renders the editor chrome with the labels the browser specs rely on", () => {
    const html = render(base());
    for (const needle of [
      'role="application"', 'aria-label="Theme editor"', 'aria-label="Back to themes"', 'aria-label="Page to edit"',
      'aria-label="Back to the previous page"', 'aria-label="Preview size"', 'aria-label="History"', 'aria-label="Undo (Ctrl+Z)"',
      'aria-label="Redo (Ctrl+Shift+Z)"', 'aria-label="Version history"', 'aria-label="Page structure"', 'aria-label="Editor tools"',
      'aria-label="Live preview"', 'aria-label="Settings"', 'aria-label="Zoom"', 'aria-label="Inspector"', 'aria-label="Editor panels"',
      "All changes saved", "Publish", "Sections", "Home page",
    ]) {
      expect(html, needle).toContain(needle);
    }
    expect(html).toContain('aria-label="Add a product, category or collection"');
    expect(html).not.toContain("You can look around but not change anything");
  });

  it("shows the read-only notice and no Publish or Add controls without manage access", () => {
    const html = render(base({ canManage: false }));
    expect(html).toContain("You can look around but not change anything");
    expect(html).not.toContain('aria-label="Add a product, category or collection"');
    expect(html).not.toMatch(/<button[^>]*>(?:<svg[^>]*><\/svg>)? Publish/);
  });

  it("offers the Product rail tab only on the product page", () => {
    expect(render(base())).not.toContain(">Product</span>");
    const html = render(base({ pageId: "p-product" }));
    expect(html).toContain("Product");
  });

  it("produces stable markup for each variant", () => {
    expect(render(base())).toMatchSnapshot("home-manage");
    expect(render(base({ canManage: false }))).toMatchSnapshot("home-readonly");
    expect(render(base({ pageId: "p-product" }))).toMatchSnapshot("product-page");
  });
});
