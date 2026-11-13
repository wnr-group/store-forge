import "server-only";
import { updateTag } from "next/cache";
import { getActiveStore } from "@/lib/tenant/context";

/**
 * Tenant-aware caching of the public storefront. Every public read of a store is cached under ONE tag that holds the
 * store's slug, so cached data of one store can never answer for another, and one call drops everything a store shows.
 */

/** How long a cached public read may live if nothing invalidates it (a safety net; changes invalidate at once). */
export const STOREFRONT_REVALIDATE_SECONDS = 300;

export const storefrontTag = (slug: string) => `storefront:${slug.toLowerCase()}`;

export const storefrontCache = (slug: string) => ({ tags: [storefrontTag(slug)], revalidate: STOREFRONT_REVALIDATE_SECONDS });

/**
 * Call from a Server Action after anything the storefront shows has changed (products, stock, collections, pages, the
 * theme, store details). The slug comes from the signed-in member's verified workspace, never from the browser. A failure
 * here must not fail the merchant's save: the cached copy then expires on its own within `STOREFRONT_REVALIDATE_SECONDS`.
 */
export async function invalidateStorefront(): Promise<void> {
  try {
    const store = await getActiveStore();
    if (store?.slug) updateTag(storefrontTag(store.slug));
  } catch {
    // Expires on its own.
  }
}
