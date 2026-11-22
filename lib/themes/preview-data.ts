import { SAMPLE_COLLECTIONS, SAMPLE_CONTENT_PAGES, SAMPLE_PRODUCTS } from "./sample-data";
import type { PreviewStoreData } from "./types";

/**
 * Two ways to look at a theme:
 *  - "store": the merchant's own catalogue, exactly the products and collections shoppers would see (active ones only);
 *  - "demo": isolated sample content for exploring a theme. It exists only in the browser: it is never saved, never sent
 *    to any API and never mixed with real products.
 * There is no silent fallback between the two. A store with no active products shows an empty state in "store" mode.
 */
export type PreviewMode = "store" | "demo";

export type PreviewData = PreviewStoreData & { mode: PreviewMode };

export function previewData(real: PreviewStoreData, mode: PreviewMode): PreviewData {
  if (mode === "store") return { ...real, mode };
  // Demo keeps the store's name, logo and currency so the theme looks like it belongs to this store, nothing else.
  return {
    mode,
    store: { ...real.store, products: SAMPLE_PRODUCTS },
    collections: SAMPLE_COLLECTIONS,
    collectionProducts: Object.fromEntries(SAMPLE_COLLECTIONS.map((c, i) => [c.slug, SAMPLE_PRODUCTS.slice(i, i + 8)])),
    productPage: null,
    contentPages: SAMPLE_CONTENT_PAGES,
  };
}

/** True when the store has something real to preview. */
export const hasStoreProducts = (real: PreviewStoreData): boolean => real.store.products.length > 0;
