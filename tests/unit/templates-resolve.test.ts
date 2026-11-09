import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveTemplateKey, resolveTemplateSettings, savedFromPublic } from "@/lib/templates/resolve";

const store = { name: "Urban Nest", description: "Home goods" };
const saved = { accentColor: null, heroHeading: null, heroSubheading: null, heroImagePath: null };

beforeEach(() => vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"));
afterEach(() => vi.unstubAllEnvs());

describe("resolveTemplateKey", () => {
  it("returns known keys and falls back to the default for unknown, null and undefined", () => {
    expect(resolveTemplateKey("spotlight")).toBe("spotlight");
    for (const bad of ["nope", "", null, undefined, "SPOTLIGHT"]) expect(resolveTemplateKey(bad)).toBe("classic");
  });
});

describe("resolveTemplateSettings", () => {
  it("falls back to existing store data when nothing is saved", () => {
    expect(resolveTemplateSettings(store, null)).toEqual({ accentColor: null, heading: "Urban Nest", subheading: "Home goods", heroImageUrl: null });
  });

  it("falls back when saved fields are null", () => {
    expect(resolveTemplateSettings(store, saved)).toEqual({ accentColor: null, heading: "Urban Nest", subheading: "Home goods", heroImageUrl: null });
  });

  it("uses saved values and builds the hero URL from the storage path", () => {
    const r = resolveTemplateSettings(store, { accentColor: "#1a2b3c", heroHeading: "Big sale", heroSubheading: "Everything must go", heroImagePath: "t1/store/a.webp" });
    expect(r).toEqual({
      accentColor: "#1a2b3c",
      heading: "Big sale",
      subheading: "Everything must go",
      heroImageUrl: "https://example.supabase.co/storage/v1/object/public/products/t1/store/a.webp",
    });
  });

  it("treats blank unsaved preview text as not set", () => {
    const r = resolveTemplateSettings(store, { ...saved, heroHeading: "   ", heroSubheading: "" });
    expect(r.heading).toBe("Urban Nest");
    expect(r.subheading).toBe("Home goods");
  });

  it("never lets an invalid accent color through (CSS injection guard)", () => {
    for (const bad of ["red", "#12", "#1a2b3c; background:url(x)", "url(javascript:1)", ""]) {
      expect(resolveTemplateSettings(store, { ...saved, accentColor: bad }).accentColor, bad).toBeNull();
    }
    expect(resolveTemplateSettings(store, { ...saved, accentColor: "#ABCDEF" }).accentColor).toBe("#abcdef");
  });

  it("keeps a null store description as a null subheading", () => {
    expect(resolveTemplateSettings({ name: "X", description: null }, null).subheading).toBeNull();
  });
});

describe("savedFromPublic", () => {
  it("maps the public function's snake_case object and handles missing settings", () => {
    expect(savedFromPublic(null)).toBeNull();
    expect(savedFromPublic(undefined)).toBeNull();
    expect(savedFromPublic({ key: "spotlight", accent_color: "#aaaaaa", hero_heading: "H", hero_subheading: null, hero_image_path: null })).toEqual({
      templateKey: "spotlight", accentColor: "#aaaaaa", heroHeading: "H", heroSubheading: null, heroImagePath: null,
    });
  });
});
