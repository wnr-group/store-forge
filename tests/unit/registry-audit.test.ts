import { describe, expect, it } from "vitest";
import { getRegistry } from "@/lib/templates/registry/index";
import { checkDescriptors } from "@/lib/templates/engine/descriptor-check";

const APPROVED_SECTIONS = [
  "announcement-bar",
  "header",
  "footer",
  "hero",
  "image-banner",
  "rich-text",
  "image-with-text",
  "multicolumn",
  "collapsible-content",
  "testimonials",
  "product-grid",
  "collection-list",
  "featured-collection",
  "collection-banner",
  "main-product",
  "related-products",
  "promotional-banner",
  "logo-list",
] as const;

const APPROVED_BLOCKS = [
  "heading",
  "text",
  "button",
  "image",
  "link",
  "link-column",
  "social-link",
  "column",
  "collapsible-item",
  "testimonial",
  "group",
  "product-title",
  "product-price",
  "product-compare-at-price",
  "product-sku",
  "product-type",
  "product-category",
  "product-description",
  "variant-picker",
  "collapsible-info",
  "social-share",
] as const;

const FORBIDDEN_COMPONENT_IDS = [
  "cart",
  "quantity",
  "buy",
  "buy-button",
  "rating",
  "ratings",
  "newsletter",
  "video",
  "countdown",
];

describe("Component Registry Audit [AC-REN-011]", () => {
  const registry = getRegistry();

  it("contains exactly the 18 approved sections", () => {
    const sectionKeys = Object.keys(registry.sections).sort();
    expect(sectionKeys).toEqual([...APPROVED_SECTIONS].sort());
    expect(sectionKeys.length).toBe(18);
  });

  it("contains exactly the 21 approved blocks", () => {
    const blockKeys = Object.keys(registry.blocks).sort();
    expect(blockKeys).toEqual([...APPROVED_BLOCKS].sort());
    expect(blockKeys.length).toBe(21);
  });

  it("contains no unsupported or forbidden component IDs", () => {
    const allKeys = [...Object.keys(registry.sections), ...Object.keys(registry.blocks)];
    for (const forbidden of FORBIDDEN_COMPONENT_IDS) {
      expect(allKeys).not.toContain(forbidden);
    }
  });

  it("button block is strictly link-only (no action/cart/buy settings)", () => {
    const buttonBlock = registry.blocks.button;
    expect(buttonBlock).toBeDefined();
    const settingIds = buttonBlock.settings.map((s) => s.id);
    expect(settingIds).toContain("label");
    expect(settingIds).toContain("link");
    expect(settingIds).not.toContain("action");
    expect(settingIds).not.toContain("addToCart");
    expect(settingIds).not.toContain("buyNow");
  });

  it("every section and block definition passes checkDescriptors without issues", () => {
    for (const [type, section] of Object.entries(registry.sections)) {
      expect(section.type).toBe(type);
      const issues = checkDescriptors(section.settings);
      expect(issues, `Section ${type} descriptor issues`).toEqual([]);
    }
    for (const [type, block] of Object.entries(registry.blocks)) {
      expect(block.type).toBe(type);
      const issues = checkDescriptors(block.settings);
      expect(issues, `Block ${type} descriptor issues`).toEqual([]);
    }
  });
});
