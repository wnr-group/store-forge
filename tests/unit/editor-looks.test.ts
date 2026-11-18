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

import "@/lib/editor/adapters";
import { adapterForLook } from "@/lib/editor/adapter";
import { TemplateRenderer } from "@/components/storefront/engine/renderer";

vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");

type N = { type: string; settings: Record<string, unknown>; blocks: Record<string, N>; block_order: string[] };
const n = (type: string, settings: Record<string, unknown> = {}, blocks: Record<string, N> = {}): N => ({ type, settings, blocks, block_order: Object.keys(blocks) });
const style = { _style: { base: { color: "#ff0000" } } };
const store = { name: "Shop", slug: "shop", currency: "INR", products: [] };

function html(look: string, section: N) {
  const document = { schemaVersion: 1, layout: "classic", sections: { s1: section }, order: ["s1"] };
  const theme = { settings: { brand: { look }, colors: { primary: "#111111" } } };
  return renderToStaticMarkup(createElement(TemplateRenderer, { document: document as never, mode: "public", context: { store, theme } }));
}

describe("block style hooks in Maison and Marketplace", () => {
  it("Marketplace promotional banner: heading, text, button and step cards carry the hook", () => {
    const out = html("market", n("promotional-banner", {}, {
      h: n("heading", { text: "Big sale", ...style }),
      t: n("text", { content: "Details", ...style }),
      b: n("button", { label: "Go", link: "/", ...style }),
      c: n("column", { title: "Step", text: "x", ...style }),
    }));
    for (const id of ["h", "t", "b", "c"]) expect(out).toContain(`data-sf-ov="o_${id}"`);
    expect(adapterForLook("market").block("heading", "promotional-banner")).not.toBeNull();
  });

  it("Maison testimonials: each review card carries the hook", () => {
    const out = html("boutique", n("testimonials", {}, { r1: n("testimonial", { quote: "Great", author: "A", ...style }) }));
    expect(out).toContain('data-sf-ov="o_r1"');
    expect(adapterForLook("boutique").block("testimonial", "testimonials")).not.toBeNull();
  });

  it("sections a look draws from settings alone offer section styling but no block styling", () => {
    expect(adapterForLook("boutique").block("heading", "rich-text")).toBeNull();
    expect(adapterForLook("market").block("heading", "rich-text")).toBeNull();
    expect(adapterForLook("boutique").section("rich-text")).not.toBeNull();
    expect(adapterForLook("market").section("rich-text")).not.toBeNull();
  });
});
