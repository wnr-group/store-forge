import { describe, expect, it } from "vitest";
import { compileSettings } from "../../lib/templates/engine/compile";
import type { SettingDescriptor } from "../../lib/templates/engine/descriptors";

describe("Engine Compiler [AC-ENG-003] [AC-ENG-004]", () => {
  it("[AC-ENG-003] compiles setting descriptors to Zod schema and defaults", () => {
    const descriptors: SettingDescriptor[] = [
      { id: "heading", type: "text", label: "Heading", default: "Hello" },
      { id: "count", type: "number", label: "Item Count", default: 3, min: 1, max: 10 },
      { id: "enabled", type: "toggle", label: "Show Banner", default: true },
      {
        id: "variant",
        type: "select",
        label: "Layout Variant",
        default: "grid",
        options: [
          { label: "Grid", value: "grid" },
          { label: "List", value: "list" },
        ],
      },
      { id: "color", type: "color", label: "Background", default: "#ffffff" },
    ];

    const { schema, defaults, metadata } = compileSettings(descriptors);

    expect(defaults).toEqual({
      heading: "Hello",
      count: 3,
      enabled: true,
      variant: "grid",
      color: "#ffffff",
    });

    expect(metadata.heading.label).toBe("Heading");
    expect(metadata.count.min).toBe(1);

    const valid = schema.safeParse({
      heading: "Custom Title",
      count: 5,
      enabled: false,
      variant: "list",
      color: "#ff0000",
    });
    expect(valid.success).toBe(true);

    const invalid = schema.safeParse({
      count: 99, // exceeds max 10
      color: "not-a-color",
    });
    expect(invalid.success).toBe(false);
  });

  it("[AC-ENG-003] supports responsive values only when responsive is true", () => {
    const descriptors: SettingDescriptor[] = [
      { id: "fontSize", type: "number", label: "Font Size", default: 16, responsive: true },
      { id: "fixedTitle", type: "text", label: "Title", default: "Title", responsive: false },
    ];

    const { schema } = compileSettings(descriptors);

    // Responsive field accepts { base, tablet?, mobile? }
    const resValid = schema.safeParse({
      fontSize: { base: 16, tablet: 14, mobile: 12 },
      fixedTitle: "Valid Title",
    });
    expect(resValid.success).toBe(true);

    // Responsive field also accepts plain scalar
    const scalarValid = schema.safeParse({
      fontSize: 18,
      fixedTitle: "Valid Title",
    });
    expect(scalarValid.success).toBe(true);

    // Non-responsive field rejects responsive object
    const nonResInvalid = schema.safeParse({
      fontSize: 16,
      fixedTitle: { base: "Desktop Title", mobile: "Mobile Title" },
    });
    expect(nonResInvalid.success).toBe(false);
  });

  it("[AC-ENG-004] extracts groups, help text, and visibility conditions into metadata", () => {
    // Changed (Task 13): compileSettings now runs the visibility graph check, so the setting that `visibleIf`
    // points at must be in the list (a dangling target is exactly what the check forbids).
    const descriptors: SettingDescriptor[] = [
      { id: "show_cta", type: "toggle", label: "Show Button", default: true },
      {
        id: "hero_cta_url",
        type: "url",
        label: "Button Link",
        default: "/shop",
        help: "URL the button links to (e.g. /products or https://...)",
        group: "call_to_action",
        visibleIf: { setting: "show_cta", eq: true },
      },
    ];

    const { metadata } = compileSettings(descriptors);
    expect(metadata.hero_cta_url.group).toBe("call_to_action");
    expect(metadata.hero_cta_url.help).toBe("URL the button links to (e.g. /products or https://...)");
    expect(metadata.hero_cta_url.visibleIf).toEqual({ setting: "show_cta", eq: true });
  });

  it("[AC-ENG-003] validates complex setting types: color, url, image, typography, spacing, border", () => {
    const descriptors: SettingDescriptor[] = [
      { id: "accent", type: "color", label: "Accent", default: "#112233" },
      { id: "link", type: "url", label: "Link", default: "https://example.com" },
      { id: "banner", type: "image", label: "Banner", default: null },
      { id: "spacing", type: "spacing", label: "Padding", default: { top: 10, bottom: 10 } },
      { id: "border", type: "border", label: "Card Border", default: { width: 1, style: "solid", color: "#cccccc" } },
    ];

    // Image paths are tenant-scoped (AC-ENG-016): the schema is compiled for the owning tenant.
    const { schema } = compileSettings(descriptors, { tenantId: "tenant-1" });

    // Valid values
    expect(
      schema.safeParse({
        accent: "#aabbcc",
        link: "/products/shoes",
        banner: { path: "tenant-1/store/hero.png", alt: "Shoes" },
        spacing: { top: 20, bottom: 20, unit: "px" },
        border: { width: 2, style: "dashed", color: "#111111", radius: 4 },
      }).success,
    ).toBe(true);

    // Invalid values: bad color, javascript URL, bad border style
    expect(schema.safeParse({ accent: "rgb(0,0,0)" }).success).toBe(false);
    expect(schema.safeParse({ link: "javascript:alert(1)" }).success).toBe(false);
    expect(schema.safeParse({ border: { style: "invalid-style" } }).success).toBe(false);

    // Without a tenant the same image is rejected (AC-ENG-016).
    expect(compileSettings(descriptors).schema.safeParse({ banner: { path: "tenant-1/store/hero.png" } }).success).toBe(false);
  });
});
