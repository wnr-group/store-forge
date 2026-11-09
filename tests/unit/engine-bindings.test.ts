import { describe, expect, it } from "vitest";
import {
  BINDING_SOURCES,
  isBindingSource,
  isCompatible,
  resolveBinding,
  safeUrl,
  type BindingContext,
  type BindingSource,
} from "../../lib/templates/engine/bindings";

describe("Engine Data Bindings [AC-ENG-012]", () => {
  it("enforces closed allowlist of binding sources without expression language", () => {
    const expectedSources: BindingSource[] = [
      "store.name",
      "store.description",
      "product.title",
      "product.description",
      "product.price",
      "product.compare_at_price",
      "product.sku",
      "product.featured_image",
      "collection.title",
      "collection.description",
      "collection.featured_image",
    ];

    expect(BINDING_SOURCES).toEqual(expectedSources);
    for (const src of expectedSources) {
      expect(isBindingSource(src)).toBe(true);
    }

    // Expressions or arbitrary lookups are rejected (D9)
    expect(isBindingSource("product.title + '!'")).toBe(false);
    expect(isBindingSource("{{ store.name }}")).toBe(false);
    expect(isBindingSource("store.secret_token")).toBe(false);
    expect(isBindingSource("user.email")).toBe(false);
  });

  it("checks type compatibility between binding sources and setting types", () => {
    expect(isCompatible("product.title", "text")).toBe(true);
    expect(isCompatible("product.featured_image", "image")).toBe(true);
    expect(isCompatible("product.featured_image", "text")).toBe(false);
    expect(isCompatible("product.price", "number")).toBe(true);
    expect(isCompatible("product.description", "richtext")).toBe(true);
    expect(isCompatible("store.name", "image")).toBe(false);
  });

  it("resolves binding against context with fallback on missing data", () => {
    const context: BindingContext = {
      store: {
        name: "Acme Store",
        description: "The best shop",
      },
      product: {
        title: "Running Shoes",
        price: 99.99,
        sku: "SHOE-001",
      },
    };

    expect(resolveBinding({ source: "store.name", fallback: "Fallback Store" }, context)).toBe("Acme Store");
    expect(resolveBinding({ source: "product.title", fallback: "Untitled" }, context)).toBe("Running Shoes");
    expect(resolveBinding({ source: "product.compare_at_price", fallback: 120.0 }, context)).toBe(120.0);
    expect(resolveBinding({ source: "collection.title", fallback: "All Items" }, context)).toBe("All Items");
  });

  it("safeUrl strictly permits http, https, relative, and mailto while rejecting malicious strings", () => {
    // Valid URLs
    expect(safeUrl("https://example.com/products")).toBe("https://example.com/products");
    expect(safeUrl("http://store.local")).toBe("http://store.local");
    expect(safeUrl("/products/shoes")).toBe("/products/shoes");
    expect(safeUrl("#section-1")).toBe("#section-1");
    expect(safeUrl("mailto:support@example.com")).toBe("mailto:support@example.com");

    // Malicious or forbidden schemes rejected
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("java\nscript:alert(1)")).toBeNull();
    expect(safeUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(safeUrl("vbscript:msgbox(1)")).toBeNull();
    expect(safeUrl("file:///etc/passwd")).toBeNull();
    expect(safeUrl(null)).toBeNull();
    expect(safeUrl("")).toBeNull();
    expect(safeUrl("   ")).toBeNull();
  });
});
