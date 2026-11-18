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
import { originalOf, readTextOverrides, textOverridesSchema, withTextOverride, withTextStyle } from "@/lib/editor/text";
import { validateDocument } from "@/lib/templates/engine/validate";
import { getRegistry } from "@/lib/templates/registry/index";
import { createState, setTextOverride } from "@/lib/themes/editor/state";

vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
const TENANT = "11111111-1111-4111-8111-111111111111";

const doc = (texts?: unknown) => ({
  schemaVersion: 1,
  layout: "classic",
  sections: { s1: { type: "rich-text", settings: texts ? { _text: texts } : {}, blocks: { b1: { type: "heading", settings: { text: "Hello" }, blocks: {}, block_order: [] } }, block_order: ["b1"] } },
  order: ["s1"],
});

describe("text overrides", () => {
  it("adds, replaces and removes a replacement; putting the original back removes it", () => {
    let l = withTextOverride([], "Add to bag", "Buy now");
    expect(l).toEqual([{ from: "Add to bag", to: "Buy now" }]);
    l = withTextOverride(l, "Add to bag", "Get it");
    expect(l).toEqual([{ from: "Add to bag", to: "Get it" }]);
    expect(withTextOverride(l, "Add to bag", "Add to bag")).toEqual([]);
    expect(withTextOverride(l, "Add to bag", undefined)).toEqual([]);
  });

  it("styles a piece of text on its own, keeping or dropping its words", () => {
    let l = withTextStyle([], "Shop", "fontSize", 30);
    expect(l).toEqual([{ from: "Shop", to: "Shop", style: { fontSize: 30 } }]);
    l = withTextOverride(l, "Shop", "Store");
    expect(l).toEqual([{ from: "Shop", to: "Store", style: { fontSize: 30 } }]);
    expect(withTextStyle(l, "Shop", "fontSize", undefined)).toEqual([{ from: "Shop", to: "Store" }]);
    expect(withTextOverride(l, "Shop", undefined)).toEqual([]);
    expect(textOverridesSchema.safeParse([{ from: "a", to: "a", style: { color: "bad" } }]).success).toBe(false);
  });

  it("finds the original of a text the merchant already replaced", () => {
    expect(originalOf([{ from: "Shop", to: "Store" }], "Store")).toBe("Store".replace("Store", "Shop"));
    expect(originalOf([], "  Plain   text ")).toBe("Plain text");
  });

  it("rejects duplicates, oversize and unknown fields; ignores a bad stored value when reading", () => {
    expect(textOverridesSchema.safeParse([{ from: "a", to: "b" }, { from: "a", to: "c" }]).success).toBe(false);
    expect(textOverridesSchema.safeParse([{ from: "a", to: "x".repeat(301) }]).success).toBe(false);
    expect(textOverridesSchema.safeParse([{ from: "a", to: "b", html: "<b>" }]).success).toBe(false);
    expect(readTextOverrides({ _text: "nonsense" })).toEqual([]);
  });

  it("is edited per section in the editor state", () => {
    const s = createState("p", [{ templateId: "p", kind: "index", name: "Home", revision: 1, document: doc() }]);
    const a = setTextOverride(s, "p", "s1", "Add to bag", "Buy now");
    expect((a.docs.p.document as unknown as ReturnType<typeof doc>).sections.s1.settings).toEqual({ _text: [{ from: "Add to bag", to: "Buy now" }] });
    const b = setTextOverride(a, "p", "s1", "Add to bag", undefined);
    expect((b.docs.p.document as unknown as ReturnType<typeof doc>).sections.s1.settings).toEqual({});
  });

  it("validates in a document", () => {
    const registry = getRegistry();
    expect(validateDocument("index", doc([{ from: "Shop", to: "Store" }]), registry, { tenantId: TENANT }).ok).toBe(true);
    expect(validateDocument("index", doc([{ from: "Shop" }]), registry, { tenantId: TENANT }).ok).toBe(false);
  });

  it("the rendered page carries the replacements in a box-less wrapper and no markup from them", () => {
    const html = renderToStaticMarkup(createElement(TemplateRenderer, { mode: "public", document: doc([{ from: "Hello", to: "<b>x</b>" }]) as never, context: { store: { name: "S", slug: "s", currency: "INR", products: [] }, theme: { settings: { colors: { primary: "#111111" } } } } }));
    expect(html).toContain('data-sf-text=""');
    expect(html).toContain("display:contents");
    expect(html).not.toContain("<b>x</b>");
  });
});
