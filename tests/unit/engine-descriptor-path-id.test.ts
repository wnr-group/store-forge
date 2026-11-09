import { describe, expect, it } from "vitest";
import { compileSettings } from "../../lib/templates/engine/compile";
import { assertValidDescriptors, checkDescriptors } from "../../lib/templates/engine/descriptor-check";
import type { SettingDescriptor } from "../../lib/templates/engine/descriptors";
import { validateDocument } from "../../lib/templates/engine/validate";
import { getRegistry } from "../../lib/templates/registry/index";
import { themeSettingDescriptors } from "../../lib/templates/registry/theme-settings";

// A setting whose id is "path" would put a string `path` key into the node's settings object, which the image
// rule reads as an image value (and then rejects), so any document using it could never validate. The id is forbidden.
describe("the setting id `path` is forbidden [AC-ENG-001] [AC-ENG-016]", () => {
  const path: SettingDescriptor = { id: "path", type: "text", label: "Path", default: "" };

  it("[AC-ENG-001] checkDescriptors, assertValidDescriptors and compileSettings all refuse it with a clear message", () => {
    const problems = checkDescriptors([path]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/"path"/);
    expect(problems[0]).toMatch(/image/i);
    expect(() => assertValidDescriptors([path], "demo")).toThrow(/demo.*path.*image/i);
    expect(() => compileSettings([path])).toThrow(/path.*image/i);
  });

  it("[AC-ENG-001] only the exact id `path` is refused: look-alikes stay valid", () => {
    for (const id of ["Path", "pathName", "image_path", "paths", "path2"]) {
      expect(checkDescriptors([{ id, type: "text", label: "X", default: "" }]), id).toEqual([]);
    }
  });

  it("[AC-ENG-001] a registered component with a `path` setting cannot be registered, and none of the real descriptors uses it", () => {
    const registry = getRegistry();
    const lists = [
      ...Object.values(registry.sections).map((d) => d.settings),
      ...Object.values(registry.blocks).map((d) => d.settings),
      themeSettingDescriptors,
    ];
    expect(lists.length).toBeGreaterThan(1);
    for (const list of lists) {
      expect(list.some((d) => d.id === "path")).toBe(false);
      expect(checkDescriptors(list)).toEqual([]);
    }
    // And the reason: a settings object holding a text `path` is image-shaped, so such a document is refused.
    const doc = { schemaVersion: 1, layout: "classic", sections: { s: { type: "ghost", settings: { path: "hello" }, blocks: {}, block_order: [] } }, order: ["s"] };
    expect(validateDocument("index", doc, registry, { tenantId: "tenant-a" }).ok).toBe(false);
  });
});
