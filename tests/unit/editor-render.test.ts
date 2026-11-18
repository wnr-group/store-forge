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

import { TemplateRenderer } from "@/components/storefront/engine/renderer";
import type { TemplateDocument } from "@/lib/templates/document";

vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");

type TestNode = { type: string; settings: Record<string, unknown>; blocks: Record<string, TestNode>; block_order: string[] };
const node = (type: string, settings: Record<string, unknown> = {}, blocks: Record<string, TestNode> = {}): TestNode => ({ type, settings, blocks, block_order: Object.keys(blocks) });
const theme = { settings: { colors: { primary: "#111111" } } };
const store = { name: "Shop", slug: "shop", currency: "INR", products: [] };

function page(styleSection?: unknown, styleBlock?: unknown): TemplateDocument {
  return {
    schemaVersion: 1,
    layout: "classic",
    sections: {
      s1: node("rich-text", { ...(styleSection ? { _style: styleSection } : {}) }, { b1: node("heading", { text: "Hello there", ...(styleBlock ? { _style: styleBlock } : {}) }) }),
      s2: node("rich-text", {}, { b2: node("heading", { text: "Plain" }) }),
    },
    order: ["s1", "s2"],
  };
}

const render = (doc: TemplateDocument, mode: "public" | "editor" = "public") =>
  renderToStaticMarkup(createElement(TemplateRenderer, { document: doc, mode, context: { store, theme } }));

describe("style overrides in the rendered storefront", () => {
  it("a page without overrides gets no override markup", () => {
    const html = render(page());
    expect(html).not.toContain("data-sf-ov");
    expect(html).not.toContain("<style");
  });

  it("styles a block through its own element, with the stylesheet, on the public page", () => {
    const html = render(page(undefined, { base: { color: "#ff0000", fontSize: 40 }, mobile: { fontSize: 20 } }));
    expect(html).toMatch(/<h2[^>]*data-sf-ov="o_b1"[^>]*>Hello there<\/h2>/);
    expect(html).toContain('[data-sf-ov=o_b1][data-sf-ov=o_b1]{font-size:40px;color:#ff0000}');
    expect(html).toContain("@media (max-width:767px)");
    // Only the styled block carries the hook; the public page has no editor markers.
    expect(html).not.toContain('data-sf-ov="o_b2"');
    expect(html).not.toContain("data-sf-block");
  });

  it("wraps a styled section in a box the stylesheet can reach, and leaves other sections alone", () => {
    const html = render(page({ base: { backgroundColor: "#eeeeee", paddingTop: 48 } }));
    expect(html).toContain('<div data-sf-ov="o_s1">');
    expect(html).not.toContain('data-sf-ov="o_s2"');
    expect(html).toContain("background-color:#eeeeee");
    expect(html).toContain("padding-top:48px");
  });

  it("the editor preview shows the same styles as the live page", () => {
    const doc = page(undefined, { base: { color: "#ff0000" } });
    const editor = render(doc, "editor");
    expect(editor).toContain('data-sf-ov="o_b1"');
    expect(editor).toContain('data-sf-block="b1"');
    expect(editor).toContain("color:#ff0000");
  });

  it("a tampered stored style never reaches the page", () => {
    const html = render(page(undefined, { base: { color: "red}</style><script>alert(1)</script>" } }));
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("alert(1)");
    expect(html).not.toContain("<style");
  });

  it("a hidden block is hidden by the stylesheet on the matching device only", () => {
    const html = render(page(undefined, { mobile: { hidden: true } }));
    expect(html).toMatch(/@media \(max-width:767px\)\{[^}]*display:none/);
    // Outside the media query nothing hides it.
    const outsideMedia = html.replace(/@media[^{]*\{(?:[^{}]*\{[^}]*\})*\}/g, "");
    expect(outsideMedia).not.toContain("display:none");
  });
});
