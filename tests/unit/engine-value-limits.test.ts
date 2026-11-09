import { describe, expect, it } from "vitest";
import type { ComponentRegistry } from "../../lib/templates/engine/descriptors";
import { validateDocument } from "../../lib/templates/engine/validate";
import { LIMITS } from "../../lib/templates/limits";
import { getRegistry } from "../../lib/templates/registry/index";

// Round 3, items 1, 2 and 6: values nested deeper than LIMITS.maxValueDepth are refused (JSON.stringify and the
// save path's clone recurse and would crash), text PostgreSQL jsonb cannot store is refused with a clean issue,
// and the last-resort INTERNAL_ERROR names the failing error type.
const registry = getRegistry();
const T = "tenant-a";

const deepArray = (levels: number): unknown => {
  let value: unknown = [1];
  for (let i = 1; i < levels; i++) value = [value];
  return value;
};
const deepObject = (levels: number): unknown => {
  let value: unknown = { k: 1 };
  for (let i = 1; i < levels; i++) value = { k: value };
  return value;
};

const section = (type: string, settings: Record<string, unknown>) => ({ type, settings, blocks: {}, block_order: [] });
const indexDoc = (sections: Record<string, unknown>) => ({ schemaVersion: 1, layout: "classic", sections, order: Object.keys(sections) });
const themeDoc = (settings: Record<string, unknown>) => ({ schemaVersion: 1, settings });
const codes = (res: ReturnType<typeof validateDocument>) => res.issues.map((i) => `${i.code}@${i.path}`);

describe("deeply nested values are refused with DEPTH_EXCEEDED, never a throw [AC-ENG-006] [AC-ENG-016]", () => {
  const DEEP = 20_000;
  const cases: { label: string; kind: "index" | "theme_settings"; build: (deep: unknown) => unknown; tenant?: string }[] = [
    { label: "an unknown component's settings", kind: "index", build: (d) => indexDoc({ s: section("ghost", { x: d }) }) },
    { label: "a registered section's setting", kind: "index", build: (d) => indexDoc({ s: section("hero", { heading: d }) }) },
    { label: "an undeclared key of a registered section", kind: "index", build: (d) => indexDoc({ s: section("hero", { notDeclared: d }) }) },
    {
      label: "a binding fallback",
      kind: "index",
      build: (d) => indexDoc({ s: section("hero", { heading: { $bind: { source: "store.name", fallback: d } } }) }),
    },
    {
      label: "a block's settings",
      kind: "index",
      build: (d) => ({
        schemaVersion: 1,
        layout: "classic",
        sections: { s: { type: "ghost", settings: {}, blocks: { b: section("ghost", { x: d }) }, block_order: ["b"] } },
        order: ["s"],
      }),
    },
    { label: "a theme setting", kind: "theme_settings", build: (d) => themeDoc({ favicon: d }) },
    { label: "a theme colour", kind: "theme_settings", build: (d) => themeDoc({ colors: { primary: d } }) },
    { label: "an extra root key", kind: "index", build: (d) => ({ ...indexDoc({}), extra: d }) },
  ];

  for (const { label, kind, build } of cases) {
    for (const [shape, make] of [
      ["array", deepArray],
      ["object", deepObject],
    ] as const) {
      it(`[AC-ENG-006] ${shape} ${DEEP} levels deep in ${label}: ok:false DEPTH_EXCEEDED at path "", with and without a tenant`, () => {
        for (const context of [undefined, { tenantId: T }]) {
          const res = validateDocument(kind, build(make(DEEP)), registry, context);
          expect(res.ok).toBe(false);
          expect(codes(res)).toContain("DEPTH_EXCEEDED@");
          expect(res.issues.some((i) => i.code === "INTERNAL_ERROR")).toBe(false);
        }
      });
    }
  }

  it("[AC-ENG-006] a value just over the depth limit is refused, one at the limit is still accepted when the rest is valid", () => {
    // The wrapper levels above the value (document, sections, section, settings) count towards the depth.
    const overhead = 4;
    const fits = validateDocument("index", indexDoc({ s: section("ghost", { x: deepArray(LIMITS.maxValueDepth - overhead) }) }), registry);
    expect(fits.ok).toBe(true);
    const tooDeep = validateDocument("index", indexDoc({ s: section("ghost", { x: deepArray(LIMITS.maxValueDepth - overhead + 1) }) }), registry);
    expect(tooDeep.ok).toBe(false);
    expect(codes(tooDeep)).toEqual(["DEPTH_EXCEEDED@"]);
  });

  it("[AC-ENG-006] the saved document can always be serialized: every accepted value survives JSON.stringify and structuredClone", () => {
    const doc = indexDoc({ s: section("ghost", { x: deepArray(LIMITS.maxValueDepth - 4) }) });
    const res = validateDocument("index", doc, registry);
    expect(res.ok).toBe(true);
    expect(() => JSON.stringify(res.ok ? res.document : null)).not.toThrow();
    expect(() => structuredClone(res.ok ? res.document : null)).not.toThrow();
  });

  it("[AC-ENG-006] a block chain deeper than the block limit still reports DEPTH_EXCEEDED at the block path", () => {
    let node: unknown = section("ghost", {});
    for (let i = 0; i < 30; i++) node = { type: "card", settings: {}, blocks: { c: node }, block_order: ["c"] };
    const res = validateDocument("index", indexDoc({ s: node }), registry);
    expect(res.ok).toBe(false);
    const depth = res.issues.find((i) => i.code === "DEPTH_EXCEEDED");
    expect(depth?.path).toMatch(/^sections\.s\.blocks\.c/);
  });
});

describe("text PostgreSQL jsonb cannot store is refused with UNSUPPORTED_TEXT [AC-ENG-006]", () => {
  const nul = String.fromCharCode(0);
  const high = String.fromCharCode(0xd800);
  const low = String.fromCharCode(0xdc00);
  const bad = { NUL: `a${nul}b`, "lone high surrogate": `a${high}b`, "lone low surrogate": `a${low}b` };

  for (const [label, text] of Object.entries(bad)) {
    it(`[AC-ENG-006] ${label} in a value is refused`, () => {
      const res = validateDocument("index", indexDoc({ s: section("ghost", { x: text }) }), registry);
      expect(res.ok).toBe(false);
      expect(res.issues).toContainEqual({
        path: "",
        code: "UNSUPPORTED_TEXT",
        message: "Text cannot contain NUL characters or unpaired surrogates",
        level: "error",
      });
      expect(res.issues.some((i) => i.code === "SERIALIZATION_ERROR")).toBe(false);
    });

    it(`[AC-ENG-006] ${label} in a key is refused`, () => {
      const res = validateDocument("index", indexDoc({ s: section("ghost", { [text]: 1 }) }), registry);
      expect(res.ok).toBe(false);
      expect(codes(res)).toContain("UNSUPPORTED_TEXT@");
    });

    it(`[AC-ENG-006] ${label} in a theme setting and under a registered setting is refused`, () => {
      // A root-level extra key of a theme document: `settings` itself accepts only known keys now, so an unknown
      // settings key would fail the schema before the storage check.
      expect(codes(validateDocument("theme_settings", { schemaVersion: 1, favicon: text }, registry))).toContain("UNSUPPORTED_TEXT@");
      expect(codes(validateDocument("index", indexDoc({ s: section("hero", { heading: text }) }), registry))).toContain("UNSUPPORTED_TEXT@");
    });
  }

  it("[AC-ENG-006] UNSUPPORTED_TEXT does not hide the other findings: a NUL inside an image path is also a CROSS_TENANT_PATH", () => {
    const res = validateDocument("index", indexDoc({ s: section("ghost", { image: { path: `${T}/store/a${nul}.png` } }) }), registry, { tenantId: T });
    expect(res.ok).toBe(false);
    const errors = res.issues.filter((i) => i.level === "error").map((i) => `${i.code}@${i.path}`);
    expect(errors.sort()).toEqual(["CROSS_TENANT_PATH@sections.s.settings.image", "UNSUPPORTED_TEXT@"]);
  });

  it("[AC-ENG-006] a valid surrogate pair and the other control characters are accepted", () => {
    const emoji = String.fromCodePoint(0x1f600);
    const controls = [1, 0x1f, 0x7f, 0x85, 0x2028, 0x2029].map((c) => String.fromCharCode(c)).join("");
    const res = validateDocument("index", indexDoc({ s: section("ghost", { x: `${emoji}${controls}`, [`k${emoji}${controls}`]: 1 }) }), registry);
    expect(res.ok).toBe(true);
  });
});

describe("unstorable text never disables the cycle and depth guards [AC-ENG-006]", () => {
  const nul = String.fromCharCode(0);
  /** A value that holds a NUL and points back at itself. */
  const cyclicWithNul = (): Record<string, unknown> => {
    const value: Record<string, unknown> = { n: `a${nul}` };
    value.self = value;
    return value;
  };
  const errorCodes = (res: ReturnType<typeof validateDocument>) => res.issues.filter((i) => i.level === "error").map((i) => i.code);
  // A hang cannot be interrupted by the per-test timeout (the scan is synchronous), so each case also asserts a short wall time.
  const FAST_MS = 500;
  const cases: { label: string; kind: "index" | "theme_settings"; build: () => unknown }[] = [
    { label: "an unknown component's settings", kind: "index", build: () => indexDoc({ s: section("ghost", cyclicWithNul() as Record<string, unknown>) }) },
    { label: "a setting value of a component", kind: "index", build: () => indexDoc({ s: section("ghost", { x: cyclicWithNul() }) }) },
    { label: "a registered section's setting", kind: "index", build: () => indexDoc({ s: section("hero", { heading: cyclicWithNul() }) }) },
    {
      label: "a binding fallback",
      kind: "index",
      build: () => indexDoc({ s: section("hero", { heading: { $bind: { source: "store.name", fallback: cyclicWithNul() } } }) }),
    },
    { label: "a theme root key", kind: "theme_settings", build: () => ({ schemaVersion: 1, favicon: cyclicWithNul() }) },
    { label: "a NUL in a key next to a value cycle", kind: "index", build: () => indexDoc({ s: section("ghost", { [`k${nul}`]: 1, ...{ loop: cyclicWithNul() } }) }) },
  ];
  for (const { label, kind, build } of cases) {
    it(`[AC-ENG-006] a cycle plus a NUL in ${label}: ok:false SERIALIZATION_ERROR, quickly, with and without a tenant`, () => {
      for (const context of [undefined, { tenantId: T }]) {
        const started = performance.now();
        const res = validateDocument(kind, build(), registry, context);
        expect(performance.now() - started).toBeLessThan(FAST_MS);
        expect(res.ok).toBe(false);
        expect(errorCodes(res)).toEqual(["SERIALIZATION_ERROR"]);
      }
    }, 5000);
  }

  it("[AC-ENG-006] a NUL and a too-deep value report DEPTH_EXCEEDED in either order, never only UNSUPPORTED_TEXT", () => {
    const deep = deepArray(20_000);
    const orders: Record<string, Record<string, unknown>> = {
      "NUL then deep": { a: `x${nul}`, b: deep },
      "deep then NUL": { b: deep, a: `x${nul}` },
      "NUL key then deep": { [`k${nul}`]: 1, b: deep },
    };
    for (const [label, settings] of Object.entries(orders)) {
      for (const context of [undefined, { tenantId: T }]) {
        const res = validateDocument("index", indexDoc({ s: section("ghost", settings) }), registry, context);
        expect({ label, ok: res.ok, codes: errorCodes(res) }).toEqual({ label, ok: false, codes: ["DEPTH_EXCEEDED"] });
      }
    }
  }, 5000);

  it("[AC-ENG-006] a NUL alone is still UNSUPPORTED_TEXT and the image findings are still reported next to it", () => {
    const doc = indexDoc({ s: section("ghost", { note: `a${nul}`, image: { path: "tenant-b/store/a.png" } }) });
    const withTenant = validateDocument("index", doc, registry, { tenantId: T });
    expect(errorCodes(withTenant).sort()).toEqual(["CROSS_TENANT_PATH", "UNSUPPORTED_TEXT"]);
    const without = validateDocument("index", doc, registry);
    expect(errorCodes(without).sort()).toEqual(["TENANT_REQUIRED", "UNSUPPORTED_TEXT"]);
  });
});

describe("INTERNAL_ERROR names the error type, never its message [AC-ENG-006]", () => {
  it("[AC-ENG-006] a registry whose settings list throws gives ok:false and 'internal error: TypeError'", () => {
    const secret = "document text that must not leak";
    const broken = {
      sections: {
        boom: {
          type: "boom",
          name: "Boom",
          get settings(): never {
            throw new TypeError(secret);
          },
        },
      },
      blocks: {},
    } as unknown as ComponentRegistry;
    const res = validateDocument("index", indexDoc({ s: section("boom", {}) }), broken);
    expect(res.ok).toBe(false);
    expect(res.issues).toHaveLength(1);
    expect(res.issues[0]).toEqual({
      path: "",
      code: "INTERNAL_ERROR",
      message: "The document could not be validated (internal error: TypeError)",
      level: "error",
    });
    expect(JSON.stringify(res.issues)).not.toContain(secret);
  });

  it("[AC-ENG-006] an error name that is not a plain identifier is never echoed (NUL, spaces, quotes, too long)", () => {
    const make = (error: Error) =>
      ({
        sections: {
          boom: {
            type: "boom",
            name: "Boom",
            get settings(): never {
              throw error;
            },
          },
        },
        blocks: {},
      }) as unknown as ComponentRegistry;
    const named = (name: string) => {
      const error = new Error("m");
      error.name = name;
      return validateDocument("index", indexDoc({ s: section("boom", {}) }), make(error), { tenantId: T });
    };
    const generic = "The document could not be validated (internal error)";
    for (const bad of [`Bad${String.fromCharCode(0)}Name`, "has space", 'quo"te', "1Leading", "", "A".repeat(42), "Na\nme", "<script>"]) {
      const res = named(bad);
      expect({ bad, ok: res.ok, message: res.issues[0].message }).toEqual({ bad, ok: false, message: generic });
    }
    for (const good of ["TypeError", "RangeError", "My_Error2", "A".repeat(41)]) {
      expect(named(good).issues[0].message).toBe(`The document could not be validated (internal error: ${good})`);
    }
  });

  it("[AC-ENG-006] a thrown non-Error value is reported without a name, a subclass without its own name shows 'Error'", () => {
    class WeirdError extends Error {}
    const make = (thrown: unknown) =>
      ({
        sections: {
          boom: {
            type: "boom",
            name: "Boom",
            get settings(): never {
              throw thrown;
            },
          },
        },
        blocks: {},
      }) as unknown as ComponentRegistry;
    const named = validateDocument("index", indexDoc({ s: section("boom", {}) }), make(new WeirdError("x")));
    expect(named.issues[0].message).toBe("The document could not be validated (internal error: Error)");
    const plain = validateDocument("index", indexDoc({ s: section("boom", {}) }), make("a string"));
    expect(plain.ok).toBe(false);
    expect(plain.issues[0].code).toBe("INTERNAL_ERROR");
    expect(plain.issues[0].message).toBe("The document could not be validated (internal error)");
  });
});
