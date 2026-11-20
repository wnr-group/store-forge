import { describe, expect, it } from "vitest";
import { withProductEdits, type CardProductEdit } from "@/lib/themes/editor/product-edits";
import type { PreviewStoreData } from "@/lib/themes/types";

const product = (slug: string, name: string) => ({ name, slug, short_description: "old", price_minor: 1000, compare_at_price_minor: null, image_path: "a.jpg" });
const data: PreviewStoreData = {
  store: { name: "S", slug: "s", description: null, logo_path: null, currency: "INR", products: [product("one", "One"), product("two", "Two")] },
  collections: [],
  collectionProducts: { all: [product("two", "Two")] },
};
const edit: CardProductEdit = { slug: "two", name: "Two, renamed", shortDescription: "", priceMinor: 2500, compareAtPriceMinor: 3000, imagePath: "b.jpg" };

describe("products edited from a card", () => {
  it("shows the saved fields on that product, in the store list and in collections", () => {
    const out = withProductEdits(data, { two: edit });
    expect(out.store.products[1]).toMatchObject({ name: "Two, renamed", price_minor: 2500, compare_at_price_minor: 3000, image_path: "b.jpg", short_description: null });
    expect(out.collectionProducts?.all[0].name).toBe("Two, renamed");
  });

  it("leaves other products and the input untouched", () => {
    const out = withProductEdits(data, { two: edit });
    expect(out.store.products[0]).toBe(data.store.products[0]);
    expect(data.store.products[1].name).toBe("Two");
  });

  it("returns the same object when nothing was edited", () => {
    expect(withProductEdits(data, {})).toBe(data);
  });
});
