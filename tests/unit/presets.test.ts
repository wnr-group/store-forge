import { describe, expect, it } from "vitest";
import { getRegistry } from "@/lib/templates/registry/index";
import { validateDocument } from "@/lib/templates/engine/validate";
import {
  classicPreset,
  spotlightPreset,
  productPreset,
  collectionPreset,
  groupHeaderPreset,
  groupFooterPreset,
  groupAnnouncementPreset,
  themePreset,
  getPresetDocument,
} from "@/lib/templates/presets";

describe("Built-In Preset Catalogue [AC-REN-011] [AC-ENG-018]", () => {
  const registry = getRegistry();

  it("classic index preset validates cleanly with 0 errors", () => {
    const res = validateDocument("index", classicPreset, registry);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.issues.filter((i) => i.level === "error")).toEqual([]);
    }
  });

  it("spotlight index preset validates cleanly with 0 errors", () => {
    const res = validateDocument("index", spotlightPreset, registry);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.issues.filter((i) => i.level === "error")).toEqual([]);
    }
  });

  it("product preset validates cleanly with 0 errors", () => {
    const res = validateDocument("product", productPreset, registry);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.issues.filter((i) => i.level === "error")).toEqual([]);
    }
  });

  it("collection preset validates cleanly with 0 errors", () => {
    const res = validateDocument("collection", collectionPreset, registry);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.issues.filter((i) => i.level === "error")).toEqual([]);
    }
  });

  it("group_header preset validates cleanly with 0 errors", () => {
    const res = validateDocument("group_header", groupHeaderPreset, registry);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.issues.filter((i) => i.level === "error")).toEqual([]);
    }
  });

  it("group_footer preset validates cleanly with 0 errors", () => {
    const res = validateDocument("group_footer", groupFooterPreset, registry);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.issues.filter((i) => i.level === "error")).toEqual([]);
    }
  });

  it("group_announcement preset validates cleanly with 0 errors", () => {
    const res = validateDocument("group_announcement", groupAnnouncementPreset, registry);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.issues.filter((i) => i.level === "error")).toEqual([]);
    }
  });

  it("theme_settings preset validates cleanly with 0 errors", () => {
    const res = validateDocument("theme_settings", themePreset, registry);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.issues.filter((i) => i.level === "error")).toEqual([]);
    }
  });

  it("getPresetDocument returns the expected preset per kind", () => {
    expect(getPresetDocument("index", "classic")).toEqual(classicPreset);
    expect(getPresetDocument("index", "spotlight")).toEqual(spotlightPreset);
    expect(getPresetDocument("product")).toEqual(productPreset);
    expect(getPresetDocument("collection")).toEqual(collectionPreset);
    expect(getPresetDocument("group_header")).toEqual(groupHeaderPreset);
    expect(getPresetDocument("group_footer")).toEqual(groupFooterPreset);
    expect(getPresetDocument("group_announcement")).toEqual(groupAnnouncementPreset);
    expect(getPresetDocument("theme_settings")).toEqual(themePreset);
  });
});
