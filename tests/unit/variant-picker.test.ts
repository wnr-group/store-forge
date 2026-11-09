import { describe, expect, it } from "vitest";
import {
  resolveVariant,
  resolveSelectedProductDetails,
  type ProductOption,
  type ProductVariantSummary,
} from "@/lib/templates/variant-selection";

describe("Variant Picker Logic [AC-REN-009]", () => {
  const options: ProductOption[] = [
    { id: "opt-color", name: "Color", values: ["Red", "Blue", "Green"] },
    { id: "opt-size", name: "Size", values: ["Small", "Medium", "Large"] },
  ];

  const variants: ProductVariantSummary[] = [
    {
      id: "var-1",
      title: "Red / Small",
      price_minor: 120000,
      compare_at_price_minor: 150000,
      sku: "TSHIRT-RED-S",
      image_path: "tenant-1/store/red-shirt.webp",
      option_values: { Color: "Red", Size: "Small" },
    },
    {
      id: "var-2",
      title: "Red / Medium",
      price_minor: 130000,
      compare_at_price_minor: null,
      sku: "TSHIRT-RED-M",
      image_path: "tenant-1/store/red-shirt.webp",
      option_values: { Color: "Red", Size: "Medium" },
    },
    {
      id: "var-3",
      title: "Blue / Large",
      price_minor: 140000,
      compare_at_price_minor: 180000,
      sku: "TSHIRT-BLUE-L",
      image_path: "tenant-1/store/blue-shirt.webp",
      option_values: { Color: "Blue", Size: "Large" },
    },
  ];

  const baseProduct = {
    name: "Classic Tee",
    price_minor: 100000,
    compare_at_price_minor: null,
    sku: "TSHIRT-BASE",
    image_path: "tenant-1/store/default-tee.webp",
    options,
    variants,
  };

  it("finds the exact matching variant for full option selection", () => {
    const match = resolveVariant(variants, { Color: "Red", Size: "Medium" });
    expect(match).toBeDefined();
    expect(match?.id).toBe("var-2");
    expect(match?.sku).toBe("TSHIRT-RED-M");
    expect(match?.price_minor).toBe(130000);
  });

  it("returns undefined when no variant matches the selected combination", () => {
    const match = resolveVariant(variants, { Color: "Green", Size: "Small" });
    expect(match).toBeUndefined();
  });

  it("updates price, SKU, and image when a variant is chosen [AC-REN-009]", () => {
    const state = resolveSelectedProductDetails(baseProduct, { Color: "Blue", Size: "Large" });
    expect(state.selectedVariant?.id).toBe("var-3");
    expect(state.price_minor).toBe(140000);
    expect(state.compare_at_price_minor).toBe(180000);
    expect(state.sku).toBe("TSHIRT-BLUE-L");
    expect(state.image_path).toBe("tenant-1/store/blue-shirt.webp");
  });

  it("falls back to base product details when selection is incomplete or unmatched", () => {
    const state = resolveSelectedProductDetails(baseProduct, { Color: "Green" });
    expect(state.selectedVariant).toBeUndefined();
    expect(state.price_minor).toBe(100000);
    expect(state.compare_at_price_minor).toBeNull();
    expect(state.sku).toBe("TSHIRT-BASE");
    expect(state.image_path).toBe("tenant-1/store/default-tee.webp");
  });

  it("handles products with no variants cleanly", () => {
    const simpleProduct = {
      name: "Simple Mug",
      price_minor: 50000,
      compare_at_price_minor: 60000,
      sku: "MUG-001",
      image_path: "tenant-1/store/mug.webp",
    };
    const state = resolveSelectedProductDetails(simpleProduct, {});
    expect(state.selectedVariant).toBeUndefined();
    expect(state.price_minor).toBe(50000);
    expect(state.sku).toBe("MUG-001");
  });
});
