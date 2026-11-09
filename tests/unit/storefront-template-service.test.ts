import { describe, expect, it, vi, beforeEach } from "vitest";
import { loadStorefrontPage } from "@/services/storefront-template.service";
import { classicPreset, productPreset, collectionPreset } from "@/lib/templates/presets";
import type { ProductDetailData } from "@/components/storefront/engine/types";

// Mock server-only
vi.mock("server-only", () => ({}));

// Mock cutover gate for unit tests
vi.mock("@/services/engine-cutover.service", () => ({
  assertEngineReadsEnabled: vi.fn().mockResolvedValue(undefined),
  isEngineReadEnabled: vi.fn().mockResolvedValue(true),
  EngineReadsDisabledError: class EngineReadsDisabledError extends Error {},
}));

// Mock DB context
const mockExecute = vi.fn();
vi.mock("@/lib/db", () => ({
  getDatabase: () => ({}),
}));

vi.mock("@/lib/db/user-context", () => ({
  withPublicContext: async (_db: unknown, fn: (tx: unknown) => Promise<unknown>) => {
    return fn({
      execute: mockExecute,
    });
  },
  rowsOf: <T>(result: unknown): T[] => {
    if (Array.isArray(result)) return result as T[];
    return ((result as { rows?: unknown[] })?.rows ?? []) as T[];
  },
}));

describe("Phase 4 Storefront Template Service [AC-SF-001..020]", () => {
  beforeEach(() => {
    mockExecute.mockReset();
  });

  describe("Fallback Chain & Registry Defaults [AC-SF-002] [AC-SF-010]", () => {
    it("falls back to registry classicPreset when no template is configured [AC-SF-002]", async () => {
      try {
        mockExecute
          // get_public_template_layout
          .mockResolvedValueOnce({
            rows: [{ l: { source: null, template: null, theme: null, groups: {} } }],
          })
          // get_public_storefront
          .mockResolvedValueOnce({
            rows: [
              {
                s: {
                  name: "Test Store",
                  slug: "test-store",
                  description: "Test description",
                  logo_path: null,
                  currency: "INR",
                  products: [],
                },
              },
            ],
          });

        const result = await loadStorefrontPage("index", "test-store");
        expect(result).not.toBeNull();
        expect(result?.source).toBe("registry");
        expect(result?.document).toEqual(classicPreset);
        expect(result?.store.name).toBe("Test Store");
        expect(result?.groups?.header).toBeNull();
        expect(result?.groups?.footer).toBeNull();
      } catch (e) {
        console.error("UNIT TEST ERROR:", e);
        throw e;
      }
    });

    it("falls back to registry productPreset for unassigned product without default template", async () => {
      mockExecute
        .mockResolvedValueOnce({
          rows: [{ l: { source: null, template: null, theme: null, groups: {} } }],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              p: {
                store: { name: "Test Store", slug: "test-store", currency: "INR" },
                product: {
                  name: "Yoga Mat",
                  slug: "yoga-mat",
                  sku: "SKU-YM-001",
                  price_minor: 199900,
                  has_variants: false,
                },
                images: [],
                options: [],
                variants: [],
                related: [],
              },
            },
          ],
        });

      const result = await loadStorefrontPage("product", "test-store", "yoga-mat");
      expect(result).not.toBeNull();
      expect(result?.source).toBe("registry");
      expect(result?.document).toEqual(productPreset);
      expect(result?.resource?.sku).toBe("SKU-YM-001");
    });

    it("falls back to registry collectionPreset for unassigned collection", async () => {
      mockExecute
        .mockResolvedValueOnce({
          rows: [{ l: { source: null, template: null, theme: null, groups: {} } }],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              c: {
                store: { name: "Test Store", slug: "test-store", currency: "INR" },
                collection: { id: "col-1", name: "Summer", slug: "summer" },
                products: [],
              },
            },
          ],
        });

      const result = await loadStorefrontPage("collection", "test-store", "summer");
      expect(result).not.toBeNull();
      expect(result?.source).toBe("registry");
      expect(result?.document).toEqual(collectionPreset);
      expect(result?.resource?.name).toBe("Summer");
    });

    it("resolves assigned template when available [AC-SF-010]", async () => {
      const customDoc = {
        schemaVersion: 1,
        layout: "classic",
        sections: {
          banner: { type: "hero", settings: { heading: "Custom Assigned Banner" }, blocks: {}, block_order: [] },
        },
        order: ["banner"],
      };

      mockExecute
        .mockResolvedValueOnce({
          rows: [
            {
              l: {
                source: "assigned",
                template: { name: "Assigned Product Template", version_number: 1, document: customDoc },
                theme: null,
                groups: {},
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              p: {
                store: { name: "Test Store", slug: "test-store", currency: "INR" },
                product: {
                  name: "Special Item",
                  slug: "special-item",
                  price_minor: 50000,
                  has_variants: false,
                },
                images: [],
                options: [],
                variants: [],
                related: [],
              },
            },
          ],
        });

      const result = await loadStorefrontPage("product", "test-store", "special-item");
      expect(result).not.toBeNull();
      expect(result?.source).toBe("assigned");
      expect(result?.document.sections.banner.settings.heading).toBe("Custom Assigned Banner");
    });
  });

  describe("SKU Display & Variant Payload [AC-SF-018]", () => {
    it("exposes base SKU and variant SKUs in product resource data", async () => {
      mockExecute
        .mockResolvedValueOnce({
          rows: [{ l: { source: null, template: null, theme: null, groups: {} } }],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              p: {
                store: { name: "Test Store", slug: "test-store", currency: "INR" },
                product: {
                  name: "Running Shoes",
                  slug: "running-shoes",
                  sku: "SKU-BASE-RS",
                  price_minor: 499900,
                  compare_at_price_minor: 599900,
                  has_variants: true,
                },
                images: [
                  { id: "img-red", path: "t1/p1/red.webp", position: 0, is_primary: true },
                  { id: "img-blue", path: "t1/p1/blue.webp", position: 1, is_primary: false },
                ],
                options: [{ name: "Color", values: ["Red", "Blue"] }],
                variants: [
                  {
                    id: "var-1",
                    title: "Red",
                    options: { Color: "Red" },
                    sku: "SKU-VAR-RED",
                    price_minor: 499900,
                    image_id: "img-red",
                  },
                  {
                    id: "var-2",
                    title: "Blue",
                    options: { Color: "Blue" },
                    sku: "SKU-VAR-BLUE",
                    price_minor: 529900,
                    image_id: "img-blue",
                  },
                ],
                related: [],
              },
            },
          ],
        });

      const result = await loadStorefrontPage("product", "test-store", "running-shoes");
      expect(result).not.toBeNull();
      const product = result?.resource as ProductDetailData;
      expect(product?.sku).toBe("SKU-BASE-RS");
      expect(product?.options).toHaveLength(1);
      expect(product?.options?.[0]).toEqual({
        id: "Color",
        name: "Color",
        values: ["Red", "Blue"],
      });
      expect(product?.variants).toHaveLength(2);
      expect(product?.variants?.[0].sku).toBe("SKU-VAR-RED");
      expect(product?.variants?.[0].image_path).toBe("t1/p1/red.webp");
      expect(product?.variants?.[0].option_values).toEqual({ Color: "Red" });
      expect(product?.variants?.[1].sku).toBe("SKU-VAR-BLUE");
      expect(product?.variants?.[1].image_path).toBe("t1/p1/blue.webp");
    });
  });

  describe("Theme Settings & Favicon [AC-SF-009] [AC-SF-015]", () => {
    it("generates CSS variables and extracts favicon from theme [AC-SF-009] [AC-SF-015]", async () => {
      mockExecute
        .mockResolvedValueOnce({
          rows: [
            {
              l: {
                source: "default",
                template: null,
                theme: {
                  settings: {
                    colors: {
                      accent: "#4f46e5",
                      primary: "#111827",
                    },
                  },
                  favicon: "t1/store/custom-favicon.ico",
                },
                groups: {},
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              s: {
                name: "Themed Store",
                slug: "themed-store",
                products: [],
              },
            },
          ],
        });

      const result = await loadStorefrontPage("index", "themed-store");
      expect(result).not.toBeNull();
      expect(result?.faviconPath).toBe("t1/store/custom-favicon.ico");
      expect(result?.themeCss).toContain("--sf-color-accent: #4f46e5;");
      expect(result?.themeCss).toContain("--sf-color-primary: #111827;");
    });
  });

  describe("Route Isolation & 404 Behavior [AC-SF-007]", () => {
    it("returns null for non-existent store", async () => {
      mockExecute
        .mockResolvedValueOnce({ rows: [{ l: null }] })
        .mockResolvedValueOnce({ rows: [{ s: null }] });

      const result = await loadStorefrontPage("index", "non-existent-store");
      expect(result).toBeNull();
    });

    it("returns null for non-existent product", async () => {
      mockExecute
        .mockResolvedValueOnce({ rows: [{ l: null }] })
        .mockResolvedValueOnce({ rows: [{ p: null }] });

      const result = await loadStorefrontPage("product", "test-store", "ghost-product");
      expect(result).toBeNull();
    });

    it("returns null for non-existent collection", async () => {
      mockExecute
        .mockResolvedValueOnce({ rows: [{ l: null }] })
        .mockResolvedValueOnce({ rows: [{ c: null }] });

      const result = await loadStorefrontPage("collection", "test-store", "ghost-collection");
      expect(result).toBeNull();
    });
  });
});
