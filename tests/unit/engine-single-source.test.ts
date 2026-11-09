import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { safeUrl } from "../../lib/templates/engine/bindings";
import { compileSettings } from "../../lib/templates/engine/compile";
import type { SettingDescriptor, SettingType } from "../../lib/templates/engine/descriptors";
import { hexColorSchema, imageValueSchema } from "../../lib/templates/engine/schema";

const ENGINE_DIR = join(__dirname, "../../lib/templates/engine");
const sources = readdirSync(ENGINE_DIR)
  .filter((f) => f.endsWith(".ts"))
  .map((f) => ({ file: f, text: readFileSync(join(ENGINE_DIR, f), "utf8") }));

function filesMatching(pattern: RegExp): string[] {
  return sources.filter((s) => pattern.test(s.text)).map((s) => s.file);
}

/** Compiles a one-descriptor schema and returns a parse function for the `value` key. */
function compiledField(type: SettingType) {
  const d: SettingDescriptor = { id: "value", type, label: "Value", default: null };
  const { schema } = compileSettings([d]);
  return (value: unknown) => schema.safeParse({ value });
}

describe("Engine validators have one source of truth [AC-ENG-001] [AC-ENG-016] [AC-ENG-017]", () => {
  it("[AC-ENG-017] defines the hex colour rule in exactly one engine module", () => {
    expect(filesMatching(/\[0-9a-fA-F\]\{6\}/)).toEqual(["schema.ts"]);
    expect(filesMatching(/export const hexColorSchema\b/)).toEqual(["schema.ts"]);
  });

  it("[AC-ENG-001] [AC-ENG-016] [AC-ENG-017] defines the URL protocol allowlist in exactly one engine module", () => {
    expect(filesMatching(/["']mailto:["']/)).toEqual(["schema.ts"]);
    expect(filesMatching(/export const safeUrlSchema\b/)).toEqual(["schema.ts"]);
    expect(filesMatching(/export function safeUrl\b/)).toEqual(["schema.ts"]);
  });

  it("[AC-ENG-001] [AC-ENG-016] [AC-ENG-017] defines the image value shape in exactly one engine module", () => {
    expect(filesMatching(/\bfocal\s*:\s*z\b/)).toEqual(["schema.ts"]);
    expect(filesMatching(/export function imageValueSchema\b/)).toEqual(["schema.ts"]);
    expect(filesMatching(/export const imageSchema\b/)).toEqual([]);
  });

  it("[AC-ENG-001] schema.ts does not import compile.ts (no cycle)", () => {
    const schemaText = sources.find((s) => s.file === "schema.ts")!.text;
    expect(schemaText).not.toMatch(/from\s+["']\.\/compile["']/);
  });

  it("[AC-ENG-016] [AC-ENG-017] safeUrl and the compiled url descriptor accept and reject the same strings", () => {
    const parseUrl = compiledField("url");
    const cases: string[] = [
      "https://example.com/products",
      "http://store.local",
      "mailto:support@example.com",
      "/products/shoes",
      "#section-1",
      "//evil.example.com/x",
      "  /padded  ",
      "javascript:alert(1)",
      "JaVaScRiPt:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
      "file:///etc/passwd",
      "java\nscript:alert(1)",
      "ftp://example.com",
      "example.com/no-scheme",
      "http://exa\tmple.com",
      "\u0001/products",
      "/ok\u0000",
    ];
    for (const value of cases) {
      const viaHelper = safeUrl(value) !== null;
      const viaSchema = parseUrl(value).success;
      expect({ value, accepted: viaSchema }).toEqual({ value, accepted: viaHelper });
    }
    // Empty is the only intentional difference: the descriptor schema allows "no link", the helper yields null.
    expect(parseUrl("").success).toBe(true);
    expect(parseUrl("   ").success).toBe(true);
    expect(safeUrl("")).toBeNull();
    expect(safeUrl("   ")).toBeNull();
  });

  it("[AC-ENG-017] hexColorSchema and the compiled color descriptor agree", () => {
    const parseColor = compiledField("color");
    const cases = ["#ffffff", "#FFAA00", "#12", "#12345", "#1234567", "red", "", "ffffff", "#gggggg", "#1a2b3c; background:url(x)"];
    for (const value of cases) {
      expect({ value, accepted: parseColor(value).success }).toEqual({
        value,
        accepted: hexColorSchema.safeParse(value).success,
      });
    }
    expect(hexColorSchema.safeParse("#a1B2c3").success).toBe(true);
    expect(hexColorSchema.safeParse("#fff").success).toBe(false);
  });

  it("[AC-ENG-017] the compiled colour descriptor reuses hexColorSchema, also when it carries a custom message", () => {
    const compileText = sources.find((s) => s.file === "compile.ts")!.text;
    // compile.ts never rebuilds the colour rule from the regex; it delegates to hexColorSchema.
    expect(compileText).not.toMatch(/\bHEX_COLOR_REGEX\b/);
    expect(compileText).toMatch(/\bhexColorSchema\b/);

    const message = "Pick a six-digit colour";
    const withMessage: SettingDescriptor = { id: "value", type: "color", label: "Value", default: null, messages: { invalid: message } };
    const { schema } = compileSettings([withMessage]);
    for (const value of ["#ffffff", "#FFAA00", "#12", "#1234567", "red", "", "#gggggg", "#1a2b3c; background:url(x)", 5, null]) {
      const result = schema.safeParse({ value });
      expect({ value, accepted: result.success }).toEqual({ value, accepted: hexColorSchema.safeParse(value).success });
      if (!result.success) expect(result.error.issues.map((i) => i.message)).toEqual([message]);
    }
  });

  it("[AC-ENG-016] imageValueSchema and the compiled image descriptor agree, including issues", () => {
    const parseImage = compiledField("image");
    const base = imageValueSchema();
    const cases: unknown[] = [
      { path: "t1/store/a.png" },
      { path: "t1/store/a.png", alt: "Hero", focal: { x: 0, y: 100 } },
      { path: "" },
      { path: "../secrets.png" },
      { path: "t1/store/../../x.png" },
      { path: "t1/store/a.png", alt: "x".repeat(201) },
      { path: "t1/store/a.png", focal: { x: -1, y: 50 } },
      { path: "t1/store/a.png", focal: { x: 50, y: 101 } },
      { alt: "no path" },
      "t1/store/a.png",
      42,
    ];
    for (const value of cases) {
      const viaHelper = base.nullable().safeParse(value);
      const viaSchema = parseImage(value);
      expect({ value, accepted: viaSchema.success }).toEqual({ value, accepted: viaHelper.success });
      if (!viaHelper.success && !viaSchema.success) {
        const nested = viaSchema.error.issues.map((i) => ({ ...i, path: i.path.slice(1) }));
        expect(nested).toEqual(viaHelper.error.issues);
      }
    }
    expect(parseImage(null).success).toBe(true);
  });
});
