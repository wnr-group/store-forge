import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

/** Public storefront in API mode: the existing PublicStorefront shape, 404 = no store, no database. */

vi.mock("@/lib/db", () => ({
  getDatabase: () => {
    throw new Error("the database path must not be used in API mode");
  },
}));
const getStorefrontApi = vi.fn();
vi.mock("@/lib/api/endpoints/public-api", () => ({ getStorefrontApi: (...a: unknown[]) => getStorefrontApi(...a) }));

beforeEach(() => {
  vi.clearAllMocks();
  process.env.API_BASE_URL = "http://localhost:4000/api/v1";
  process.env.AUTH_BFF_SECRET = "s".repeat(40);
});

describe("getPublicStorefront in API mode", () => {
  it("maps the API's camelCase back to the snake_case storefront the templates read", async () => {
    getStorefrontApi.mockResolvedValue({
      name: "Acme", slug: "acme", description: null, logoPath: "t/store/l.png", currency: "INR",
      products: [{ name: "Tee", slug: "tee", shortDescription: null, priceMinor: 999, compareAtPriceMinor: null, imagePath: null }],
      template: { key: "classic", accent_color: "#111111", hero_heading: null, hero_subheading: null, hero_image_path: null },
    });
    const { getPublicStorefront } = await import("@/services/storefront.service");
    await expect(getPublicStorefront("acme")).resolves.toEqual({
      name: "Acme", slug: "acme", description: null, logo_path: "t/store/l.png", meta_title: null, meta_description: null, currency: "INR",
      products: [{ name: "Tee", slug: "tee", short_description: null, price_minor: 999, compare_at_price_minor: null, image_path: null }],
      template: { key: "classic", accent_color: "#111111", hero_heading: null, hero_subheading: null, hero_image_path: null },
    });
    expect(getStorefrontApi).toHaveBeenCalledWith("acme");
  });

  it("passes the SEO title and description through, and treats an API that omits them as null", async () => {
    const { getPublicStorefront } = await import("@/services/storefront.service");
    getStorefrontApi.mockResolvedValue({ name: "S1", slug: "seo-one", description: null, logoPath: null, metaTitle: "Acme | Candles", metaDescription: "Hand-poured.", currency: "INR", products: [], template: null });
    await expect(getPublicStorefront("seo-one")).resolves.toMatchObject({ meta_title: "Acme | Candles", meta_description: "Hand-poured." });
    getStorefrontApi.mockResolvedValue({ name: "S2", slug: "seo-two", description: null, logoPath: null, currency: "INR", products: [], template: null });
    await expect(getPublicStorefront("seo-two")).resolves.toMatchObject({ meta_title: null, meta_description: null });
  });

  it("a store without template settings still renders (template null)", async () => {
    getStorefrontApi.mockResolvedValue({ name: "A", slug: "a", description: null, logoPath: null, currency: "INR", products: [], template: null });
    const { getPublicStorefront } = await import("@/services/storefront.service");
    expect((await getPublicStorefront("a"))?.template).toBeNull();
  });

  it("unknown, inactive and suspended stores (404) are simply no store; real failures are not hidden", async () => {
    const { getPublicStorefront } = await import("@/services/storefront.service");
    getStorefrontApi.mockRejectedValueOnce(new AppError("NOT_FOUND", "Store not found."));
    await expect(getPublicStorefront("nope")).resolves.toBeNull();
    getStorefrontApi.mockRejectedValueOnce(new AppError("UNKNOWN", "down"));
    await expect(getPublicStorefront("acme")).rejects.toMatchObject({ code: "UNKNOWN" });
  });
});
