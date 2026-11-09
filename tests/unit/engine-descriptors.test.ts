import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isSettingType,
  SETTING_TYPES,
  type BlockDefinition,
  type SectionDefinition,
  type SettingDescriptor,
  type SettingType,
} from "../../lib/templates/engine/descriptors";

describe("Engine Descriptors [AC-ENG-001] [AC-ENG-002] [AC-ENG-004]", () => {
  it("[AC-ENG-002] enforces the closed setting types enum and rejects unsupported pickers", () => {
    const expectedTypes: SettingType[] = [
      "text",
      "textarea",
      "richtext",
      "number",
      "range",
      "toggle",
      "select",
      "radio",
      "segmented",
      "color",
      "image",
      "url",
      "spacing",
      "typography",
      "border",
      "dataBinding",
    ];

    expect(SETTING_TYPES).toEqual(expectedTypes);
    for (const t of expectedTypes) {
      expect(isSettingType(t)).toBe(true);
    }

    // Explicitly forbidden in D5
    expect(isSettingType("video")).toBe(false);
    expect(isSettingType("file")).toBe(false);
    expect(isSettingType("icon")).toBe(false);
    expect(isSettingType("custom_code")).toBe(false);
    expect(isSettingType(null)).toBe(false);
    expect(isSettingType(123)).toBe(false);
  });

  it("[AC-ENG-001] [AC-ENG-004] descriptors provide complete control metadata", () => {
    const descriptor: SettingDescriptor = {
      id: "hero_heading",
      type: "text",
      label: "Heading",
      default: "Welcome to our store",
      help: "Displayed prominently at the top",
      group: "content",
      responsive: true,
      visibleIf: { setting: "show_hero", eq: true },
    };

    expect(descriptor.id).toBe("hero_heading");
    expect(descriptor.type).toBe("text");
    expect(descriptor.group).toBe("content");
    expect(descriptor.visibleIf).toEqual({ setting: "show_hero", eq: true });
    expect(descriptor.responsive).toBe(true);
  });

  it("[AC-ENG-001] section and block definitions declare tree acceptance and limits", () => {
    const blockDef: BlockDefinition = {
      type: "button",
      name: "Button",
      settings: [
        { id: "text", type: "text", label: "Button Label", default: "Shop Now" },
        { id: "link", type: "url", label: "Button Link", default: "/products" },
      ],
    };

    const sectionDef: SectionDefinition = {
      type: "hero",
      name: "Hero Banner",
      category: "Banners",
      accepts: ["button", "text"],
      maxChildren: 5,
      settings: [
        { id: "heading", type: "text", label: "Hero Heading", default: "" },
        { id: "subheading", type: "textarea", label: "Hero Subheading", default: "" },
      ],
      defaultBlocks: [{ type: "button", settings: { text: "Shop Now" } }],
    };

    expect(sectionDef.type).toBe("hero");
    expect(sectionDef.accepts).toContain("button");
    expect(sectionDef.maxChildren).toBe(5);
    expect(blockDef.type).toBe("button");
  });

  // Task 13: `maxChildrenByType` was declared but enforced nowhere and is not in the approved plan (only `accepts` and
  // `maxChildren` are). An API that looks enforced but is not is a defect, so the field is gone from the engine.
  it("[AC-ENG-001] no engine or registry source declares or mentions the unapproved `maxChildrenByType` field", () => {
    const roots = ["../../lib/templates/engine", "../../lib/templates/registry"].map((r) => join(__dirname, r));
    const files = roots.flatMap((root) =>
      (readdirSync(root, { recursive: true }) as string[]).filter((f) => f.endsWith(".ts") || f.endsWith(".tsx")).map((f) => join(root, f)),
    );
    expect(files.length).toBeGreaterThan(10);
    expect(files.filter((f) => readFileSync(f, "utf8").includes("maxChildrenByType"))).toEqual([]);
  });
});
