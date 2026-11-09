import { describe, expect, it } from "vitest";
import { compileSettingSchema, compileSettings } from "../../lib/templates/engine/compile";
import type { BlockDefinition, ComponentRegistry, SectionDefinition, SettingDescriptor } from "../../lib/templates/engine/descriptors";
import { validateDocument } from "../../lib/templates/engine/validate";
import { getRegistry } from "../../lib/templates/registry/index";
import { themeSettingDescriptors } from "../../lib/templates/registry/theme-settings";

// Task 13, gap C: compileSettings (the compile entry used for every definition at validation time) runs the FULL
// descriptor check, structure plus the visibleIf graph, and throws one aggregated message naming the offending
// settings [AC-ENG-004]. A failed compile never leaves a cached schema behind.
const toggle = (id: string, extra: Partial<SettingDescriptor> = {}): SettingDescriptor => ({ id, type: "toggle", label: id, default: false, ...extra });
const text = (id: string, extra: Partial<SettingDescriptor> = {}): SettingDescriptor => ({ id, type: "text", label: id, default: "", ...extra });
const when = (setting: string, eq: unknown = true) => ({ visibleIf: { setting, eq } });

describe("compileSettings checks the visibleIf graph [AC-ENG-004]", () => {
  it("[AC-ENG-004] a dangling visibleIf target throws and names both settings", () => {
    expect(() => compileSettings([text("a", when("ghost"))])).toThrow(/"a".*unknown setting "ghost"/);
  });

  it("[AC-ENG-004] a visibleIf that refers to its own setting throws and names it", () => {
    expect(() => compileSettings([toggle("a", when("a"))])).toThrow(/"a".*refers to itself/);
  });

  it("[AC-ENG-004] a two-node cycle throws", () => {
    expect(() => compileSettings([toggle("a", when("b")), toggle("b", when("a"))])).toThrow(/cycle/);
  });

  it("[AC-ENG-004] a three-node cycle throws and names a member", () => {
    expect(() => compileSettings([toggle("a", when("b")), toggle("b", when("c")), toggle("c", when("a"))])).toThrow(/cycle through "[abc]"/);
  });

  it("[AC-ENG-004] a valid chain compiles, with the conditions kept in the metadata", () => {
    const compiled = compileSettings([toggle("a"), toggle("b", when("a")), text("c", when("b"))]);
    expect(Object.keys(compiled.metadata)).toEqual(["a", "b", "c"]);
    expect(compiled.metadata.c.visibleIf).toEqual({ setting: "b", eq: true });
  });

  it("[AC-ENG-004] a visibleIf that points at a setting which is itself hidden is allowed", () => {
    expect(() => compileSettings([toggle("a"), toggle("b", when("a")), text("c", when("b"))])).not.toThrow();
  });

  it("[AC-ENG-004] one message lists every problem, and the structural throw keeps its wording", () => {
    let message = "";
    try {
      compileSettings([text("a", when("ghost1")), text("b", when("b")), toggle("c", when("d")), toggle("d", when("c"))]);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/^Invalid settings: /);
    for (const needle of ['"ghost1"', 'setting "b"', 'cycle through']) expect(message).toContain(needle);
    expect(() => compileSettings([text("a"), text("a")])).toThrow(/Invalid settings: duplicate setting id "a"/);
  });

  it("[AC-ENG-004] the single-descriptor entry stays structural: a lone descriptor has no list to point into", () => {
    expect(() => compileSettingSchema(text("a", when("elsewhere")))).not.toThrow();
  });

  it("[AC-ENG-004] the shipped registries and the theme settings still compile", () => {
    const registry = getRegistry();
    for (const def of [...Object.values(registry.sections), ...Object.values(registry.blocks)]) {
      expect(() => compileSettings(def.settings), def.type).not.toThrow();
    }
    expect(() => compileSettings(themeSettingDescriptors)).not.toThrow();
  });
});

describe("a malformed registry definition never breaks validateDocument [AC-ENG-004] [AC-ENG-006]", () => {
  const badSection: SectionDefinition = { type: "bad", name: "Bad", settings: [text("a", when("ghost"))] };
  const goodSection: SectionDefinition = { type: "good", name: "Good", settings: [toggle("a"), text("b", when("a"))] };
  const registry: ComponentRegistry = { sections: { bad: badSection, good: goodSection }, blocks: {} as Record<string, BlockDefinition> };
  const doc = (type: string) => ({
    schemaVersion: 1,
    layout: "classic",
    sections: { s: { type, settings: {}, blocks: {}, block_order: [] } },
    order: ["s"],
  });

  it("[AC-ENG-006] returns the INTERNAL_ERROR issue (ok:false) instead of throwing, every time, and leaks no setting text", () => {
    for (let round = 0; round < 3; round++) {
      for (const context of [undefined, { tenantId: "tenant-a" }]) {
        const res = validateDocument("index", doc("bad"), registry, context);
        expect(res.ok).toBe(false);
        expect(res.issues).toEqual([
          { path: "", code: "INTERNAL_ERROR", message: "The document could not be validated (internal error: Error)", level: "error" },
        ]);
      }
    }
  });

  it("[AC-ENG-006] a failed compile leaves no cached schema: the failure repeats, and a good definition still validates", () => {
    expect(validateDocument("index", doc("bad"), registry).ok).toBe(false);
    // The same definition object, fixed in place, must compile fresh (nothing stale was cached for it).
    badSection.settings = [toggle("a"), text("b", when("a"))];
    expect(validateDocument("index", doc("bad"), registry).ok).toBe(true);
    expect(validateDocument("index", doc("good"), registry).ok).toBe(true);
  });
});
