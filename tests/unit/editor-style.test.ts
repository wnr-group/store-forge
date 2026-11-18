import { describe, expect, it } from "vitest";
import "@/lib/editor/adapters";
import { adapterForLook } from "@/lib/editor/adapter";
import { collectCssTargets, documentsCss, hasStyleOverrides } from "@/lib/editor/render";
import { partStyleDeclarations, partStyleSchema, elementCss, elementStyleSchema, fieldsFor, isEmptyStyle, parseElementStyle, resolveStyleValue, withStyleValue, type ElementStyle } from "@/lib/editor/style";
import { validateDocument } from "@/lib/templates/engine/validate";
import { getRegistry } from "@/lib/templates/registry/index";

const registry = getRegistry();
const TENANT = "11111111-1111-4111-8111-111111111111";

describe("element style schema", () => {
  it("accepts known properties in range", () => {
    expect(parseElementStyle({ base: { color: "#112233", fontSize: 24, fontFamily: "inter", fontWeight: 700, hidden: false }, mobile: { fontSize: 18 } })).not.toBeNull();
  });

  it.each([
    ["unknown property", { base: { position: "fixed" } }],
    ["unknown device", { desktop: { color: "#000000" } }],
    ["css in a colour", { base: { color: "red; background:url(x)" } }],
    ["shorthand colour", { base: { color: "#fff" } }],
    ["font outside the registry", { base: { fontFamily: "Comic Sans" } }],
    ["size out of range", { base: { fontSize: 5000 } }],
    ["not a number", { base: { paddingTop: "10px" } }],
    ["weight not offered", { base: { fontWeight: 123 } }],
    ["NaN", { base: { opacity: Number.NaN } }],
  ])("rejects %s", (_name, input) => {
    expect(elementStyleSchema.safeParse(input).success).toBe(false);
  });
});

describe("withStyleValue", () => {
  it("sets, replaces and removes a value, dropping empty buckets", () => {
    let s: ElementStyle = {};
    s = withStyleValue(s, "base", "color", "#ff0000");
    expect(s).toEqual({ base: { color: "#ff0000" } });
    s = withStyleValue(s, "mobile", "fontSize", 20);
    s = withStyleValue(s, "base", "color", undefined);
    expect(s).toEqual({ mobile: { fontSize: 20 } });
    s = withStyleValue(s, "mobile", "fontSize", undefined);
    expect(isEmptyStyle(s)).toBe(true);
  });

  it("does not mutate its input", () => {
    const s: ElementStyle = { base: { color: "#000000" } };
    withStyleValue(s, "base", "color", "#ffffff");
    expect(s.base?.color).toBe("#000000");
  });
});

describe("resolveStyleValue (inheritance)", () => {
  const section: ElementStyle = { base: { backgroundColor: "#eeeeee", paddingTop: 40 }, mobile: { paddingTop: 16 } };
  const element: ElementStyle = { base: { paddingTop: 8 } };
  const layers = [
    { source: "section", style: section },
    { source: "element", style: element },
  ];

  it("the most specific layer wins", () => {
    expect(resolveStyleValue(layers, "paddingTop", "base")).toMatchObject({ value: 8, source: "element" });
  });

  it("falls back to the inherited layer when the element sets nothing", () => {
    expect(resolveStyleValue(layers, "backgroundColor")).toMatchObject({ value: "#eeeeee", source: "section" });
  });

  it("a phone uses mobile, then tablet, then base; a tablet never uses mobile", () => {
    const s: ElementStyle = { base: { fontSize: 30 }, tablet: { fontSize: 22 }, mobile: { fontSize: 16 } };
    const l = [{ source: "e", style: s }];
    expect(resolveStyleValue(l, "fontSize", "mobile").value).toBe(16);
    expect(resolveStyleValue(l, "fontSize", "tablet").value).toBe(22);
    expect(resolveStyleValue(l, "fontSize", "base").value).toBe(30);
    const tabletOnly = [{ source: "e", style: { tablet: { fontSize: 22 } } as ElementStyle }];
    expect(resolveStyleValue(tabletOnly, "fontSize", "mobile").value).toBe(22);
    expect(resolveStyleValue(tabletOnly, "fontSize", "base").value).toBeUndefined();
  });

  it("removing the override returns the inherited value (reset)", () => {
    const reset = withStyleValue(element, "base", "paddingTop", undefined);
    expect(resolveStyleValue([layers[0], { source: "element", style: reset }], "paddingTop")).toMatchObject({ value: 40, source: "section" });
  });
});

describe("elementCss", () => {
  it("emits base rules and cascading tablet and mobile media queries", () => {
    const css = elementCss([{ id: "blk_1", textScope: true, style: { base: { color: "#112233", fontSize: 30 }, tablet: { fontSize: 22 }, mobile: { fontSize: 16, hidden: true } } }]);
    expect(css).toContain('[data-sf-ov=o_blk_1][data-sf-ov=o_blk_1]{font-size:30px;color:#112233}');
    expect(css).toContain("@media (max-width:1279px){");
    expect(css).toContain("@media (max-width:767px){");
    expect(css.indexOf("1279px")).toBeLessThan(css.indexOf("767px"));
    expect(css).toContain("display:none");
  });

  it("reaches the text inside a block only when it has text scope", () => {
    const style: ElementStyle = { base: { color: "#112233" } };
    expect(elementCss([{ id: "a", textScope: true, style }])).toContain(":where(");
    expect(elementCss([{ id: "a", textScope: false, style }])).not.toContain(":where(");
  });

  it("a visible override restores display, so a hidden-by-default rule can be undone per device", () => {
    expect(elementCss([{ id: "a", textScope: false, style: { mobile: { hidden: false } } }])).toContain("display:block");
  });

  it("never emits an invalid style, an unsafe id or anything that could close the tag", () => {
    expect(elementCss([{ id: "a", textScope: false, style: { base: { color: "red</style><script>" } } as unknown as ElementStyle }])).toBe("");
    expect(elementCss([{ id: 'x"]{}*{', textScope: false, style: { base: { opacity: 50 } } }])).toBe("");
    expect(elementCss([{ id: "ok", textScope: false, style: { base: { opacity: 50 } } }])).toContain("opacity:0.5");
  });

  it("uses registered fonts only", () => {
    expect(elementCss([{ id: "a", textScope: false, style: { base: { fontFamily: "manrope" } } }])).toContain("font-family:var(--font-manrope)");
  });
});

describe("collecting styled elements from a document", () => {
  const doc = {
    sections: {
      s1: { type: "hero", settings: { _style: { base: { minHeight: 600 } } }, blocks: { b1: { type: "heading", settings: { _style: { base: { color: "#000000" } } }, blocks: {}, block_order: [] } }, block_order: ["b1"] },
      s2: { type: "header", settings: { _style: { base: { opacity: 50 } } }, blocks: {}, block_order: [] },
      s3: { type: "rich-text", settings: {}, blocks: {}, block_order: [] },
    },
  };

  it("finds styled sections and blocks, and skips unstyled ones", () => {
    const targets = collectCssTargets([doc]);
    expect(targets.map((t) => t.id).sort()).toEqual(["b1", "s1", "s2"]);
    expect(targets.find((t) => t.id === "s1")?.textScope).toBe(false);
    expect(targets.find((t) => t.id === "b1")?.textScope).toBe(true);
    expect(documentsCss([doc])).toContain("min-height:600px");
  });

  it("tells styled nodes from plain ones", () => {
    expect(hasStyleOverrides({ settings: {} })).toBe(false);
    expect(hasStyleOverrides({ settings: { _style: {} } })).toBe(false);
    expect(hasStyleOverrides({ settings: { _style: { base: { opacity: 50 } } } })).toBe(true);
  });
});

describe("validateDocument with style overrides", () => {
  const page = (style: unknown) => ({
    schemaVersion: 1,
    layout: "classic",
    sections: { s1: { type: "rich-text", settings: { _style: style }, blocks: { b1: { type: "heading", settings: { text: "Hi", _style: style }, blocks: {}, block_order: [] } }, block_order: ["b1"] } },
    order: ["s1"],
  });

  it("accepts valid overrides on sections and blocks", () => {
    const r = validateDocument("index", page({ base: { color: "#112233", paddingTop: 12 }, mobile: { hidden: true } }), registry, { tenantId: TENANT });
    expect(r.issues.filter((i) => i.level === "error")).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("rejects an unsafe or unknown override with a path to it", () => {
    const r = validateDocument("index", page({ base: { color: "url(javascript:1)", position: "fixed" } }), registry, { tenantId: TENANT });
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.path.includes("settings._style"))).toBe(true);
  });
});

describe("section fonts and text parts", () => {
  it("a section sets the theme's heading and body font variables for itself only", () => {
    const css = elementCss([{ id: "s1", textScope: false, style: { base: { headingFont: "archivo", bodyFont: "jost" } } }]);
    expect(css).toContain("--sf-font-heading:var(--font-archivo)");
    expect(css).toContain("--sf-font-body:var(--font-jost)");
    expect(css).toContain("font-family:var(--sf-font-body)");
  });

  it("a part of text carries validated declarations only", () => {
    expect(partStyleDeclarations({ fontFamily: "jost", fontSize: 22, color: "#112233" })).toBe("font-family:var(--font-jost), sans-serif;font-size:22px;color:#112233");
    expect(partStyleDeclarations({ color: "red;x:y" } as never)).toBe("");
    expect(partStyleSchema.safeParse({ paddingTop: 5 }).success).toBe(false);
  });
});

describe("theme adapters", () => {
  it("each look has an adapter; the sticky header can change fonts only", () => {
    for (const look of ["standard", "boutique", "sport", "market", "unknown-future-look"]) {
      const a = adapterForLook(look);
      expect(a.section("header")?.capabilities).toEqual(["fonts"]);
      expect(a.section("hero")?.capabilities.length).toBeGreaterThan(0);
    }
  });

  it("Stride offers block styling only where the look puts the hook on the block", () => {
    const stride = adapterForLook("sport");
    expect(stride.id).toBe("stride");
    expect(stride.block("button", "hero")).not.toBeNull();
    expect(stride.block("column", "multicolumn")).not.toBeNull();
    expect(stride.block("heading", "rich-text")).toBeNull();
    expect(stride.block("hero-slide", "hero")).toBeNull();
  });

  it("only offers controls that exist as style fields", () => {
    const spec = adapterForLook("sport").block("button", "hero")!;
    const keys = fieldsFor(spec.capabilities).map((f) => f.key);
    expect(keys).toEqual(expect.arrayContaining(["fontSize", "color", "backgroundColor", "paddingTop", "borderRadius", "hidden"]));
  });
});
