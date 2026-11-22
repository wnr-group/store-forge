import { describe, expect, it } from "vitest";
import { TEMPLATE_KINDS, type ComponentNode, type TemplateDocument, type TemplateKind } from "../../lib/templates/document";
import { compileSettings } from "../../lib/templates/engine/compile";
import type { ComponentRegistry } from "../../lib/templates/engine/descriptors";
import { getRootSchema } from "../../lib/templates/engine/root-schema";
import { validateDocument } from "../../lib/templates/engine/validate";
import { jsonbByteLength } from "../../lib/templates/engine/size";
import { LIMITS } from "../../lib/templates/limits";
import { getRegistry } from "../../lib/templates/registry/index";

const node = (type: string, children: Record<string, ComponentNode> = {}, settings: Record<string, unknown> = {}): ComponentNode => ({
  type,
  settings,
  blocks: children,
  block_order: Object.keys(children),
});

const page = (sections: Record<string, ComponentNode>, order = Object.keys(sections)): TemplateDocument => ({
  schemaVersion: 1,
  layout: "classic",
  sections,
  order,
});

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

const registry: ComponentRegistry = {
  sections: {
    box: { type: "box", name: "Box", accepts: ["leaf", "group"], maxChildren: 2, settings: [] },
    free: { type: "free", name: "Free", settings: [] },
  },
  blocks: {
    group: { type: "group", name: "Group", accepts: ["leaf"], maxChildren: 1, settings: [] },
    leaf: { type: "leaf", name: "Leaf", settings: [] },
    other: { type: "other", name: "Other", settings: [] },
  },
};

const errors = (res: { issues: { level: string; code: string; path: string }[] }) =>
  res.issues.filter((i) => i.level === "error").map((i) => `${i.code}@${i.path}`);

describe("Each of the seven kinds has its own root schema [AC-ENG-005]", () => {
  const SAMPLES: Record<TemplateKind, unknown> = {
    index: { schemaVersion: 1, layout: "classic", sections: {}, order: [] },
    product: { schemaVersion: 1, layout: "spotlight", sections: {}, order: [] },
    collection: { schemaVersion: 1, layout: "classic", sections: {}, order: [] },
    group_header: { schemaVersion: 1, sections: {}, order: [] },
    group_footer: { schemaVersion: 1, layout: "classic", sections: {}, order: [] },
    group_announcement: { schemaVersion: 1, sections: {}, order: [] },
    theme_settings: { schemaVersion: 1, settings: { colors: { primary: "#112233" }, typography: { headingFont: "inter" } } },
  };
  const PAGE = ["index", "product", "collection"] as const;
  const GROUP = ["group_header", "group_footer", "group_announcement"] as const;

  it("[AC-ENG-005] all seven kinds are covered and each accepts its own valid sample", () => {
    expect(Object.keys(SAMPLES).sort()).toEqual([...TEMPLATE_KINDS].sort());
    for (const kind of TEMPLATE_KINDS) {
      expect({ kind, ok: getRootSchema(kind).safeParse(SAMPLES[kind]).success }).toEqual({ kind, ok: true });
      expect({ kind, ok: validateDocument(kind, SAMPLES[kind], registry).ok }).toEqual({ kind, ok: true });
    }
  });

  it("[AC-ENG-005] every kind rejects a wrong or missing schemaVersion and non-object input", () => {
    for (const kind of TEMPLATE_KINDS) {
      const base = SAMPLES[kind] as Record<string, unknown>;
      for (const schemaVersion of [0, 3, "1", null, undefined, 1.5]) {
        expect({ kind, schemaVersion, ok: getRootSchema(kind).safeParse({ ...base, schemaVersion }).success }).toEqual({
          kind,
          schemaVersion,
          ok: false,
        });
      }
      for (const bad of [null, undefined, [], "doc", 7, true]) {
        expect({ kind, ok: validateDocument(kind, bad, registry).ok }).toEqual({ kind, ok: false });
      }
    }
  });

  it("[AC-ENG-005] page kinds require layout, sections and order; the others' samples are not page documents", () => {
    for (const kind of PAGE) {
      const schema = getRootSchema(kind);
      const base = SAMPLES[kind] as Record<string, unknown>;
      for (const key of ["layout", "sections", "order"]) {
        const rest = Object.fromEntries(Object.entries(base).filter(([name]) => name !== key));
        expect({ kind, key, ok: schema.safeParse(rest).success }).toEqual({ kind, key, ok: false });
      }
      for (const other of [...GROUP.filter((k) => k !== "group_footer"), "theme_settings"] as const) {
        expect({ kind, other, ok: schema.safeParse(SAMPLES[other]).success }).toEqual({ kind, other, ok: false });
      }
    }
  });

  it("[AC-ENG-005] group kinds require sections and order, take an optional layout, and reject the theme sample", () => {
    for (const kind of GROUP) {
      const schema = getRootSchema(kind);
      const base = SAMPLES.group_header as Record<string, unknown>;
      expect(schema.safeParse(base).success).toBe(true);
      expect(schema.safeParse({ ...base, layout: "spotlight" }).success).toBe(true);
      expect(schema.safeParse({ ...base, layout: "default" }).success).toBe(false);
      for (const key of ["sections", "order"]) {
        const rest = Object.fromEntries(Object.entries(base).filter(([name]) => name !== key));
        expect({ kind, key, ok: schema.safeParse(rest).success }).toEqual({ kind, key, ok: false });
      }
      expect(schema.safeParse(SAMPLES.theme_settings).success).toBe(false);
    }
  });

  it("[AC-ENG-005] theme_settings rejects its own invalid values: bad colours, unknown fonts, out-of-range numbers and bad social links", () => {
    const schema = getRootSchema("theme_settings");
    const theme = (settings: unknown) => schema.safeParse({ schemaVersion: 1, settings }).success;
    expect(theme({})).toBe(true);
    expect(theme({ colors: { primary: "red" } })).toBe(false);
    expect(theme({ colors: { primary: "#12345" } })).toBe(false);
    expect(theme({ typography: { headingFont: "comic-sans" } })).toBe(false);
    expect(theme({ typography: { baseSize: 5 } })).toBe(false);
    expect(theme({ layout: { pageWidth: 100 } })).toBe(false);
    expect(theme({ buttons: { radius: 51 } })).toBe(false);
    expect(theme({ social: { twitter: "http://x.com/a" } })).toBe(false);
    expect(theme({ social: { myspace: "https://myspace.com/a" } })).toBe(false);
    expect(theme("settings")).toBe(false);
  });

  it("[AC-ENG-005] the kind decides the schema through validateDocument: the same document is valid for one kind and invalid for another", () => {
    const group = SAMPLES.group_header;
    expect(validateDocument("group_header", group, registry).ok).toBe(true);
    expect(validateDocument("index", group, registry).ok).toBe(false);
    const pageDoc = { schemaVersion: 1, layout: "classic", sections: {}, order: [] };
    expect(validateDocument("index", pageDoc, registry).ok).toBe(true);
    expect(validateDocument("theme_settings", { schemaVersion: 1, settings: { colors: { primary: "nope" } } }, registry).ok).toBe(false);
  });
});

describe("Tree validation [AC-ENG-006]", () => {
  const issuesFor = (d: unknown) => errors(validateDocument("index", d, registry));

  it("[AC-ENG-006] ids are unique across the whole document: section vs block, block vs block in two sections, nested", () => {
    const sectionVsBlock = page({ x: node("free", { x: node("leaf") }) });
    expect(issuesFor(sectionVsBlock)).toEqual(["DUPLICATE_ID@sections.x.blocks.x"]);

    const twoSections = page({ s1: node("free", { b: node("leaf") }), s2: node("free", { b: node("leaf") }) });
    expect(issuesFor(twoSections)).toEqual(["DUPLICATE_ID@sections.s2.blocks.b"]);

    const nested = page({ s1: node("free", { p: node("leaf", { q: node("leaf") }) }), s2: node("free", { q: node("leaf") }) });
    expect(issuesFor(nested)).toEqual(["DUPLICATE_ID@sections.s2.blocks.q"]);

    const parentAndChild = page({ s1: node("free", { p: node("group", { p: node("leaf") }) }) });
    expect(issuesFor(parentAndChild)).toEqual(["DUPLICATE_ID@sections.s1.blocks.p.blocks.p"]);

    const distinct = page({ s1: node("free", { a: node("leaf") }), s2: node("free", { b: node("leaf") }) });
    expect(issuesFor(distinct)).toEqual([]);
  });

  it("[AC-ENG-006] section order must be exact: missing, extra, duplicated and unknown ids", () => {
    const sections = { s1: node("free"), s2: node("free") };
    const cases: Record<string, string[]> = {
      missing: ["s1"],
      extra: ["s1", "s2", "s3"],
      duplicate: ["s1", "s1"],
      duplicatePlusMissing: ["s1", "s1", "s1"],
      unknown: ["s1", "nope"],
      empty: [],
    };
    for (const [name, order] of Object.entries(cases)) {
      expect({ name, codes: issuesFor(page(sections, order)) }).toEqual({ name, codes: ["ORDER_MISMATCH@order"] });
    }
    expect(issuesFor(page(sections, ["s2", "s1"]))).toEqual([]);
  });

  it("[AC-ENG-006] block_order must be exact in a section and in a nested block: missing, extra, duplicated and unknown ids", () => {
    const withOrder = (order: string[]): ComponentNode => ({ ...node("free", { a: node("leaf"), b: node("leaf") }), block_order: order });
    for (const [name, order] of Object.entries({ missing: ["a"], extra: ["a", "b", "c"], duplicate: ["a", "a"], unknown: ["a", "z"], empty: [] })) {
      expect({ name, codes: issuesFor(page({ s1: withOrder(order) })) }).toEqual({ name, codes: ["ORDER_MISMATCH@sections.s1.block_order"] });
    }
    const nested = page({ s1: node("free", { p: { ...node("group", { q: node("leaf") }), block_order: ["q", "q"] } }) });
    expect(issuesFor(nested)).toEqual(["ORDER_MISMATCH@sections.s1.blocks.p.block_order"]);
  });

  it("[AC-ENG-006] accepts: a child type the parent section or block does not list is an error at its type path", () => {
    const section = page({ s1: node("box", { a: node("other") }) });
    expect(issuesFor(section)).toEqual(["INVALID_CHILD_TYPE@sections.s1.blocks.a.type"]);
    const block = page({ s1: node("free", { g: node("group", { x: node("other") }) }) });
    expect(issuesFor(block)).toEqual(["INVALID_CHILD_TYPE@sections.s1.blocks.g.blocks.x.type"]);
    expect(issuesFor(page({ s1: node("box", { a: node("leaf"), g: node("group", { x: node("leaf") }) }) }))).toEqual([]);
    // A section with no accepts list takes any block type.
    expect(issuesFor(page({ s1: node("free", { a: node("other") }) }))).toEqual([]);
  });

  it("[AC-ENG-006] maxChildren: one over the limit is an error on the blocks path, exactly the limit is fine", () => {
    expect(issuesFor(page({ s1: node("box", { a: node("leaf"), b: node("leaf"), c: node("leaf") }) }))).toEqual([
      "MAX_CHILDREN_EXCEEDED@sections.s1.blocks",
    ]);
    expect(issuesFor(page({ s1: node("box", { a: node("leaf"), b: node("leaf") }) }))).toEqual([]);
    expect(issuesFor(page({ s1: node("free", { g: node("group", { x: node("leaf"), y: node("leaf") }) }) }))).toEqual([
      "MAX_CHILDREN_EXCEEDED@sections.s1.blocks.g.blocks",
    ]);
    expect(issuesFor(page({ s1: node("free", { g: node("group", { x: node("leaf") }) }) }))).toEqual([]);
  });

  it("[AC-ENG-006] the real hero section enforces its accepts list and maxChildren", () => {
    const real = getRegistry();
    const heroWith = (children: Record<string, ComponentNode>) => page({ hero: node("hero", children) });
    expect(errors(validateDocument("index", heroWith({ t: node("image") }), real))).toEqual(["INVALID_CHILD_TYPE@sections.hero.blocks.t.type"]);
    const eleven = Object.fromEntries(Array.from({ length: 11 }, (_, i) => [`b${i}`, node("button")]));
    expect(errors(validateDocument("index", heroWith(eleven), real))).toEqual(["MAX_CHILDREN_EXCEEDED@sections.hero.blocks"]);
    const ten = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`b${i}`, node("button")]));
    expect(errors(validateDocument("index", heroWith(ten), real))).toEqual([]);
  });
});

describe("Limit boundaries, with the exact D6 numbers [AC-ENG-007]", () => {
  it("[AC-ENG-007] the limits are the D6 numbers, verbatim", () => {
    expect(LIMITS.maxBlockDepth).toBe(3);
    expect(LIMITS.maxSectionsPerTemplate).toBe(25);
    expect(LIMITS.maxBlocksPerSection).toBe(50);
    expect(LIMITS.maxComponentsPerTemplate).toBe(400);
    expect(LIMITS.maxDocumentBytes).toBe(256 * 1024);
    expect(LIMITS.maxDocumentBytes).toBe(262_144);
    expect(LIMITS.maxTextLength).toBe(5000);
    expect(LIMITS.maxRichtextLength).toBe(20_000);
  });

  /** A document of exactly `target` UTF-8 bytes as the database measures it (jsonb text form, see size.ts), padded mostly with 3-byte characters. */
  function docOfBytes(target: number): TemplateDocument {
    const make = (blob: string) => page({ s1: node("future", {}, { blob }) });
    const pad = target - jsonbByteLength(make(""));
    const euros = Math.floor(pad / 3);
    const doc = make(String.fromCharCode(0x20ac).repeat(euros) + "a".repeat(pad - euros * 3));
    expect(jsonbByteLength(doc)).toBe(target);
    return doc;
  }

  it("[AC-ENG-007] 262144 bytes passes and 262145 fails, counted in UTF-8 bytes of a multibyte document", () => {
    const atLimit = docOfBytes(LIMITS.maxDocumentBytes);
    const over = docOfBytes(LIMITS.maxDocumentBytes + 1);
    // The character count is far below the byte limit, so a length-based check would let both through.
    expect(JSON.stringify(over).length).toBeLessThan(LIMITS.maxDocumentBytes / 2);
    expect(errors(validateDocument("index", atLimit, registry))).toEqual([]);
    expect(errors(validateDocument("index", over, registry))).toEqual(["DOCUMENT_SIZE_EXCEEDED@"]);
    expect(validateDocument("index", docOfBytes(LIMITS.maxDocumentBytes - 1), registry).ok).toBe(true);
  });

  it("[AC-ENG-007] text and textarea take 5000 characters and refuse 5001, through the compiled controls and the document validator", () => {
    for (const type of ["text", "textarea"] as const) {
      const { schema } = compileSettings([{ id: "v", type, label: "V", default: "" }]);
      expect(schema.safeParse({ v: "a".repeat(5000) }).success).toBe(true);
      expect(schema.safeParse({ v: "a".repeat(5001) }).success).toBe(false);
    }
    // A descriptor cannot raise the central limit.
    const raised = compileSettings([{ id: "v", type: "text", label: "V", default: "", max: 10_000 }]).schema;
    expect(raised.safeParse({ v: "a".repeat(5000) }).success).toBe(true);
    expect(raised.safeParse({ v: "a".repeat(5001) }).success).toBe(false);

    const real = getRegistry();
    const heroDoc = (heading: string) => page({ hero: node("hero", {}, { heading, subheading: heading }) });
    expect(errors(validateDocument("index", heroDoc("a".repeat(5000)), real))).toEqual([]);
    expect(errors(validateDocument("index", heroDoc("a".repeat(5001)), real))).toEqual([
      "INVALID_SETTING@sections.hero.settings.heading",
      "INVALID_SETTING@sections.hero.settings.subheading",
    ]);
  });

  it("[AC-ENG-007] richtext takes 20000 characters and refuses 20001, through the compiled control and the document validator", () => {
    const { schema } = compileSettings([{ id: "v", type: "richtext", label: "V", default: "" }]);
    expect(schema.safeParse({ v: "a".repeat(20_000) }).success).toBe(true);
    expect(schema.safeParse({ v: "a".repeat(20_001) }).success).toBe(false);

    const rich: ComponentRegistry = {
      sections: { copy: { type: "copy", name: "Copy", settings: [{ id: "body", type: "richtext", label: "Body", default: "" }] } },
      blocks: {},
    };
    const copyDoc = (body: string) => page({ c: node("copy", {}, { body }) });
    expect(errors(validateDocument("index", copyDoc("a".repeat(20_000)), rich))).toEqual([]);
    expect(errors(validateDocument("index", copyDoc("a".repeat(20_001)), rich))).toEqual(["INVALID_SETTING@sections.c.settings.body"]);
  });

  it("[AC-ENG-007] depth 3 passes and depth 4 fails; 25 sections pass and 26 fail; 50 blocks pass and 51 fail; 400 components pass and 401 fail", () => {
    const chain = (depth: number): ComponentNode => {
      let inner: Record<string, ComponentNode> = {};
      for (let level = depth; level >= 1; level--) inner = { [`d${level}`]: node("free", inner) };
      return node("free", inner);
    };
    expect(errors(validateDocument("index", page({ s1: chain(3) }), registry))).toEqual([]);
    expect(errors(validateDocument("index", page({ s1: chain(4) }), registry))).toEqual([
      "DEPTH_EXCEEDED@sections.s1.blocks.d1.blocks.d2.blocks.d3.blocks.d4",
    ]);

    const sections = (n: number) => page(Object.fromEntries(Array.from({ length: n }, (_, i) => [`s${i}`, node("free")])));
    expect(errors(validateDocument("index", sections(25), registry))).toEqual([]);
    expect(errors(validateDocument("index", sections(26), registry))).toEqual(["LIMIT_EXCEEDED@sections"]);

    const blocks = (n: number) =>
      page({ s: node("free", Object.fromEntries(Array.from({ length: n }, (_, i) => [`b${i}`, node("leaf")]))) });
    expect(errors(validateDocument("index", blocks(50), registry))).toEqual([]);
    expect(errors(validateDocument("index", blocks(51), registry))).toEqual(["LIMIT_EXCEEDED@sections.s.blocks"]);

    const components = (blocksEach: number, count: number) =>
      page(
        Object.fromEntries(
          Array.from({ length: count }, (_, s) => [
            `s${s}`,
            node("free", Object.fromEntries(Array.from({ length: blocksEach }, (_, b) => [`s${s}b${b}`, node("leaf")]))),
          ]),
        ),
      );
    // 8 sections x (1 + 49 blocks) = 400; one more block makes 401.
    expect(errors(validateDocument("index", components(49, 8), registry))).toEqual([]);
    const over = components(49, 8);
    over.sections.s0.blocks.extra = node("leaf");
    over.sections.s0.block_order.push("extra");
    expect(errors(validateDocument("index", over, registry))).toEqual(["LIMIT_EXCEEDED@"]);
  });
});

describe("Unknown component types are preserved and flagged [AC-ENG-008]", () => {
  const future = (): TemplateDocument =>
    page({
      hero: node("hero", {}, { heading: "Hi" }),
      // product-grid has no accepts list, so an unknown block inside it is only a warning.
      grid: node("product-grid", { u1: node("sparkle", {}, { glow: 3, nested: { list: [1, { a: "b" }] } }) }, { columns: 3 }),
      fut: node(
        "future-widget",
        { n1: node("also-future", { n2: node("deeper-future", {}, { keep: ["me"] }) }, { x: 1 }) },
        { mode: "x", config: { a: [1, 2, 3], b: null } },
      ),
    });

  it("[AC-ENG-008] a document with unknown sections and blocks at several depths comes back deep-equal, ok, with a warning per unknown node", () => {
    const input = deepFreeze(future());
    const snapshot = JSON.parse(JSON.stringify(input));
    const res = validateDocument("index", input, getRegistry());
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.document).toEqual(snapshot);
    expect(JSON.parse(JSON.stringify(res.document))).toEqual(snapshot);
    expect(input).toEqual(snapshot);
    const warnings = res.issues.filter((i) => i.code === "UNKNOWN_COMPONENT");
    expect(warnings.map((w) => w.path).sort()).toEqual(
      ["sections.fut.type", "sections.fut.blocks.n1.type", "sections.fut.blocks.n1.blocks.n2.type", "sections.grid.blocks.u1.type"].sort(),
    );
    for (const w of warnings) expect(w.level).toBe("warning");
    expect(res.issues.filter((i) => i.level === "error")).toEqual([]);
  });

  it("[AC-ENG-008] the warning names the unknown type", () => {
    const res = validateDocument("index", future(), getRegistry());
    const fut = res.issues.find((i) => i.path === "sections.fut.type");
    expect(fut?.message).toContain("future-widget");
    const block = res.issues.find((i) => i.path === "sections.grid.blocks.u1.type");
    expect(block?.message).toContain("sparkle");
  });

  it("[AC-ENG-008] known sections are still validated next to unknown ones, and the warnings are still reported", () => {
    const d = future();
    d.sections.hero.settings.accentColor = "not-a-colour";
    const res = validateDocument("index", d, getRegistry());
    expect(res.ok).toBe(false);
    expect(errors(res)).toEqual(["INVALID_SETTING@sections.hero.settings.accentColor"]);
    expect(res.issues.filter((i) => i.level === "warning")).toHaveLength(4);
  });

  it("[AC-ENG-008] an unknown node still gets the structural checks: ids, order and accepts of its parent", () => {
    const orderBroken = page({ fut: { ...node("future-widget", { n: node("leaf") }), block_order: [] } });
    expect(errors(validateDocument("index", orderBroken, registry))).toEqual(["ORDER_MISMATCH@sections.fut.block_order"]);
    const dup = page({ a: node("future-widget", { a: node("whatever") }) });
    expect(errors(validateDocument("index", dup, registry))).toEqual(["DUPLICATE_ID@sections.a.blocks.a"]);
    const notAccepted = page({ s: node("box", { u: node("whatever") }) });
    expect(errors(validateDocument("index", notAccepted, registry))).toEqual(["INVALID_CHILD_TYPE@sections.s.blocks.u.type"]);
  });

  it("[AC-ENG-008] unknown components count towards every limit", () => {
    const manySections = page(Object.fromEntries(Array.from({ length: 26 }, (_, i) => [`s${i}`, node(`mystery-${i}`)])));
    expect(errors(validateDocument("index", manySections, registry))).toEqual(["LIMIT_EXCEEDED@sections"]);

    const manyBlocks = page({ s: node("mystery", Object.fromEntries(Array.from({ length: 51 }, (_, i) => [`b${i}`, node("unknown-block")]))) });
    expect(errors(validateDocument("index", manyBlocks, registry))).toEqual(["LIMIT_EXCEEDED@sections.s.blocks"]);

    const deep = page({ s: node("mystery", { a: node("m", { b: node("m", { c: node("m", { d: node("m") }) }) }) }) });
    expect(errors(validateDocument("index", deep, registry))).toEqual([
      "DEPTH_EXCEEDED@sections.s.blocks.a.blocks.b.blocks.c.blocks.d",
    ]);

    const huge = page(
      Object.fromEntries(
        Array.from({ length: 9 }, (_, s) => [
          `s${s}`,
          node("mystery", Object.fromEntries(Array.from({ length: s === 0 ? 40 : 45 }, (_, b) => [`s${s}b${b}`, node("m")]))),
        ]),
      ),
    );
    expect(errors(validateDocument("index", huge, registry))).toEqual(["LIMIT_EXCEEDED@"]);
  });
});
