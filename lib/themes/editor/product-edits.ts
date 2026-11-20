import type { PreviewStoreData } from "@/lib/themes/types";

type PreviewProduct = PreviewStoreData["store"]["products"][number];

/** What the editor knows about a product edited from a card: the fields a card shows, as they were saved. */
export type CardProductEdit = {
  slug: string;
  name: string;
  shortDescription: string;
  priceMinor: number;
  compareAtPriceMinor: number | null;
  imagePath: string | null;
};

const apply = (p: PreviewProduct, e: CardProductEdit): PreviewProduct => ({
  ...p,
  name: e.name,
  short_description: e.shortDescription.trim() ? e.shortDescription : null,
  price_minor: e.priceMinor,
  compare_at_price_minor: e.compareAtPriceMinor,
  image_path: e.imagePath,
});

/**
 * The preview data with products edited from a card shown as saved, so a card changes the moment the save finishes instead of when the
 * page's data is read again. Demo products are never touched (the edit is of a real product). Returns the same object when nothing applies.
 */
export function withProductEdits<T extends PreviewStoreData>(data: T, edits: Record<string, CardProductEdit>): T {
  if (Object.keys(edits).length === 0) return data;
  const map = (list: PreviewProduct[]) => list.map((p) => (edits[p.slug] ? apply(p, edits[p.slug]) : p));
  return {
    ...data,
    store: { ...data.store, products: map(data.store.products) },
    collectionProducts: data.collectionProducts ? Object.fromEntries(Object.entries(data.collectionProducts).map(([k, v]) => [k, map(v)])) : data.collectionProducts,
  };
}
