import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { indexPreset } from "../../lib/templates/presets";
import { getRegistry } from "../../lib/templates/registry/index";
import { heroSection } from "../../lib/templates/registry/sections/hero";
import { validateDocument } from "../../lib/templates/engine/validate";
import { precheckTreeLimits } from "../../lib/templates/engine/tree-walk";
import type { ComponentRegistry, SectionDefinition } from "../../lib/templates/engine/descriptors";
import type { ComponentNode, TemplateDocument } from "../../lib/templates/document";

describe("Engine Document Validator [AC-ENG-006] [AC-ENG-007] [AC-ENG-008] [AC-ENG-018]", () => {
  const registry = getRegistry();

  it("[AC-ENG-018] validates built-in presets (classic, spotlight) successfully", () => {
    const classicDoc = indexPreset("classic");
    const spotlightDoc = indexPreset("spotlight");

    const resClassic = validateDocument("index", classicDoc, registry);
    expect(resClassic.ok).toBe(true);
    expect(resClassic.issues.filter((i) => i.level === "error")).toHaveLength(0);

    const resSpotlight = validateDocument("index", spotlightDoc, registry);
    expect(resSpotlight.ok).toBe(true);
    expect(resSpotlight.issues.filter((i) => i.level === "error")).toHaveLength(0);
  });

  it("[AC-ENG-006] detects duplicate IDs across sections and blocks", () => {
    const doc: TemplateDocument = {
      schemaVersion: 1,
      layout: "classic",
      sections: {
        hero: {
          type: "hero",
          settings: {},
          blocks: {
            "duplicate-id": { type: "text", settings: {}, blocks: {}, block_order: [] },
          },
          block_order: ["duplicate-id"],
        },
        "duplicate-id": { // duplicate section ID matching block ID
          type: "product-grid",
          settings: {},
          blocks: {},
          block_order: [],
        },
      },
      order: ["hero", "duplicate-id"],
    };

    const res = validateDocument("index", doc, registry);
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.code === "DUPLICATE_ID")).toBe(true);
  });

  it("[AC-ENG-006] enforces exact block_order and section order matching", () => {
    const doc: TemplateDocument = {
      schemaVersion: 1,
      layout: "classic",
      sections: {
        hero: {
          type: "hero",
          settings: {},
          blocks: {
            b1: { type: "text", settings: {}, blocks: {}, block_order: [] },
          },
          block_order: ["b1", "b2"], // b2 is missing in blocks!
        },
      },
      order: ["hero"],
    };

    const res = validateDocument("index", doc, registry);
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.code === "ORDER_MISMATCH")).toBe(true);
  });

  it("[AC-ENG-007] enforces limits: max 25 sections, max 50 blocks/section, max depth 3", () => {
    // Exceed max sections (>25)
    const tooManySections: TemplateDocument = {
      schemaVersion: 1,
      layout: "classic",
      sections: {},
      order: [],
    };
    for (let i = 0; i < 26; i++) {
      const id = `sec-${i}`;
      tooManySections.sections[id] = { type: "hero", settings: {}, blocks: {}, block_order: [] };
      tooManySections.order.push(id);
    }

    const resSections = validateDocument("index", tooManySections, registry);
    expect(resSections.ok).toBe(false);
    expect(resSections.issues.some((i) => i.code === "LIMIT_EXCEEDED" && i.message.includes("sections"))).toBe(true);

    // Exceed depth (>3)
    const tooDeep: TemplateDocument = {
      schemaVersion: 1,
      layout: "classic",
      sections: {
        hero: {
          type: "hero",
          settings: {},
          blocks: {
            // Level 1
            b1: {
              type: "text",
              settings: {},
              blocks: {
                // Level 2
                b2: {
                  type: "text",
                  settings: {},
                  blocks: {
                    // Level 3
                    b3: {
                      type: "text",
                      settings: {},
                      blocks: {
                        // Level 4 (Exceeds depth 3!)
                        b4: { type: "text", settings: {}, blocks: {}, block_order: [] },
                      },
                      block_order: ["b4"],
                    },
                  },
                  block_order: ["b3"],
                },
              },
              block_order: ["b2"],
            },
          },
          block_order: ["b1"],
        },
      },
      order: ["hero"],
    };

    const resDepth = validateDocument("index", tooDeep, registry);
    expect(resDepth.ok).toBe(false);
    expect(resDepth.issues.some((i) => i.code === "DEPTH_EXCEEDED")).toBe(true);
  });

  it("[AC-ENG-008] preserves unknown component types on save and flags them as warnings", () => {
    const docWithUnknown: TemplateDocument = {
      schemaVersion: 1,
      layout: "classic",
      sections: {
        hero: { type: "hero", settings: {}, blocks: {}, block_order: [] },
        future_widget: {
          type: "future-carousel-widget",
          settings: { autoplay: true },
          blocks: {},
          block_order: [],
        },
      },
      order: ["hero", "future_widget"],
    };

    const res = validateDocument("index", docWithUnknown, registry);
    // Document is still valid!
    expect(res.ok).toBe(true);
    // But has a warning issue for the unknown component
    const warning = res.issues.find((i) => i.code === "UNKNOWN_COMPONENT");
    expect(warning).toBeDefined();
    expect(warning?.level).toBe("warning");
    if (res.ok) {
      expect(res.document.sections.future_widget).toBeDefined();
    }
  });
});

describe("Engine validator treats prototype member names as unknown component types [AC-ENG-008] [AC-ENG-016]", () => {
  const TYPE_NAMES = ["constructor", "__proto__", "toString", "hasOwnProperty", "valueOf", "isPrototypeOf"];
  const T = "tenant-a";
  const BAD_IMG = { path: "tenant-b/store/x.png" };
  const customRegistry: ComponentRegistry = {
    sections: { hero: { type: "hero", name: "Hero", settings: [{ id: "image", type: "image", label: "Image", default: null }] } },
    blocks: { card: { type: "card", name: "Card", settings: [{ id: "image", type: "image", label: "Image", default: null }] } },
  };
  const registries: [string, ComponentRegistry][] = [
    ["a test registry", customRegistry],
    ["the real registry", getRegistry()],
  ];
  const sectionDoc = (type: string, settings: Record<string, unknown>): TemplateDocument => ({
    schemaVersion: 1,
    layout: "classic",
    sections: { s1: { type, settings, blocks: {}, block_order: [] } },
    order: ["s1"],
  });
  const blockDoc = (type: string, settings: Record<string, unknown>): TemplateDocument => ({
    schemaVersion: 1,
    layout: "classic",
    sections: {
      s1: {
        type: "hero",
        settings: {},
        blocks: { b1: { type, settings, blocks: {}, block_order: [] } },
        block_order: ["b1"],
      },
    },
    order: ["s1"],
  });

  for (const [regLabel, reg] of registries) {
    for (const name of TYPE_NAMES) {
      it(`[AC-ENG-008] [AC-ENG-016] section type "${name}" (${regLabel}) is UNKNOWN_COMPONENT, never throws, and is image-scanned`, () => {
        const clean = validateDocument("index", sectionDoc(name, { note: "x" }), reg, { tenantId: T });
        expect(clean.issues.find((i) => i.code === "UNKNOWN_COMPONENT")).toMatchObject({ level: "warning", path: "sections.s1.type" });
        expect(clean.ok).toBe(true);

        const bad = validateDocument("index", sectionDoc(name, { image: BAD_IMG }), reg, { tenantId: T });
        expect(bad.ok).toBe(false);
        expect(bad.issues.some((i) => i.code === "CROSS_TENANT_PATH" && i.path === "sections.s1.settings.image")).toBe(true);
      });

      it(`[AC-ENG-008] [AC-ENG-016] block type "${name}" (${regLabel}) is UNKNOWN_COMPONENT, never throws, and is image-scanned`, () => {
        const clean = validateDocument("index", blockDoc(name, { note: "x" }), reg, { tenantId: T });
        expect(clean.issues.find((i) => i.code === "UNKNOWN_COMPONENT")).toMatchObject({
          level: "warning",
          path: "sections.s1.blocks.b1.type",
        });

        const bad = validateDocument("index", blockDoc(name, { image: BAD_IMG }), reg, { tenantId: T });
        expect(bad.ok).toBe(false);
        expect(bad.issues.some((i) => i.code === "CROSS_TENANT_PATH" && i.path === "sections.s1.blocks.b1.settings.image")).toBe(true);
      });
    }
  }
});

describe("Engine validator never throws on adversarial nesting [AC-ENG-007]", () => {
  const registry = getRegistry();
  /** section > `blocks` nested blocks (b1 > b2 > ...), built iteratively so the test itself cannot overflow the stack. */
  function chain(blocks: number): TemplateDocument {
    let leaf: ComponentNode = { type: "text", settings: {}, blocks: {}, block_order: [] };
    for (let i = blocks - 1; i >= 1; i--) leaf = { type: "text", settings: {}, blocks: { [`b${i + 1}`]: leaf }, block_order: [`b${i + 1}`] };
    return {
      schemaVersion: 1,
      layout: "classic",
      sections: { s1: { type: "hero", settings: {}, blocks: { b1: leaf }, block_order: ["b1"] } },
      order: ["s1"],
    };
  }

  for (const blocks of [4, 3000, 20000]) {
    it(`[AC-ENG-007] a chain of ${blocks} nested blocks returns ok:false with DEPTH_EXCEEDED and does not throw`, () => {
      const res = validateDocument("index", chain(blocks), registry);
      expect(res.ok).toBe(false);
      const hit = res.issues.find((i) => i.code === "DEPTH_EXCEEDED");
      expect(hit).toMatchObject({ level: "error" });
      expect(hit?.path).toBe("sections.s1.blocks.b1.blocks.b2.blocks.b3.blocks.b4");
      expect(res.issues.some((i) => i.code === "SCHEMA_ERROR")).toBe(false);
    });
  }

  it("[AC-ENG-007] a chain of exactly 3 nested blocks (depth 3, the limit) is unaffected by the pre-check", () => {
    const res = validateDocument("index", chain(3), registry);
    expect(res.ok).toBe(true);
    expect(res.issues.filter((i) => i.level === "error")).toEqual([]);
  });

  it("[AC-ENG-007] too many components (wide) returns LIMIT_EXCEEDED before the tree is parsed", () => {
    const blocks: Record<string, ComponentNode> = {};
    for (let i = 0; i < 500; i++) blocks[`b${i}`] = { type: "text", settings: {}, blocks: {}, block_order: [] };
    const doc: TemplateDocument = {
      schemaVersion: 1,
      layout: "classic",
      sections: { s1: { type: "hero", settings: {}, blocks, block_order: Object.keys(blocks) } },
      order: ["s1"],
    };
    const res = validateDocument("index", doc, registry);
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.code === "LIMIT_EXCEEDED" && i.path === "")).toBe(true);
  });

  it("[AC-ENG-007] a cyclic document (not JSON) is rejected without hanging or throwing", () => {
    const loop: ComponentNode = { type: "text", settings: {}, blocks: {}, block_order: ["self"] };
    loop.blocks.self = loop;
    const doc: TemplateDocument = {
      schemaVersion: 1,
      layout: "classic",
      sections: { s1: { type: "hero", settings: {}, blocks: { b1: loop }, block_order: ["b1"] } },
      order: ["s1"],
    };
    expect(validateDocument("index", doc, registry).ok).toBe(false);
  });
});

describe("Engine validator limit boundaries are exact [AC-ENG-007]", () => {
  // The real hero section, minus its own 10-children cap, so only the global LIMITS decide these cases.
  const uncappedHero: SectionDefinition = { ...heroSection, maxChildren: undefined };
  const registry: ComponentRegistry = { sections: { hero: uncappedHero }, blocks: {} };
  const text = (): ComponentNode => ({ type: "text", settings: {}, blocks: {}, block_order: [] });
  const errors = (res: ReturnType<typeof validateDocument>) => res.issues.filter((i) => i.level === "error");

  /** `sections` hero sections, each holding `blocksPerSection` flat text blocks. */
  function wide(sections: number, blocksPerSection: number): TemplateDocument {
    const doc: TemplateDocument = { schemaVersion: 1, layout: "classic", sections: {}, order: [] };
    for (let s = 0; s < sections; s++) {
      const blocks: Record<string, ComponentNode> = {};
      for (let b = 0; b < blocksPerSection; b++) blocks[`s${s}b${b}`] = text();
      doc.sections[`s${s}`] = { type: "hero", settings: {}, blocks, block_order: Object.keys(blocks) };
      doc.order.push(`s${s}`);
    }
    return doc;
  }

  it("[AC-ENG-007] exactly 400 components (25 sections + 375 blocks) passes the tree pre-check and full validation", () => {
    const doc = wide(25, 15);
    expect(precheckTreeLimits(doc)).toBeNull();
    const res = validateDocument("index", doc, registry);
    expect(errors(res)).toEqual([]);
    expect(res.ok).toBe(true);
  });

  it("[AC-ENG-007] 401 components returns LIMIT_EXCEEDED at the document level", () => {
    const doc = wide(25, 15);
    doc.sections.s0.blocks.extra = text();
    doc.sections.s0.block_order.push("extra");
    expect(precheckTreeLimits(doc)).toMatchObject({ code: "LIMIT_EXCEEDED", path: "" });
    const res = validateDocument("index", doc, registry);
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.code === "LIMIT_EXCEEDED" && i.path === "")).toBe(true);
  });

  it("[AC-ENG-007] exactly 25 sections is accepted and 26 is rejected", () => {
    expect(validateDocument("index", wide(25, 0), registry).ok).toBe(true);
    const res = validateDocument("index", wide(26, 0), registry);
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.code === "LIMIT_EXCEEDED" && i.path === "sections")).toBe(true);
  });

  it("[AC-ENG-007] exactly 50 blocks in one section is accepted and 51 is rejected", () => {
    expect(validateDocument("index", wide(1, 50), registry).ok).toBe(true);
    const res = validateDocument("index", wide(1, 51), registry);
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.code === "LIMIT_EXCEEDED" && i.path === "sections.s0.blocks")).toBe(true);
  });

  /** One section holding a chain of `levels` nested blocks (b1 > b2 > ...). */
  function nested(levels: number): TemplateDocument {
    let leaf = text();
    for (let i = levels; i >= 2; i--) leaf = { ...text(), blocks: { [`b${i}`]: leaf }, block_order: [`b${i}`] };
    return {
      schemaVersion: 1,
      layout: "classic",
      sections: { s1: { type: "hero", settings: {}, blocks: { b1: leaf }, block_order: ["b1"] } },
      order: ["s1"],
    };
  }

  it("[AC-ENG-007] block depth 3 is accepted and depth 4 is rejected", () => {
    expect(validateDocument("index", nested(3), registry).ok).toBe(true);
    const res = validateDocument("index", nested(4), registry);
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.code === "DEPTH_EXCEEDED")).toBe(true);
  });
});

describe("Engine source files contain no raw control or invisible characters [AC-ENG-016]", () => {
  // NUL, C1 controls, zero-width and bidi controls, line/paragraph separators, invisible operators and the BOM:
  // keeps Git treating the files as text and rules out Trojan-Source style tricks.
  const FORBIDDEN_RANGES: [number, number][] = [[0x00, 0x00], [0x80, 0x9f], [0x200b, 0x200f], [0x2028, 0x202e], [0x2060, 0x2069], [0xfeff, 0xfeff]];
  const hasForbidden = (text: string) => [...text].some((ch) => FORBIDDEN_RANGES.some(([lo, hi]) => ch.codePointAt(0)! >= lo && ch.codePointAt(0)! <= hi));
  // The whole of lib/templates (engine, registry and the support modules beside them) and every unit test.
  const dirs = ["../../lib/templates", "../../tests/unit"];

  function tsFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? tsFiles(join(dir, e.name)) : e.name.endsWith(".ts") ? [join(dir, e.name)] : [],
    );
  }

  it("[AC-ENG-016] no .ts file under lib/templates or tests/unit contains one literally", () => {
    const files = dirs.flatMap((d) => tsFiles(join(__dirname, d)));
    expect(files.length).toBeGreaterThan(30);
    // Spot-check that the scan really reaches the engine, the support modules and the unit tests.
    for (const rel of ["lib/templates/engine/validate.ts", "lib/templates/limits.ts", "tests/unit/engine-validate.test.ts"]) {
      expect(files.some((f) => f.replace(/\\/g, "/").endsWith(rel))).toBe(true);
    }
    const offenders = files.filter((f) => hasForbidden(readFileSync(f).toString("utf8")));
    expect(offenders).toEqual([]);
  });

  it("[AC-ENG-016] the detector flags each forbidden range and passes ordinary text", () => {
    for (const code of [0x00, 0x85, 0x200b, 0x202e, 0x2028, 0x2066, 0xfeff]) {
      expect(hasForbidden(`a${String.fromCharCode(code)}b`)).toBe(true);
    }
    expect(hasForbidden("plain text, café, tab\t and newline\r\n")).toBe(false);
  });
});
