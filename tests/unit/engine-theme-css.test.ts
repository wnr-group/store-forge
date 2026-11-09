import { describe, expect, it } from "vitest";
import { FONT_KEYS, FONT_REGISTRY } from "../../lib/templates/engine/fonts";
import { themeToCssVars, type ThemeSettings } from "../../lib/templates/engine/theme-css";

describe("Theme CSS Generator [AC-ENG-014]", () => {
  it("generates CSS variable rules from validated theme settings", () => {
    const theme: ThemeSettings = {
      colors: {
        primary: "#1a5aaa",
        secondary: "#64748b",
        background: "#ffffff",
        text: "#0f172a",
        accent: "#ff8800",
      },
      typography: {
        headingFont: "manrope",
        bodyFont: "inter",
        baseSize: 16,
        headingWeight: 700,
        bodyWeight: 400,
      },
      layout: {
        pageWidth: 1280,
        gridGap: 24,
      },
      buttons: {
        radius: 6,
      },
    };

    const css = themeToCssVars(theme);
    expect(css).toContain("--sf-color-primary: #1a5aaa;");
    expect(css).toContain("--sf-color-background: #ffffff;");
    expect(css).toContain("--sf-font-heading: var(--font-manrope), sans-serif;");
    expect(css).toContain("--sf-font-body: var(--font-inter), sans-serif;");
    expect(css).toContain("--sf-font-heading-weight: 700;");
    expect(css).toContain("--sf-font-base-size: 16px;");
    expect(css).toContain("--sf-page-width: 1280px;");
    expect(css).toContain("--sf-button-radius: 6px;");
  });

  it("sanitizes and rejects unvalidated or injected malicious strings", () => {
    const maliciousTheme = {
      colors: {
        primary: "#1a5aaa; font-size: 100px; display: none",
        background: "<script>alert(1)</script>",
      },
      typography: {
        headingFont: "malicious-font",
      },
    } as unknown as ThemeSettings;

    const css = themeToCssVars(maliciousTheme);
    // Malicious color was not a valid hex, so it must not be emitted or falls back safely
    expect(css).not.toContain("font-size: 100px");
    expect(css).not.toContain("<script>");
    // Malicious font is not in registry, so fallback is used
    expect(css).not.toContain("malicious-font");
  });
});

const SF_VAR_NAMES = new Set([
  "--sf-color-primary",
  "--sf-color-secondary",
  "--sf-color-background",
  "--sf-color-text",
  "--sf-color-accent",
  "--sf-color-muted",
  "--sf-color-border",
  "--sf-font-heading",
  "--sf-font-body",
  "--sf-font-base-size",
  "--sf-font-heading-weight",
  "--sf-font-body-weight",
  "--sf-line-height",
  "--sf-page-width",
  "--sf-grid-gap",
  "--sf-button-radius",
]);
const FONT_STACKS = new Set(Object.values(FONT_REGISTRY).map((f) => f.fontFamily));
const LINE_REGEX = /^(--sf-[a-z-]+): ([^;{}]+);$/;
const VALUE_REGEX = /^(?:#[0-9a-f]{6}|\d+(?:\.\d+)?(?:px)?)$/;

/** Every output line must be exactly `--known-name: value;` where the value is a hex, a plain number or a registry stack. */
function assertStrictCssLines(css: string) {
  if (css === "") return;
  for (const line of css.split("\n")) {
    const m = LINE_REGEX.exec(line);
    expect({ line, matched: m !== null }).toEqual({ line, matched: true });
    const [, name, value] = m!;
    expect({ line, known: SF_VAR_NAMES.has(name) }).toEqual({ line, known: true });
    expect({ line, ok: FONT_STACKS.has(value) || VALUE_REGEX.test(value) }).toEqual({ line, ok: true });
  }
}

const HOSTILE_STRINGS = [
  "#12345",
  "#1234567",
  "#ggg000",
  "red",
  "rgb(0,0,0)",
  "#aabbcc;",
  "#aabbcc; color: red",
  "#aabbcc}",
  "#aabbcc{",
  "#aabbcc/* c */",
  "/*#aabbcc*/",
  "url(https://evil.example/x)",
  "#aabbcc url(x)",
  "expression(alert(1))",
  "</style><script>alert(1)</script>",
  "#aabbcc\n--sf-color-text: #000000",
  "#aabbcc\r\n}",
  "#aabbcc\\",
  "\\#aabbcc",
  "\u0000#aabbcc",
  "inter; background:url(x)",
  "inter, evil",
  "'x'",
  "Comic Sans",
  "__proto__",
  "constructor",
  "toString",
  "16px; display:none",
  "16",
  "",
];

const HOSTILE_NUMBERS: unknown[] = [NaN, Infinity, -Infinity, -1, -0.0001, 1e21, 1e308, Number.MAX_VALUE, 1e-7, 5e-324, "16", null, {}, [], true, false, () => 16, BigInt(10)];

const ALL_COLORS = ["primary", "secondary", "background", "text", "accent", "muted", "border"] as const;

describe("Theme CSS never emits raw merchant strings [AC-ENG-014]", () => {
  it("[AC-ENG-014] the font stacks in the registry are themselves free of CSS metacharacters", () => {
    for (const stack of FONT_STACKS) {
      expect(stack).not.toMatch(/[;{}<>\\\n\r]|\/\*|url\(|expression\(/i);
    }
  });

  it("[AC-ENG-014] every hostile string in every colour and font slot is omitted", () => {
    for (const value of HOSTILE_STRINGS) {
      const colors = Object.fromEntries(ALL_COLORS.map((c) => [c, value]));
      const theme = { colors, typography: { headingFont: value, bodyFont: value } } as unknown as ThemeSettings;
      const css = themeToCssVars(theme);
      expect({ value, css }).toEqual({ value, css: "" });
    }
  });

  it("[AC-ENG-014] hostile numbers and non-numbers are omitted from every numeric slot", () => {
    for (const value of HOSTILE_NUMBERS) {
      const theme = {
        typography: { baseSize: value, headingWeight: value, bodyWeight: value, lineHeight: value },
        layout: { pageWidth: value, gridGap: value },
        buttons: { radius: value },
      } as unknown as ThemeSettings;
      const css = themeToCssVars(theme);
      expect({ value: String(value), css }).toEqual({ value: String(value), css: "" });
    }
  });

  it("[AC-ENG-014] hostile strings in numeric slots never appear", () => {
    for (const value of HOSTILE_STRINGS) {
      const theme = {
        typography: { baseSize: value, headingWeight: value, bodyWeight: value, lineHeight: value },
        layout: { pageWidth: value, gridGap: value },
        buttons: { radius: value },
        social: { facebook: value },
      } as unknown as ThemeSettings;
      expect(themeToCssVars(theme)).toBe("");
    }
  });

  it("[AC-ENG-014] a mix of valid and hostile values keeps only the valid ones, every line on the allowlist", () => {
    const theme = {
      colors: { primary: "#AABBCC", secondary: "#aabbcc; color:red", background: "url(x)", text: "#000000", accent: "</style>" },
      typography: { headingFont: "system-serif", bodyFont: "Comic Sans", baseSize: 16, headingWeight: 700, bodyWeight: NaN, lineHeight: 1.5 },
      layout: { pageWidth: 99999, gridGap: 0 },
      buttons: { radius: -3 },
    } as unknown as ThemeSettings;
    const css = themeToCssVars(theme);
    assertStrictCssLines(css);
    expect(css.split("\n").map((l) => l.split(":")[0])).toEqual([
      "--sf-color-primary",
      "--sf-color-text",
      "--sf-font-heading",
      "--sf-font-base-size",
      "--sf-font-heading-weight",
      "--sf-line-height",
      "--sf-grid-gap",
    ]);
    expect(css).toContain("--sf-color-primary: #aabbcc;");
    expect(css).toContain(`--sf-font-heading: ${FONT_REGISTRY["system-serif"].fontFamily};`);
  });

  it("[AC-ENG-014] boundary values are emitted and the output matches the strict line allowlist", () => {
    const theme: ThemeSettings = {
      colors: Object.fromEntries(ALL_COLORS.map((c) => [c, "#0A1b2C"])),
      typography: { headingFont: "system-mono", bodyFont: "manrope", baseSize: 40, headingWeight: 900, bodyWeight: 100, lineHeight: 0.8 },
      layout: { pageWidth: 1920, gridGap: 100 },
      buttons: { radius: 50 },
    };
    const css = themeToCssVars(theme);
    assertStrictCssLines(css);
    expect(css.split("\n")).toHaveLength(16);
    for (const font of FONT_KEYS) {
      const out = themeToCssVars({ typography: { headingFont: font, bodyFont: font } });
      assertStrictCssLines(out);
      expect(out.split("\n")).toHaveLength(2);
    }
  });

  it("[AC-ENG-014] non-object themes and non-object sections produce no CSS and do not throw", () => {
    for (const theme of [null, undefined, "x", 1, true, [], () => 1]) {
      expect(themeToCssVars(theme as unknown as ThemeSettings)).toBe("");
    }
    for (const section of ["x", 1, true, [], null]) {
      const css = themeToCssVars({ colors: section, typography: section, layout: section, buttons: section } as unknown as ThemeSettings);
      expect(css).toBe("");
    }
  });
});
