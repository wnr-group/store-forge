import { describe, expect, it } from "vitest";
import { darken, readableOn, themeSettingsOf, themeToStyle } from "@/lib/templates/engine/theme-style";

describe("themeToStyle", () => {
  const theme = {
    schemaVersion: 1,
    settings: {
      colors: { primary: "#1a5aaa", background: "#faf7f2", text: "#1c1917", border: "#e7e0d6", muted: "#a8a29e", secondary: "#6b6258", accent: "#9a3412" },
      typography: { headingFont: "manrope", bodyFont: "inter", baseSize: 17, headingWeight: 700 },
      layout: { pageWidth: 1360, gridGap: 20 },
      buttons: { radius: 0 },
    },
  };

  it("maps theme tokens to the design tokens the sections use, scoped to one element", () => {
    const style = themeToStyle(theme) as Record<string, string>;
    expect(style["--primary"]).toBe("#1a5aaa");
    expect(style["--primary-foreground"]).toBe("#ffffff");
    expect(style["--background"]).toBe("#faf7f2");
    expect(style["--foreground"]).toBe("#1c1917");
    expect(style["--border"]).toBe("#e7e0d6");
    expect(style["--radius"]).toBe("0px");
    expect(style["--sf-page-width"]).toBe("1360px");
    expect(style["--sf-font-base-size"]).toBe("17px");
  });

  it("accepts the settings object on its own", () => {
    expect(themeSettingsOf(theme.settings)).toBe(theme.settings);
    expect((themeToStyle(theme.settings) as Record<string, string>)["--primary"]).toBe("#1a5aaa");
  });

  it("ignores anything that is not a valid colour, number or font, so CSS cannot be injected", () => {
    const style = themeToStyle({
      settings: {
        colors: { primary: "red; background: url(//evil)", text: "#12345" },
        typography: { headingFont: "Comic Sans; }", baseSize: 9999 },
        layout: { pageWidth: -5 },
      },
    }) as Record<string, string>;
    expect(JSON.stringify(style)).not.toMatch(/evil|Comic|url\(/);
    expect(style["--primary"]).toBeUndefined();
    expect(style["--sf-font-base-size"]).toBeUndefined();
    expect(style["--sf-page-width"]).toBeUndefined();
  });

  it("returns nothing for a missing theme", () => {
    expect(themeToStyle(null)).toEqual({});
    expect(themeToStyle(undefined)).toEqual({});
    expect(themeToStyle("x")).toEqual({});
  });
});

describe("colour helpers", () => {
  it("picks readable text and darkens for hover", () => {
    expect(readableOn("#ffffff")).toBe("#111111");
    expect(readableOn("#0f172a")).toBe("#ffffff");
    expect(darken("#ffffff", 0.5)).toBe("#808080");
  });
});
