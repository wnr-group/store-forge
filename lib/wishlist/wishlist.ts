/**
 * Guest wishlist logic. Pure functions only. Like the cart it belongs to ONE store (the browser key contains the store
 * slug) and keeps a snapshot of what the shopper saw; the server action in `app/s/[slug]/wishlist/actions.ts` refreshes it.
 */

export const MAX_WISHLIST = 100;
const STORAGE_PREFIX = "sf-wishlist:v1:";

export type WishlistItem = {
  productSlug: string;
  name: string;
  shortDescription: string | null;
  imagePath: string | null;
  priceMinor: number;
  compareAtMinor: number | null;
  available: boolean;
};

export type Wishlist = { items: WishlistItem[] };

export const emptyWishlist = (): Wishlist => ({ items: [] });
export const wishlistStorageKey = (storeSlug: string) => `${STORAGE_PREFIX}${storeSlug}`;

export const hasItem = (list: Wishlist, productSlug: string) => list.items.some((i) => i.productSlug === productSlug);

/** Adds an item (newest first). Saving a product that is already saved only refreshes its snapshot. */
export function addItem(list: Wishlist, item: WishlistItem): { list: Wishlist; ok: boolean } {
  if (!item.productSlug || !item.name || !Number.isSafeInteger(item.priceMinor) || item.priceMinor < 0) return { list, ok: false };
  if (hasItem(list, item.productSlug)) return { list: { items: list.items.map((i) => (i.productSlug === item.productSlug ? item : i)) }, ok: true };
  if (list.items.length >= MAX_WISHLIST) return { list, ok: false };
  return { list: { items: [item, ...list.items] }, ok: true };
}

export const removeItem = (list: Wishlist, productSlug: string): Wishlist => ({ items: list.items.filter((i) => i.productSlug !== productSlug) });

/** Saves or un-saves, and says which happened. */
export function toggleItem(list: Wishlist, item: WishlistItem): { list: Wishlist; saved: boolean; ok: boolean } {
  if (hasItem(list, item.productSlug)) return { list: removeItem(list, item.productSlug), saved: false, ok: true };
  const result = addItem(list, item);
  return { list: result.list, saved: result.ok, ok: result.ok };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, max: number): string | null => (typeof v === "string" && v.length > 0 && v.length <= max ? v : null);

/** Reads a stored wishlist; malformed entries are dropped one by one, never trusted. */
export function parseWishlist(raw: string | null): Wishlist {
  if (!raw || raw.length > 200_000) return emptyWishlist();
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return emptyWishlist();
  }
  if (!isRecord(data) || !Array.isArray(data.items)) return emptyWishlist();
  const items: WishlistItem[] = [];
  const seen = new Set<string>();
  for (const entry of data.items) {
    if (!isRecord(entry) || items.length >= MAX_WISHLIST) continue;
    const productSlug = str(entry.productSlug, 200);
    const name = str(entry.name, 300);
    const price = entry.priceMinor;
    if (!productSlug || !name || typeof price !== "number" || !Number.isSafeInteger(price) || price < 0 || seen.has(productSlug)) continue;
    seen.add(productSlug);
    const compare = entry.compareAtMinor;
    items.push({
      productSlug,
      name,
      shortDescription: entry.shortDescription == null ? null : str(entry.shortDescription, 500),
      imagePath: entry.imagePath == null ? null : str(entry.imagePath, 500),
      priceMinor: price,
      compareAtMinor: typeof compare === "number" && Number.isSafeInteger(compare) && compare > price ? compare : null,
      available: entry.available !== false,
    });
  }
  return { items };
}

export const serializeWishlist = (list: Wishlist): string => JSON.stringify({ items: list.items });

/** What the server found for one saved product. */
export type ItemCheck = { productSlug: string; status: "gone" } | ({ status: "ok" } & WishlistItem);

/** Removes products that no longer exist and refreshes the rest. Items the server did not answer for are kept. */
export function reconcileWishlist(list: Wishlist, checks: ItemCheck[]): { list: Wishlist; removed: string[] } {
  const bySlug = new Map(checks.map((c) => [c.productSlug, c]));
  const removed: string[] = [];
  const items: WishlistItem[] = [];
  for (const item of list.items) {
    const check = bySlug.get(item.productSlug);
    if (!check) items.push(item);
    else if (check.status === "gone") removed.push(item.name);
    else {
      items.push({ productSlug: check.productSlug, name: check.name, shortDescription: check.shortDescription, imagePath: check.imagePath, priceMinor: check.priceMinor, compareAtMinor: check.compareAtMinor, available: check.available });
    }
  }
  return { list: { items }, removed };
}
