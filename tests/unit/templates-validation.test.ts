import { describe, expect, it } from "vitest";
import { HERO_HEADING_MAX, HERO_SUBHEADING_MAX, templateSettingsSchema } from "@/lib/validations/templates";

const parse = (over: Record<string, unknown> = {}) => templateSettingsSchema.safeParse({ templateKey: "classic", ...over });
const ok = (over: Record<string, unknown> = {}) => {
  const r = parse(over);
  if (!r.success) throw new Error(JSON.stringify(r.error.issues));
  return r.data;
};

describe("templateSettingsSchema", () => {
  it("accepts only a template key and defaults the optional fields to null", () => {
    expect(ok()).toEqual({ templateKey: "classic", accentColor: null, heroHeading: null, heroSubheading: null, heroImagePath: null });
  });

  it("normalizes valid hex colors to lowercase, trimming whitespace", () => {
    expect(ok({ accentColor: "#1A2B3C" }).accentColor).toBe("#1a2b3c");
    expect(ok({ accentColor: "#abcdef" }).accentColor).toBe("#abcdef");
    expect(ok({ accentColor: "  #AbCdEf  " }).accentColor).toBe("#abcdef");
  });

  it("rejects named colors, short hex, functions and arbitrary CSS", () => {
    for (const bad of ["red", "#fff", "#12345", "#1234567", "#12345g", "1a2b3c", "rgb(1,2,3)", "rgba(1,2,3,0.5)", "url(x)", "#1a2b3c; color: red", "var(--x)"]) {
      const r = parse({ accentColor: bad });
      expect(r.success, bad).toBe(false);
    }
  });

  it("treats blank and whitespace-only text as not configured", () => {
    expect(ok({ accentColor: "   ", heroHeading: "  ", heroSubheading: "" }).heroHeading).toBeNull();
    expect(ok({ accentColor: "   " }).accentColor).toBeNull();
    expect(ok({ heroSubheading: "" }).heroSubheading).toBeNull();
    expect(ok({ heroImagePath: "" }).heroImagePath).toBeNull();
  });

  it("trims heading and subheading", () => {
    expect(ok({ heroHeading: "  Hello  " }).heroHeading).toBe("Hello");
  });

  it("enforces the heading and subheading length boundaries", () => {
    expect(parse({ heroHeading: "a".repeat(HERO_HEADING_MAX) }).success).toBe(true);
    expect(parse({ heroHeading: "a".repeat(HERO_HEADING_MAX + 1) }).success).toBe(false);
    expect(parse({ heroSubheading: "a".repeat(HERO_SUBHEADING_MAX) }).success).toBe(true);
    expect(parse({ heroSubheading: "a".repeat(HERO_SUBHEADING_MAX + 1) }).success).toBe(false);
  });

  it("keeps HTML-like text as plain text (it is escaped at render time)", () => {
    expect(ok({ heroHeading: "<script>alert(1)</script>" }).heroHeading).toBe("<script>alert(1)</script>");
  });

  it("rejects an unknown or missing template key", () => {
    for (const bad of ["nope", "", "Classic", undefined, null, 5]) expect(parse({ templateKey: bad }).success, String(bad)).toBe(false);
    expect(templateSettingsSchema.safeParse({}).success).toBe(false);
  });

  it("reports field-level errors on the right field", () => {
    const r = parse({ accentColor: "red" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(["accentColor"]);
  });
});
