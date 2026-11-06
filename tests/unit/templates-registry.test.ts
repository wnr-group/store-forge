import { describe, expect, it } from "vitest";
import { DEFAULT_TEMPLATE_KEY, isTemplateKey, TEMPLATE_KEYS, TEMPLATES, templateMeta } from "@/lib/templates/registry";

describe("template registry", () => {
  it("ships at least two templates with unique keys", () => {
    expect(TEMPLATE_KEYS.length).toBeGreaterThanOrEqual(2);
    expect(new Set(TEMPLATE_KEYS).size).toBe(TEMPLATE_KEYS.length);
  });

  it("keeps metadata and keys in sync, with non-empty names and descriptions", () => {
    expect(TEMPLATES.map((t) => t.key)).toEqual([...TEMPLATE_KEYS]);
    for (const t of TEMPLATES) {
      expect(t.name.trim().length).toBeGreaterThan(0);
      expect(t.description.trim().length).toBeGreaterThan(0);
    }
  });

  it("uses an existing key as the default", () => {
    expect(isTemplateKey(DEFAULT_TEMPLATE_KEY)).toBe(true);
    expect(DEFAULT_TEMPLATE_KEY).toBe("classic");
  });

  it("isTemplateKey accepts known keys only", () => {
    expect(isTemplateKey("classic")).toBe(true);
    expect(isTemplateKey("spotlight")).toBe(true);
    for (const bad of ["", "Classic", "nope", null, undefined, 1, {}, "classic "]) expect(isTemplateKey(bad)).toBe(false);
  });

  it("templateMeta returns the entry for a key", () => {
    expect(templateMeta("spotlight").key).toBe("spotlight");
  });
});
