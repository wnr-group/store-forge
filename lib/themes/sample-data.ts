import type { PreviewStoreData } from "./types";

/**
 * Shown in theme previews only when the store has no products or collections yet, so a brand-new merchant still sees a
 * full page. Never saved, never sent to the API, and the names say plainly that it is sample content.
 */
const names = ["Sample product one", "Sample product two", "Sample product three", "Sample product four", "Sample product five", "Sample product six", "Sample product seven", "Sample product eight"];

export const SAMPLE_PRODUCTS: PreviewStoreData["store"]["products"] = names.map((name, i) => ({
  name,
  slug: `sample-${i + 1}`,
  short_description: "Your product description appears here.",
  price_minor: 99_900 + i * 20_000,
  compare_at_price_minor: i % 3 === 0 ? 129_900 + i * 20_000 : null,
  image_path: null,
}));

export const SAMPLE_COLLECTIONS: PreviewStoreData["collections"] = ["New arrivals", "Best sellers", "Sale", "Gifts"].map((name, i) => ({
  id: `sample-collection-${i + 1}`,
  name,
  slug: `sample-collection-${i + 1}`,
  description: null,
  image_path: null,
  product_count: 6 + i,
}));

/** The merchant's real data where it exists; sample content only for the parts that are still empty. */
export function withSamples(data: PreviewStoreData): PreviewStoreData & { usesSamples: boolean } {
  const noProducts = data.store.products.length === 0;
  const noCollections = data.collections.length === 0;
  return {
    store: { ...data.store, products: noProducts ? SAMPLE_PRODUCTS : data.store.products },
    collections: noCollections ? SAMPLE_COLLECTIONS : data.collections,
    usesSamples: noProducts || noCollections,
  };
}
