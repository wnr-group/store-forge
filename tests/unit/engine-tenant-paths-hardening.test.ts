import { describe, expect, it, vi } from "vitest";
import type { ComponentNode, TemplateDocument } from "../../lib/templates/document";
import * as compileModule from "../../lib/templates/engine/compile";
import type { BlockDefinition, ComponentRegistry, SectionDefinition, SettingDescriptor } from "../../lib/templates/engine/descriptors";
import * as scanModule from "../../lib/templates/engine/image-scan";
import { imageValueSchema } from "../../lib/templates/engine/schema";
import { validateDocument, type Issue } from "../../lib/templates/engine/validate";

// Hardening of the tenant image-path pipeline after the Task 3 security review [AC-ENG-016].
const T = "tenant-a";
const OTHER = "tenant-b";
const BAD_IMG = { path: `${OTHER}/store/x.png`, alt: "x" };
const own = (name = "a.png") => `${T}/store/${name}`;

const settingsDescriptors: SettingDescriptor[] = [
  { id: "image", type: "image", label: "Image", default: null },
  { id: "link", type: "url", label: "Link", default: "" },
];
const heroDef: SectionDefinition = { type: "hero", name: "Hero", settings: settingsDescriptors };
const cardDef: BlockDefinition = { type: "card", name: "Card", settings: settingsDescriptors };
const registry: ComponentRegistry = { sections: { hero: heroDef }, blocks: { card: cardDef } };

function node(type: string, settings: Record<string, unknown> = {}, children: Record<string, ComponentNode> = {}): ComponentNode {
  return { type, settings, blocks: children, block_order: Object.keys(children) };
}
function pageDoc(sections: Record<string, ComponentNode>, order = Object.keys(sections)): TemplateDocument {
  return { schemaVersion: 1, layout: "classic", sections, order };
}
const has = (issues: Issue[], path: string, code: string) => issues.some((i) => i.path === path && i.code === code && i.level === "error");

/** Hostile settings per component flavour: a cross-tenant image, a javascript: URL, an image in an unknown type. */
const PAYLOADS: { label: string; section: string; block: string; settings: Record<string, unknown>; key: string; code: string }[] = [
  { label: "registered image", section: "hero", block: "card", settings: { image: BAD_IMG }, key: "image", code: "CROSS_TENANT_PATH" },
  { label: "registered javascript: url", section: "hero", block: "card", settings: { link: "javascript:alert(1)" }, key: "link", code: "INVALID_SETTING" },
  { label: "unknown-type image", section: "ghost", block: "ghost", settings: { image: BAD_IMG }, key: "image", code: "CROSS_TENANT_PATH" },
];
const ORDER_NAMES = ["constructor", "__proto__", "hasOwnProperty", "toString"];

describe("order lists cannot hide a node from validation [AC-ENG-016]", () => {
  for (const p of PAYLOADS) {
    for (const name of ORDER_NAMES) {
      it(`[AC-ENG-016] ${p.label}: order ["${name}"] still validates the real section`, () => {
        const res = validateDocument("index", pageDoc({ s1: node(p.section, p.settings) }, [name]), registry, { tenantId: T });
        expect(res.ok).toBe(false);
        expect(has(res.issues, "order", "ORDER_MISMATCH")).toBe(true);
        expect(has(res.issues, `sections.s1.settings.${p.key}`, p.code)).toBe(true);
      });

      it(`[AC-ENG-016] ${p.label}: block_order ["${name}"] (section and nested) still validates the real block`, () => {
        const inSection = node("hero", {}, { b1: node(p.block, p.settings) });
        inSection.block_order = [name];
        const r1 = validateDocument("index", pageDoc({ s1: inSection }), registry, { tenantId: T });
        expect(r1.ok).toBe(false);
        expect(has(r1.issues, "sections.s1.block_order", "ORDER_MISMATCH")).toBe(true);
        expect(has(r1.issues, `sections.s1.blocks.b1.settings.${p.key}`, p.code)).toBe(true);

        const b1 = node("card", {}, { b2: node(p.block, p.settings) });
        b1.block_order = [name];
        const r2 = validateDocument("index", pageDoc({ s1: node("hero", {}, { b1 }) }), registry, { tenantId: T });
        expect(r2.ok).toBe(false);
        expect(has(r2.issues, "sections.s1.blocks.b1.block_order", "ORDER_MISMATCH")).toBe(true);
        expect(has(r2.issues, `sections.s1.blocks.b1.blocks.b2.settings.${p.key}`, p.code)).toBe(true);
      });
    }

    it(`[AC-ENG-016] ${p.label}: nodes missing from the order lists are still validated`, () => {
      const clean = (type: string) => node(type);
      const r1 = validateDocument("index", pageDoc({ s1: clean("hero"), s2: node(p.section, p.settings) }, ["s1"]), registry, { tenantId: T });
      expect(r1.ok).toBe(false);
      expect(has(r1.issues, "order", "ORDER_MISMATCH")).toBe(true);
      expect(has(r1.issues, `sections.s2.settings.${p.key}`, p.code)).toBe(true);

      const withBlocks = node("hero", {}, { b1: clean("card"), b2: node(p.block, p.settings) });
      withBlocks.block_order = ["b1"];
      const r2 = validateDocument("index", pageDoc({ s1: withBlocks }), registry, { tenantId: T });
      expect(r2.ok).toBe(false);
      expect(has(r2.issues, `sections.s1.blocks.b2.settings.${p.key}`, p.code)).toBe(true);

      const parent = node("card", {}, { c1: clean("card"), c2: node(p.block, p.settings) });
      parent.block_order = [];
      const r3 = validateDocument("index", pageDoc({ s1: node("hero", {}, { b1: parent }) }), registry, { tenantId: T });
      expect(r3.ok).toBe(false);
      expect(has(r3.issues, `sections.s1.blocks.b1.blocks.c2.settings.${p.key}`, p.code)).toBe(true);
    });
  }

  it("[AC-ENG-016] a section stored under an own `__proto__` key is validated", () => {
    const sections = JSON.parse(JSON.stringify({ x: node("hero", { image: BAD_IMG }) }).replace('"x"', '"__proto__"'));
    const res = validateDocument("index", { schemaVersion: 1, layout: "classic", sections, order: ["__proto__"] }, registry, { tenantId: T });
    expect(res.ok).toBe(false);
    expect(has(res.issues, "sections.__proto__.settings.image", "CROSS_TENANT_PATH")).toBe(true);
  });

  it("[AC-ENG-016] an unlisted node still counts toward duplicate ids", () => {
    const res = validateDocument("index", pageDoc({ s1: node("hero", {}, { s2: node("card") }), s2: node("hero") }, ["s1"]), registry, { tenantId: T });
    expect(res.issues.some((i) => i.code === "DUPLICATE_ID")).toBe(true);
  });
});

describe("root keys and node keys outside the section tree are scanned [AC-ENG-016]", () => {
  const KINDS = ["index", "product", "collection", "theme_settings", "group_header", "group_footer", "group_announcement"] as const;
  const base = (kind: (typeof KINDS)[number]): Record<string, unknown> =>
    kind === "theme_settings" ? { schemaVersion: 1 } : { schemaVersion: 1, ...(kind.startsWith("group") ? {} : { layout: "classic" }), sections: {}, order: [] };

  for (const kind of KINDS) {
    it(`[AC-ENG-016] ${kind}: a root extra key with a cross-tenant image is rejected, without a tenant too`, () => {
      const doc = { ...base(kind), extras: { banner: BAD_IMG } };
      const res = validateDocument(kind, doc, registry, { tenantId: T });
      expect(res.ok).toBe(false);
      expect(has(res.issues, "extras.banner", "CROSS_TENANT_PATH")).toBe(true);
      expect(has(validateDocument(kind, doc, registry).issues, "extras.banner", "TENANT_REQUIRED")).toBe(true);
    });
  }

  it("[AC-ENG-016] theme_settings: a root `layout` image is validated (own tenant passes, others fail)", () => {
    const theme = (path: string) => ({ schemaVersion: 1, layout: { path } });
    expect(validateDocument("theme_settings", theme(own()), registry, { tenantId: T }).ok).toBe(true);
    const cross = validateDocument("theme_settings", theme(BAD_IMG.path), registry, { tenantId: T });
    expect(cross.ok).toBe(false);
    expect(has(cross.issues, "layout", "CROSS_TENANT_PATH")).toBe(true);
    expect(has(validateDocument("theme_settings", theme(own()), registry).issues, "layout", "TENANT_REQUIRED")).toBe(true);
  });

  it("[AC-ENG-016] extra node keys are scanned, in sections and in nested blocks", () => {
    const s1 = { ...node("ghost"), extra: { image: BAD_IMG } };
    const res = validateDocument("index", pageDoc({ s1 }), registry, { tenantId: T });
    expect(has(res.issues, "sections.s1.extra.image", "CROSS_TENANT_PATH")).toBe(true);

    const b1 = { ...node("ghost"), extra: [{ image: BAD_IMG }] };
    const nested = validateDocument("index", pageDoc({ s1: node("hero", {}, { b1 }) }), registry, { tenantId: T });
    expect(has(nested.issues, "sections.s1.blocks.b1.extra.0.image", "CROSS_TENANT_PATH")).toBe(true);
  });

  it("[AC-ENG-016] image-shaped values in block_order or disabled never pass (schema rejects them first)", () => {
    const viaBlockOrder = { ...node("ghost"), block_order: [BAD_IMG] };
    const r1 = validateDocument("index", pageDoc({ s1: viaBlockOrder as unknown as ComponentNode }), registry, { tenantId: T });
    expect(r1.ok).toBe(false);
    expect(r1.issues.map((i) => i.code)).toEqual(["SCHEMA_ERROR"]);
    expect(r1.issues[0].path).toBe("sections.s1.block_order.0");

    const viaDisabled = { ...node("ghost"), disabled: BAD_IMG };
    const r2 = validateDocument("index", pageDoc({ s1: viaDisabled as unknown as ComponentNode }), registry, { tenantId: T });
    expect(r2.ok).toBe(false);
    expect(r2.issues.map((i) => i.code)).toEqual(["SCHEMA_ERROR"]);
    expect(r2.issues[0].path).toBe("sections.s1.disabled");
  });
});

describe("a bounded compiled-schema cache stays correct [AC-ENG-016]", () => {
  const freshRegistry = (): ComponentRegistry => ({ sections: { hero: { ...heroDef } }, blocks: {} });
  const docFor = (tenant: string) => pageDoc({ s1: node("hero", { image: { path: `${tenant}/store/a.png` } }) });

  it("[AC-ENG-016] 40 tenants validate correctly, evicted tenants recompile, no leakage", () => {
    const reg = freshRegistry();
    for (let round = 0; round < 2; round++) {
      for (let i = 0; i < 40; i++) {
        expect(validateDocument("index", docFor(`t${i}`), reg, { tenantId: `t${i}` }).ok).toBe(true);
        expect(validateDocument("index", docFor(`t${i}`), reg, { tenantId: `t${(i + 1) % 40}` }).ok).toBe(false);
      }
    }
    expect(validateDocument("index", docFor("t0"), reg, { tenantId: "t0" }).ok).toBe(true);
    expect(validateDocument("index", docFor("t0"), reg).ok).toBe(false);
    expect(validateDocument("index", docFor("t0"), reg, { tenantId: "t39" }).ok).toBe(false);
  });

  it("[AC-ENG-016] holds at most 32 tenants per definition and evicts the least recently used", () => {
    const reg = freshRegistry();
    const spy = vi.spyOn(compileModule, "compileSettings");
    try {
      const run = (id: string) => validateDocument("index", docFor(id), reg, { tenantId: id });
      for (let i = 0; i < 32; i++) run(`t${i}`);
      expect(spy).toHaveBeenCalledTimes(32);
      run("t0"); // cached, and now the most recently used
      expect(spy).toHaveBeenCalledTimes(32);
      run("t32"); // evicts t1 (least recently used), not t0
      expect(spy).toHaveBeenCalledTimes(33);
      run("t0");
      expect(spy).toHaveBeenCalledTimes(33);
      run("t1"); // was evicted, so it compiles again
      expect(spy).toHaveBeenCalledTimes(34);
    } finally {
      spy.mockRestore();
    }
  });
});

describe("control, format and encoded characters in image paths [AC-ENG-016]", () => {
  const hex = (n: number) => String.fromCodePoint(n);
  const CHARS: [string, string][] = [
    ["C1 U+0080", hex(0x80)], ["C1 U+0085", hex(0x85)], ["C1 U+009F", hex(0x9f)],
    ["U+200B", hex(0x200b)], ["U+200C", hex(0x200c)], ["U+200D", hex(0x200d)], ["LRM U+200E", hex(0x200e)], ["RLM U+200F", hex(0x200f)],
    ["U+202A", hex(0x202a)], ["U+202D", hex(0x202d)], ["RLO U+202E", hex(0x202e)], ["U+2066", hex(0x2066)], ["U+2069", hex(0x2069)], ["BOM U+FEFF", hex(0xfeff)],
  ];
  const ENCODED = [
    "%00", "%01", "%0a", "%0A", "%0d", "%1f", "%1F", "%2500", "%251f", "%252500",
    "%c0%ae", "%C0%AE", "%c0%af", "%C0%AF", "%c1%9c", "%C1%9C", "%25c0%25ae",
  ];
  const reject = (path: string) => {
    expect(imageValueSchema(T).safeParse({ path }).success).toBe(false);
    const res = validateDocument("index", pageDoc({ s1: node("hero", { image: { path } }) }), registry, { tenantId: T });
    expect(res.ok).toBe(false);
    expect(has(res.issues, "sections.s1.settings.image", "CROSS_TENANT_PATH")).toBe(true);
  };

  for (const [label, ch] of CHARS) {
    it(`[AC-ENG-016] rejects ${label} anywhere in the file name`, () => {
      reject(`${T}/store/a${ch}.png`);
      reject(`${T}/store/${ch}a.png`);
    });
  }
  for (const enc of ENCODED) {
    it(`[AC-ENG-016] rejects the percent-encoded sequence ${enc}`, () => reject(`${T}/store/a${enc}b.png`));
  }
  it("[AC-ENG-016] still accepts ordinary percent-encoded and non-ASCII file names", () => {
    for (const name of ["a%20b.png", "café.png", "写真.png"]) {
      expect(imageValueSchema(T).safeParse({ path: own(name) }).success).toBe(true);
    }
  });
});

describe("image-shaped forms that must not slip past the scan [AC-ENG-016]", () => {
  it("[AC-ENG-016] a settings object that is itself image-shaped is checked", () => {
    for (const type of ["ghost", "hero"]) {
      const res = validateDocument("index", pageDoc({ s1: node(type, { path: BAD_IMG.path }) }), registry, { tenantId: T });
      expect(res.ok).toBe(false);
      expect(has(res.issues, "sections.s1.settings", "CROSS_TENANT_PATH")).toBe(true);
      const inBlock = validateDocument("index", pageDoc({ s1: node("hero", {}, { b1: node("ghost", { path: BAD_IMG.path }) }) }), registry, { tenantId: T });
      expect(has(inBlock.issues, "sections.s1.blocks.b1.settings", "CROSS_TENANT_PATH")).toBe(true);
    }
    const noTenant = validateDocument("index", pageDoc({ s1: node("ghost", { path: own() }) }), registry);
    expect(has(noTenant.issues, "sections.s1.settings", "TENANT_REQUIRED")).toBe(true);
    expect(validateDocument("index", pageDoc({ s1: node("ghost", { path: own() }) }), registry, { tenantId: T }).ok).toBe(true);
  });

  it("[AC-ENG-016] theme settings that are themselves image-shaped are checked", () => {
    const res = validateDocument("theme_settings", { schemaVersion: 1, settings: { path: BAD_IMG.path } }, registry, { tenantId: T });
    expect(has(res.issues, "settings", "CROSS_TENANT_PATH")).toBe(true);
  });

  const MALFORMED: [string, unknown][] = [
    ["array path with alt", { path: [BAD_IMG.path], alt: "x" }],
    ["array path with focal", { path: [own()], focal: { x: 1, y: 1 } }],
    ["numeric path", { path: 123 }],
    ["null path", { path: null }],
    ["boolean path", { path: true }],
    ["object path", { path: { nested: own() } }],
  ];
  for (const [label, value] of MALFORMED) {
    it(`[AC-ENG-016] ${label} is rejected as a malformed image (unknown type, registered type, theme)`, () => {
      const unknown = validateDocument("index", pageDoc({ s1: node("ghost", { media: value }) }), registry, { tenantId: T });
      expect(unknown.ok).toBe(false);
      expect(has(unknown.issues, "sections.s1.settings.media", "INVALID_IMAGE")).toBe(true);

      const registered = validateDocument("index", pageDoc({ s1: node("hero", { image: value }) }), registry, { tenantId: T });
      expect(registered.ok).toBe(false);
      expect(has(registered.issues, "sections.s1.settings.image", "INVALID_IMAGE")).toBe(true);

      const theme = validateDocument("theme_settings", { schemaVersion: 1, settings: { logo: value } }, registry, { tenantId: T });
      expect(theme.ok).toBe(false);
      expect(has(theme.issues, "settings.logo", "INVALID_IMAGE")).toBe(true);
    });
  }
});

describe("oversized documents return before any tree walk or scan [AC-ENG-016]", () => {
  it("[AC-ENG-016] returns only DOCUMENT_SIZE_EXCEEDED and never runs the image scan", () => {
    const huge = pageDoc({
      s1: node("hero", { image: BAD_IMG, heading: "x".repeat(300_000) }),
      s2: node("ghost", { image: BAD_IMG }),
    });
    const spy = vi.spyOn(scanModule, "scanImageValues");
    try {
      const res = validateDocument("index", huge, registry, { tenantId: T });
      expect(res.ok).toBe(false);
      expect(res.issues.map((i) => i.code)).toEqual(["DOCUMENT_SIZE_EXCEEDED"]);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it("[AC-ENG-016] the other early returns are unchanged (schema errors stop before the scan)", () => {
    const spy = vi.spyOn(scanModule, "scanImageValues");
    try {
      const res = validateDocument("index", { schemaVersion: 2, sections: {}, order: [], extras: { image: BAD_IMG } }, registry, { tenantId: T });
      expect(res.ok).toBe(false);
      expect(res.issues.every((i) => i.code === "SCHEMA_ERROR")).toBe(true);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});

describe("disabled components are still scanned [AC-ENG-016]", () => {
  for (const type of ["hero", "ghost"]) {
    it(`[AC-ENG-016] images in a disabled ${type} section and in its disabled nested block are rejected`, () => {
      const blockType = type === "hero" ? "card" : "ghost";
      const disabledBlock = { ...node(blockType, { image: BAD_IMG }), disabled: true };
      const section = { ...node(type, { image: BAD_IMG }, { b1: disabledBlock }), disabled: true };
      const res = validateDocument("index", pageDoc({ s1: section }), registry, { tenantId: T });
      expect(res.ok).toBe(false);
      expect(has(res.issues, "sections.s1.settings.image", "CROSS_TENANT_PATH")).toBe(true);
      expect(has(res.issues, "sections.s1.blocks.b1.settings.image", "CROSS_TENANT_PATH")).toBe(true);
    });
  }
});
