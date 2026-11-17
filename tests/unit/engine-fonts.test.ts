import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { describe, expect, expectTypeOf, it } from "vitest";
import { compileSettings } from "../../lib/templates/engine/compile";
import type { SettingDescriptor, TypographyValue } from "../../lib/templates/engine/descriptors";
import {
  FONT_KEYS,
  FONT_REGISTRY,
  FONT_TRANSFORMS,
  isFontKey,
  isFontTransform,
  isValidWeight,
  TYPOGRAPHY_BOUNDS,
  type FontKey,
} from "../../lib/templates/engine/fonts";
import { themeSettingsSchema } from "../../lib/templates/engine/root-schema";
import { themeSettingDescriptors } from "../../lib/templates/registry/theme-settings";

describe("Engine Fonts [AC-ENG-013]", () => {
  it("defines exactly 8 approved font keys", () => {
    const expected: FontKey[] = [
      "inter",
      "manrope",
      "dm-sans",
      "jost",
      "cormorant-garamond",
      "system-sans",
      "system-serif",
      "system-mono",
    ];
    expect(FONT_KEYS).toEqual(expected);
    expect(Object.keys(FONT_REGISTRY).sort()).toEqual([...expected].sort());

    for (const key of expected) {
      expect(isFontKey(key)).toBe(true);
    }
    expect(isFontKey("arial")).toBe(false);
    expect(isFontKey("comic-sans")).toBe(false);
  });

  it("weights match what WOFF2 files and system stacks provide", () => {
    // Inter: variable 100-900
    expect(FONT_REGISTRY.inter.variable).toBe(true);
    expect(FONT_REGISTRY.inter.minWeight).toBe(100);
    expect(FONT_REGISTRY.inter.maxWeight).toBe(900);

    // Manrope: variable 200-800
    expect(FONT_REGISTRY.manrope.variable).toBe(true);
    expect(FONT_REGISTRY.manrope.minWeight).toBe(200);
    expect(FONT_REGISTRY.manrope.maxWeight).toBe(800);

    // System fonts
    expect(FONT_REGISTRY["system-sans"].minWeight).toBe(100);
    expect(FONT_REGISTRY["system-sans"].maxWeight).toBe(900);
    expect(FONT_REGISTRY["system-serif"].weights).toEqual([400, 700]);
    expect(FONT_REGISTRY["system-mono"].weights).toEqual([400, 700]);
  });

  it("verifies the physical WOFF2 font files on disk have valid signatures", () => {
    const fontsDir = path.resolve(process.cwd(), "app", "fonts");
    const interFile = path.join(fontsDir, "inter-latin.woff2");
    const manropeFile = path.join(fontsDir, "manrope-latin.woff2");

    expect(fs.existsSync(interFile)).toBe(true);
    expect(fs.existsSync(manropeFile)).toBe(true);

    const interBuf = fs.readFileSync(interFile);
    const manropeBuf = fs.readFileSync(manropeFile);

    // WOFF2 magic bytes are 'wOF2' (0x77, 0x4f, 0x46, 0x32)
    expect(interBuf.subarray(0, 4).toString("ascii")).toBe("wOF2");
    expect(manropeBuf.subarray(0, 4).toString("ascii")).toBe("wOF2");
  });

  it("enforces typography bounds and transform enum", () => {
    expect(TYPOGRAPHY_BOUNDS.minSize).toBe(10);
    expect(TYPOGRAPHY_BOUNDS.maxSize).toBe(96);
    expect(TYPOGRAPHY_BOUNDS.minLineHeight).toBe(0.8);
    expect(TYPOGRAPHY_BOUNDS.maxLineHeight).toBe(2.5);
    expect(TYPOGRAPHY_BOUNDS.minLetterSpacing).toBe(-2);
    expect(TYPOGRAPHY_BOUNDS.maxLetterSpacing).toBe(10);

    expect(FONT_TRANSFORMS).toEqual(["none", "uppercase", "lowercase", "capitalize"]);
    expect(isFontTransform("uppercase")).toBe(true);
    expect(isFontTransform("italic")).toBe(false);
  });
});

// --- WOFF2 inspection: the weights a file really provides, read from its own font tables. ---

/** Tag order of the WOFF2 known-table index (W3C WOFF2 spec, section 5.1). */
const WOFF2_KNOWN_TAGS = [
  "cmap", "head", "hhea", "hmtx", "maxp", "name", "OS/2", "post", "cvt ", "fpgm", "glyf", "loca", "prep", "CFF ",
  "VORG", "EBDT", "EBLC", "gasp", "hdmx", "kern", "LTSH", "PCLT", "VDMX", "vhea", "vmtx", "BASE", "GDEF", "GPOS",
  "GSUB", "EBSC", "JSTF", "MATH", "CBDT", "CBLC", "COLR", "CPAL", "SVG ", "sbix", "acnt", "avar", "bdat", "bloc",
  "bsln", "cvar", "fdsc", "feat", "fmtx", "fvar", "gvar", "hsty", "just", "lcar", "mort", "morx", "opbd", "prop",
  "trak", "Zapf", "Silf", "Glat", "Gloc", "Feat", "Sill",
];

function readBase128(buf: Buffer, start: number): [number, number] {
  let value = 0;
  for (let i = 0; i < 5; i++) {
    const byte = buf[start + i];
    value = value * 128 + (byte & 0x7f);
    if ((byte & 0x80) === 0) return [value, start + i + 1];
  }
  throw new Error("Bad UIntBase128 in WOFF2 table directory");
}

/** Decompresses a WOFF2 file and returns its sfnt tables by tag (the directory is plain, the data is one Brotli stream). */
function woff2Tables(buf: Buffer): Map<string, Buffer> {
  const numTables = buf.readUInt16BE(12);
  const compressedSize = buf.readUInt32BE(20);
  let pos = 48;
  const entries: Array<{ tag: string; length: number }> = [];
  for (let i = 0; i < numTables; i++) {
    const flags = buf[pos++];
    const tagIndex = flags & 0x3f;
    const version = flags >> 6;
    let tag: string;
    if (tagIndex === 63) {
      tag = buf.toString("latin1", pos, pos + 4);
      pos += 4;
    } else {
      tag = WOFF2_KNOWN_TAGS[tagIndex];
    }
    let length: number;
    [length, pos] = readBase128(buf, pos);
    const transformed = tag === "glyf" || tag === "loca" ? version === 0 : version !== 0;
    if (transformed) [length, pos] = readBase128(buf, pos);
    entries.push({ tag, length });
  }
  const data = zlib.brotliDecompressSync(buf.subarray(pos, pos + compressedSize));
  const tables = new Map<string, Buffer>();
  let offset = 0;
  for (const { tag, length } of entries) {
    tables.set(tag, data.subarray(offset, offset + length));
    offset += length;
  }
  return tables;
}

/** The weights a file provides: the `wght` axis range of a variable font, or its single OS/2 weight class. */
function woff2WeightSupport(file: string): { variable: boolean; min: number; max: number } {
  const tables = woff2Tables(fs.readFileSync(path.resolve(process.cwd(), "app", "fonts", file)));
  const fvar = tables.get("fvar");
  if (fvar) {
    const axesOffset = fvar.readUInt16BE(4);
    const axisCount = fvar.readUInt16BE(8);
    const axisSize = fvar.readUInt16BE(10);
    for (let i = 0; i < axisCount; i++) {
      const at = axesOffset + i * axisSize;
      if (fvar.toString("latin1", at, at + 4) === "wght") {
        return { variable: true, min: fvar.readInt32BE(at + 4) / 65536, max: fvar.readInt32BE(at + 12) / 65536 };
      }
    }
    throw new Error(`${file} has an fvar table without a wght axis`);
  }
  const weightClass = tables.get("OS/2")!.readUInt16BE(4);
  return { variable: false, min: weightClass, max: weightClass };
}

const FREE_TEXT_FONTS: unknown[] = [
  "Comic Sans",
  "inter; background:url(x)",
  "inter, evil",
  "'x'",
  "__proto__",
  "constructor",
  "toString",
  "Inter",
  "INTER",
  " inter",
  "inter ",
  "system-sans\n",
  "inter}",
  "var(--font-inter)",
  "",
  123,
  null,
  {},
  ["inter"],
];

const WEIGHT_BOUNDARIES: Record<FontKey, { accepted: number[]; rejected: number[] }> = {
  inter: { accepted: [100, 400, 900, 450], rejected: [99, 901, 0, -100, 1000] },
  manrope: { accepted: [200, 400, 800, 450], rejected: [100, 199, 801, 900, 0, -200] },
  "dm-sans": { accepted: [100, 400, 900], rejected: [99, 1001, 0, -100] },
  jost: { accepted: [100, 400, 900], rejected: [99, 901, 0, -100] },
  "cormorant-garamond": { accepted: [300, 500, 700], rejected: [100, 299, 701, 900, 0] },
  "system-sans": { accepted: [100, 400, 900], rejected: [99, 901, 0, -400] },
  "system-serif": { accepted: [400, 700], rejected: [100, 300, 500, 600, 800, 900, 0] },
  "system-mono": { accepted: [400, 700], rejected: [100, 300, 500, 600, 800, 900, 0] },
};

function compiledTypography() {
  const d: SettingDescriptor = { id: "type", type: "typography", label: "Type", default: {} };
  const { schema } = compileSettings([d]);
  return (value: unknown) => schema.safeParse({ type: value });
}

describe("Font weights and typography values [AC-ENG-013]", () => {
  it("[AC-ENG-013] registry weight windows equal what the WOFF2 files provide (fvar wght axis)", () => {
    for (const [key, file] of [
      ["inter", "inter-latin.woff2"],
      ["manrope", "manrope-latin.woff2"],
      ["dm-sans", "dm-sans-latin.woff2"],
      ["jost", "jost-latin.woff2"],
      ["cormorant-garamond", "cormorant-garamond-latin.woff2"],
    ] as const) {
      const support = woff2WeightSupport(file);
      const font = FONT_REGISTRY[key];
      expect({ key, variable: support.variable }).toEqual({ key, variable: font.variable });
      expect({ key, min: support.min, max: support.max }).toEqual({ key, min: font.minWeight, max: font.maxWeight });
    }
  });

  it("[AC-ENG-013] only the five embedded files are registered as bundled fonts", () => {
    expect(
      Object.values(FONT_REGISTRY)
        .filter((f) => f.woff2Path)
        .map((f) => f.woff2Path),
    ).toEqual([
      "app/fonts/inter-latin.woff2",
      "app/fonts/manrope-latin.woff2",
      "app/fonts/dm-sans-latin.woff2",
      "app/fonts/jost-latin.woff2",
      "app/fonts/cormorant-garamond-latin.woff2",
    ]);
    for (const font of Object.values(FONT_REGISTRY)) {
      if (font.woff2Path) expect(fs.existsSync(path.resolve(process.cwd(), font.woff2Path))).toBe(true);
      else expect(font.fontFamily).not.toContain("var(--font-");
    }
  });

  for (const key of FONT_KEYS) {
    it(`[AC-ENG-013] isValidWeight(${key}) accepts its boundaries and rejects everything outside`, () => {
      const { accepted, rejected } = WEIGHT_BOUNDARIES[key];
      for (const weight of accepted) expect({ key, weight, ok: isValidWeight(key, weight) }).toEqual({ key, weight, ok: true });
      for (const weight of rejected) expect({ key, weight, ok: isValidWeight(key, weight) }).toEqual({ key, weight, ok: false });
    });

    it(`[AC-ENG-013] isValidWeight(${key}) rejects non-integer and non-number weights`, () => {
      const font = FONT_REGISTRY[key];
      const inside = font.weights?.[0] ?? font.minWeight!;
      for (const weight of [inside + 0.5, inside + 0.0001, NaN, Infinity, -Infinity, "400", null, undefined, {}]) {
        expect({ key, weight, ok: isValidWeight(key, weight as number) }).toEqual({ key, weight, ok: false });
      }
    });

    it(`[AC-ENG-013] the compiled typography control enforces ${key}'s weights`, () => {
      const parse = compiledTypography();
      const { accepted, rejected } = WEIGHT_BOUNDARIES[key];
      expect(parse({ fontFamily: key }).success).toBe(true);
      for (const fontWeight of accepted) expect({ key, fontWeight, ok: parse({ fontFamily: key, fontWeight }).success }).toEqual({ key, fontWeight, ok: true });
      for (const fontWeight of rejected) expect({ key, fontWeight, ok: parse({ fontFamily: key, fontWeight }).success }).toEqual({ key, fontWeight, ok: false });
      expect(parse({ fontFamily: key, fontWeight: 400.5 }).success).toBe(false);
    });
  }

  it("[AC-ENG-013] isValidWeight and isFontKey reject prototype-named fonts", () => {
    for (const key of ["__proto__", "constructor", "toString", "hasOwnProperty"]) {
      expect(isFontKey(key)).toBe(false);
      expect(isValidWeight(key as FontKey, 400)).toBe(false);
    }
  });

  it("[AC-ENG-013] a typography weight with no family must still be an integer in 100-900", () => {
    const parse = compiledTypography();
    for (const fontWeight of [100, 400, 900]) expect(parse({ fontWeight }).success).toBe(true);
    for (const fontWeight of [99, 901, 400.5, NaN, Infinity, "400"]) expect(parse({ fontWeight }).success).toBe(false);
  });

  it("[AC-ENG-013] TypographyValue.fontFamily is typed as the closed FontKey union, not string", () => {
    expectTypeOf<TypographyValue["fontFamily"]>().toEqualTypeOf<FontKey | undefined>();
    // @ts-expect-error free text is not a FontKey
    const bad: TypographyValue = { fontFamily: "Comic Sans" };
    expect(bad).toBeDefined();
  });

  it("[AC-ENG-013] the compiled typography control accepts only the closed font keys", () => {
    const parse = compiledTypography();
    for (const key of FONT_KEYS) expect(parse({ fontFamily: key }).success).toBe(true);
    for (const value of FREE_TEXT_FONTS) {
      expect({ value, ok: parse({ fontFamily: value }).success }).toEqual({ value, ok: false });
    }
  });

  it("[AC-ENG-013] theme headingFont and bodyFont accept only the closed font keys", () => {
    const parse = (typography: unknown) => themeSettingsSchema.safeParse({ schemaVersion: 1, settings: { typography } });
    for (const key of FONT_KEYS) {
      expect(parse({ headingFont: key, bodyFont: key }).success).toBe(true);
    }
    for (const value of FREE_TEXT_FONTS) {
      expect({ field: "headingFont", value, ok: parse({ headingFont: value }).success }).toEqual({ field: "headingFont", value, ok: false });
      expect({ field: "bodyFont", value, ok: parse({ bodyFont: value }).success }).toEqual({ field: "bodyFont", value, ok: false });
    }
  });

  it("[AC-ENG-013] theme heading and body weights are integers and match the chosen font", () => {
    const parse = (typography: unknown) => themeSettingsSchema.safeParse({ schemaVersion: 1, settings: { typography } });
    expect(parse({ headingFont: "inter", headingWeight: 900, bodyFont: "manrope", bodyWeight: 200 }).success).toBe(true);
    expect(parse({ headingFont: "manrope", headingWeight: 900 }).success).toBe(false);
    expect(parse({ bodyFont: "manrope", bodyWeight: 100 }).success).toBe(false);
    expect(parse({ headingFont: "system-serif", headingWeight: 500 }).success).toBe(false);
    expect(parse({ headingFont: "system-serif", headingWeight: 700 }).success).toBe(true);
    for (const weight of [450.5, 99, 901, NaN]) {
      expect(parse({ headingWeight: weight }).success).toBe(false);
      expect(parse({ bodyWeight: weight }).success).toBe(false);
    }
    const issue = parse({ headingFont: "manrope", headingWeight: 900 });
    expect(!issue.success && issue.error.issues[0].path).toEqual(["settings", "typography", "headingWeight"]);
  });

  it("[AC-ENG-013] theme weights are checked against the effective font: the registry default when none is chosen", () => {
    const parse = (typography: unknown) => themeSettingsSchema.safeParse({ schemaVersion: 1, settings: { typography } });
    const defaultOf = (id: string) => themeSettingDescriptors.find((d) => d.id === id)?.default;
    // The defaults come from the descriptors (single source) and must themselves be closed font keys.
    const headingDefault = defaultOf("headingFont") as FontKey;
    const bodyDefault = defaultOf("bodyFont") as FontKey;
    expect(FONT_KEYS).toContain(headingDefault);
    expect(FONT_KEYS).toContain(bodyDefault);

    // Heading default is manrope (200..800): 900 and 100 are out of range, 200 and 800 are in.
    for (const [headingWeight, ok] of [[900, false], [100, false], [199, false], [200, true], [450, true], [800, true]] as const) {
      expect({ headingWeight, implicit: parse({ headingWeight }).success }).toEqual({ headingWeight, implicit: ok });
      expect({ headingWeight, explicit: parse({ headingFont: headingDefault, headingWeight }).success }).toEqual({
        headingWeight,
        explicit: ok,
      });
    }
    // Body default is inter (100..900): the whole range is allowed.
    for (const bodyWeight of [100, 450, 900]) expect(parse({ bodyWeight }).success).toBe(true);
    for (const bodyWeight of [99, 901]) expect(parse({ bodyWeight }).success).toBe(false);

    // An explicit font replaces the default: inter allows heading 900, manrope as body rejects 100 and 900.
    expect(parse({ headingFont: "inter", headingWeight: 900 }).success).toBe(true);
    expect(parse({ bodyFont: "manrope", bodyWeight: 100 }).success).toBe(false);
    expect(parse({ bodyFont: "manrope", bodyWeight: 900 }).success).toBe(false);
    expect(parse({ bodyFont: "system-serif", bodyWeight: 400 }).success).toBe(true);
    expect(parse({ bodyFont: "system-serif", bodyWeight: 500 }).success).toBe(false);

    const implicit = parse({ headingWeight: 900 });
    expect(!implicit.success && implicit.error.issues[0].path).toEqual(["settings", "typography", "headingWeight"]);
  });

  it("[AC-ENG-013] size, line height and letter spacing use the TYPOGRAPHY_BOUNDS, inclusive", () => {
    const parse = compiledTypography();
    const B = TYPOGRAPHY_BOUNDS;
    const bounded: Array<[string, number, number]> = [
      ["fontSize", B.minSize, B.maxSize],
      ["lineHeight", B.minLineHeight, B.maxLineHeight],
      ["letterSpacing", B.minLetterSpacing, B.maxLetterSpacing],
    ];
    for (const [field, min, max] of bounded) {
      for (const ok of [min, max, (min + max) / 2]) expect({ field, ok, r: parse({ [field]: ok }).success }).toEqual({ field, ok, r: true });
      for (const bad of [min - 0.01, max + 0.01, NaN, Infinity, -Infinity, "12", null]) {
        expect({ field, bad, r: parse({ [field]: bad }).success }).toEqual({ field, bad, r: false });
      }
    }
  });

  it("[AC-ENG-013] textTransform is the closed FONT_TRANSFORMS enum", () => {
    const parse = compiledTypography();
    for (const textTransform of FONT_TRANSFORMS) expect(parse({ textTransform }).success).toBe(true);
    for (const textTransform of ["italic", "Uppercase", "none; x", "", 1, null, "__proto__"]) {
      expect({ textTransform, ok: parse({ textTransform }).success }).toEqual({ textTransform, ok: false });
    }
  });
});
