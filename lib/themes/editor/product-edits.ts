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

/** A product just added from the editor, as the preview lists it. */
export type AddedProduct = { slug: string; name: string; shortDescription: string; priceMinor: number; compareAtPriceMinor: number | null; imagePath: string | null };

/**
 * The preview data with products added from the editor listed first (the store lists newest first), until the page's own data has
 * them too. A slug already in the list is not added twice. Returns the same object when there is nothing to add.
 */
export function withAddedProducts<T extends PreviewStoreData>(data: T, added: AddedProduct[]): T {
  const known = new Set(data.store.products.map((p) => p.slug));
  const fresh = added.filter((a) => !known.has(a.slug));
  if (fresh.length === 0) return data;
  const rows: PreviewProduct[] = fresh.map((a) => ({ name: a.name, slug: a.slug, short_description: a.shortDescription.trim() ? a.shortDescription : null, price_minor: a.priceMinor, compare_at_price_minor: a.compareAtPriceMinor, image_path: a.imagePath }));
  return { ...data, store: { ...data.store, products: [...rows, ...data.store.products] } };
}

/** What the editor knows about a collection edited from a card: the fields a collection card shows, as they were saved. */
export type CardCollectionEdit = { id: string; name: string; description: string; imagePath: string | null };

/**
 * The preview data with collections edited from a card shown as saved, so a card changes the moment the save finishes. Demo
 * collections are never touched. Returns the same object when nothing applies.
 */
export function withCollectionEdits<T extends PreviewStoreData>(data: T, edits: Record<string, CardCollectionEdit>): T {
  if (Object.keys(edits).length === 0) return data;
  return { ...data, collections: data.collections.map((c) => (edits[c.id] ? { ...c, name: edits[c.id].name, description: edits[c.id].description.trim() ? edits[c.id].description : null, image_path: edits[c.id].imagePath } : c)) };
}
