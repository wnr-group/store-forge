import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

/** The cart check re-reads the store's PUBLIC products by slug, changes nothing, and trusts nothing the browser sent. */

const getPublicProductApi = vi.fn();
vi.mock("@/lib/api/endpoints/public-api", () => ({ getPublicProductApi: (...a: unknown[]) => getPublicProductApi(...a) }));

import { checkCartAction } from "../../app/s/[slug]/cart/actions";

const product = (over: Record<string, unknown> = {}, variants: unknown[] = []) => ({
  store: { name: "S", slug: "silk-route", description: null, logo_path: null, currency: "INR" },
  product: { name: "Linen Dress", slug: "linen", description: null, short_description: null, product_type: null, sku: null, price_minor: 345000, compare_at_price_minor: null, has_variants: variants.length > 0, category_name: null, available: true, ...over },
  images: [{ id: "i1", path: "t/p/a.jpg", alt: null, position: 0, is_primary: true }],
  options: [],
  variants,
  related: [],
});

beforeEach(() => {
  getPublicProductApi.mockReset();
});

describe("checkCartAction", () => {
  it("returns the live price, name and picture of a plain product", async () => {
    getPublicProductApi.mockResolvedValue(product({ price_minor: 400000, name: "Linen Dress II" }));
    const out = await checkCartAction({ storeSlug: "silk-route", lines: [{ productSlug: "linen", variantId: null }] });
    expect(getPublicProductApi).toHaveBeenCalledWith("silk-route", "linen");
    expect(out).toEqual([{ key: "linen::-", status: "ok", name: "Linen Dress II", variantTitle: null, imagePath: "t/p/a.jpg", unitPriceMinor: 400000, compareAtMinor: null }]);
  });

  it("prices a line by its variant, and drops it when that variant is gone", async () => {
    getPublicProductApi.mockResolvedValue(product({}, [{ id: "v1", title: "S / Oat", options: {}, sku: null, price_minor: 365000, compare_at_price_minor: 400000, image_id: "i1" }]));
    const out = await checkCartAction({
      storeSlug: "silk-route",
      lines: [
        { productSlug: "linen", variantId: "v1" },
        { productSlug: "linen", variantId: "deleted" },
        { productSlug: "linen", variantId: null },
      ],
    });
    expect(out[0]).toMatchObject({ key: "linen::v1", status: "ok", variantTitle: "S / Oat", unitPriceMinor: 365000, compareAtMinor: 400000 });
    expect(out[1]).toEqual({ key: "linen::deleted", status: "gone" });
    expect(out[2]).toEqual({ key: "linen::-", status: "gone" });
  });

  it("marks sold-out and deleted products, but leaves a line alone when the API merely failed", async () => {
    getPublicProductApi.mockImplementation(async (_store: string, slug: string) => {
      if (slug === "soldout") return product({ available: false });
      if (slug === "deleted") throw new AppError("NOT_FOUND", "nope");
      throw new Error("network down");
    });
    const out = await checkCartAction({
      storeSlug: "silk-route",
      lines: [
        { productSlug: "soldout", variantId: null },
        { productSlug: "deleted", variantId: null },
        { productSlug: "flaky", variantId: null },
      ],
    });
    expect(out).toEqual([
      { key: "soldout::-", status: "unavailable" },
      { key: "deleted::-", status: "gone" },
    ]);
  });

  it("asks once per product, always under the one store it was given", async () => {
    getPublicProductApi.mockResolvedValue(product());
    await checkCartAction({ storeSlug: "silk-route", lines: [{ productSlug: "linen", variantId: "a" }, { productSlug: "linen", variantId: "b" }] });
    expect(getPublicProductApi).toHaveBeenCalledTimes(1);
    expect(getPublicProductApi.mock.calls.every((c) => c[0] === "silk-route")).toBe(true);
  });

  it("rejects malformed input without calling the API", async () => {
    for (const bad of [null, "x", { storeSlug: "../etc", lines: [] }, { storeSlug: "Silk Route", lines: [] }, { storeSlug: "ok", lines: [{ productSlug: "", variantId: null }] }, { storeSlug: "ok", lines: Array.from({ length: 51 }, () => ({ productSlug: "p", variantId: null })) }]) {
      expect(await checkCartAction(bad)).toEqual([]);
    }
    expect(getPublicProductApi).not.toHaveBeenCalled();
  });
});
