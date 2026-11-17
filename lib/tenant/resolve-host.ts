import { apiBaseUrl } from "@/lib/api/config";
import { isPublicId, splitStoreLabel } from "@/lib/tenant/host";

/**
 * Turns a store host label into the store it names.
 *
 *  - `urban-nest-zqkod2`: store slug `urban-nest` + public id `zqkod2`. The public id must be the one the API reports for
 *    that store, so a made-up or stale suffix opens nothing.
 *  - `urban-nest` (the older address format): the label is the store slug itself. Kept so existing links keep working.
 *
 * A label like `acme-store` looks like both ("acme" + public id "store" / the slug "acme-store"), so the new format is
 * tried first and only a CONFIRMED match wins; anything else falls back to the older format. The data comes from the
 * public storefront endpoint (active stores of active organizations only), so an unknown, inactive or suspended store is
 * simply not found. Nothing here grants access: it only decides which public storefront / which workspace a host names.
 */
export type ResolvedStoreHost = { slug: string; publicId: string };

/** Public id for a store slug, or null when no active store has that slug. Throws when the API cannot answer. */
export type StoreLookup = (slug: string) => Promise<string | null>;

const TTL_MS = 60_000; // a renamed or suspended store is picked up within a minute
const MISS_TTL_MS = 15_000;
const MAX_ENTRIES = 500;
const cache = new Map<string, { publicId: string | null; expires: number }>();

/** Test hook. */
export const clearStoreHostCache = () => cache.clear();

/** Reads `publicId` from `GET /public/storefronts/:slug` (no session, nothing cached by the API client). */
export const lookupStorePublicId: StoreLookup = async (slug) => {
  const hit = cache.get(slug);
  if (hit && hit.expires > Date.now()) return hit.publicId;

  const res = await fetch(`${apiBaseUrl()}/public/storefronts/${encodeURIComponent(slug)}`, {
    headers: { accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
  });
  let publicId: string | null = null;
  if (res.ok) {
    const body = (await res.json()) as { data?: { publicId?: unknown } };
    publicId = isPublicId(body.data?.publicId as string | undefined) ? (body.data!.publicId as string) : null;
  } else if (res.status !== 404) {
    throw new Error(`Store lookup failed (${res.status})`); // an outage must not be remembered as "no such store"
  }

  if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
  cache.set(slug, { publicId, expires: Date.now() + (publicId ? TTL_MS : MISS_TTL_MS) });
  return publicId;
};

export async function resolveStoreHost(label: string, lookup: StoreLookup = lookupStorePublicId): Promise<ResolvedStoreHost | null> {
  const parts = splitStoreLabel(label);
  if (parts && (await lookup(parts.slug)) === parts.publicId) return parts;

  // Older address format: the whole label is the store slug. The public id is the store's own, never the one in the host.
  const publicId = await lookup(label);
  return publicId ? { slug: label, publicId } : null;
}
