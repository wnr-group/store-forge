"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import { checkWishlistAction } from "@/app/s/[slug]/wishlist/actions";
import { emptyWishlist, parseWishlist, reconcileWishlist, removeItem, serializeWishlist, toggleItem, wishlistStorageKey, type ItemCheck, type Wishlist, type WishlistItem } from "@/lib/wishlist/wishlist";
import { createBrowserStore } from "../browser-store";

export type WishlistApi = {
  items: WishlistItem[];
  count: number;
  /** False until the browser's saved list has been read, so the first paint matches the server's. */
  ready: boolean;
  has: (productSlug: string) => boolean;
  /** Saves or un-saves; returns whether the product is saved afterwards. */
  toggle: (item: WishlistItem) => boolean;
  remove: (productSlug: string) => void;
  revalidate: () => Promise<{ removed: string[] } | null>;
};

const WishlistContext = createContext<WishlistApi | null>(null);

/** The wishlist, or null where there is none (themes without one, pages outside a store). */
export const useOptionalWishlist = () => useContext(WishlistContext);

export function WishlistProvider({ storeSlug, persist, children }: { storeSlug: string; persist: boolean; children: React.ReactNode }) {
  const store = useMemo(() => createBrowserStore(wishlistStorageKey(storeSlug), persist), [storeSlug, persist]);
  const raw = useSyncExternalStore(store.subscribe, store.read, () => null);
  const ready = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const list: Wishlist = useMemo(() => (raw ? parseWishlist(raw) : emptyWishlist()), [raw]);
  // Always the saved list as it is NOW (read from storage), never a copy kept in a ref: an effect in a child component can
  // run before this provider's own effects, and a stale copy would make "refresh on open" see an empty list.
  const current = useCallback((): Wishlist => parseWishlist(store.read()), [store]);

  const commit = useCallback(
    (next: Wishlist) => {
      store.write(next.items.length === 0 ? null : serializeWishlist(next));
    },
    [store],
  );

  const api = useMemo<WishlistApi>(
    () => ({
      items: list.items,
      count: list.items.length,
      ready,
      has: (slug) => list.items.some((i) => i.productSlug === slug),
      toggle: (item) => {
        const result = toggleItem(current(), item);
        if (result.ok) commit(result.list);
        return result.saved;
      },
      remove: (slug) => commit(removeItem(current(), slug)),
      revalidate: async () => {
        const before = current();
        if (before.items.length === 0) return { removed: [] };
        let checks: ItemCheck[];
        try {
          checks = await checkWishlistAction({ storeSlug, productSlugs: before.items.map((i) => i.productSlug) });
        } catch {
          return null;
        }
        // The list may have changed while the check ran, so the result is applied to it as it is now.
        const latest = current();
        const result = reconcileWishlist(latest, checks);
        if (JSON.stringify(result.list) !== JSON.stringify(latest)) commit(result.list);
        return { removed: result.removed };
      },
    }),
    [list, ready, storeSlug, commit, current],
  );

  return <WishlistContext.Provider value={api}>{children}</WishlistContext.Provider>;
}
