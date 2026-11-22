import { apiBaseUrl } from "@/lib/api/config";
import { isPublicId, isStoreLabel } from "@/lib/tenant/host";

/**
 * Turns a store host label into the store it names.
 *
 *  - `urban-nest-zqkod2`: the label is the store's stored address (`stores.subdomain`, kept by the database as
 *    `{store slug}-{tenant public id}`). The API looks it up whole (`GET /public/hosts/:subdomain`); the label is never
 *    split or rebuilt here, so a made-up or stale suffix opens nothing.
 *  - `urban-nest` (the older address format): the label is the store slug itself. Kept so existing links keep working.
 *
 * A label like `acme-store` can be both (a stored address, or the slug "acme-store"), so the stored address is tried
 * first and only a CONFIRMED match wins; anything else falls back to the older format. The data comes from public API
 * endpoints (active stores of active organizations only), so an unknown, inactive or suspended store is simply not
 * found. Nothing here grants access: it only decides which public storefront / which workspace a host names.
 */
export type ResolvedStoreHost = { slug: string; publicId: string };

/** The store a stored address names, or null when no active store has it. Throws when the API cannot answer. */
export type HostLookup = (subdomain: string) => Promise<ResolvedStoreHost | null>;
/** Public id for a store slug, or null when no active store has that slug. Throws when the API cannot answer. */
export type StoreLookup = (slug: string) => Promise<string | null>;

const TTL_MS = 60_000; // a renamed or suspended store is picked up within a minute
const MISS_TTL_MS = 15_000;
const MAX_ENTRIES = 500;
const cache = new Map<string, { value: unknown; expires: number }>();

/** Test hook. */
export const clearStoreHostCache = () => cache.clear();

/**
 * GET a public API path (no session, nothing cached by the API client). 404 is a remembered "no such store"; any other
 * failure throws and is NOT remembered, so an outage is never read as "no such store".
 */
async function cachedPublicLookup<T>(key: string, path: string, read: (data: unknown) => T | null): Promise<T | null> {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T | null;

  const res = await fetch(`${apiBaseUrl()}${path}`, {
    headers: { accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
  });
  let value: T | null = null;
  if (res.ok) {
    const body = (await res.json()) as { data?: unknown };
    value = read(body.data);
  } else if (res.status !== 404) {
    throw new Error(`Store lookup failed (${res.status})`);
  }

  if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
  cache.set(key, { value, expires: Date.now() + (value ? TTL_MS : MISS_TTL_MS) });
  return value;
}

/** Reads `{ slug, publicId }` from `GET /public/hosts/:subdomain`. Anything malformed counts as not found. */
export const lookupStoreBySubdomain: HostLookup = (subdomain) =>
  cachedPublicLookup(`host:${subdomain}`, `/public/hosts/${encodeURIComponent(subdomain)}`, (data) => {
    const d = data as { slug?: unknown; publicId?: unknown } | undefined;
    return typeof d?.slug === "string" && isStoreLabel(d.slug) && isPublicId(d.publicId as string | undefined)
      ? { slug: d.slug, publicId: d.publicId as string }
      : null;
  });

/** Reads `publicId` from `GET /public/storefronts/:slug` (the older address format). */
export const lookupStorePublicId: StoreLookup = (slug) =>
  cachedPublicLookup(`slug:${slug}`, `/public/storefronts/${encodeURIComponent(slug)}`, (data) => {
    const id = (data as { publicId?: unknown } | undefined)?.publicId;
    return isPublicId(id as string | undefined) ? (id as string) : null;
  });

export async function resolveStoreHost(
  label: string,
  lookups: { bySubdomain: HostLookup; bySlug: StoreLookup } = { bySubdomain: lookupStoreBySubdomain, bySlug: lookupStorePublicId },
): Promise<ResolvedStoreHost | null> {
  const host = await lookups.bySubdomain(label);
  if (host) return host;

  // Older address format: the whole label is the store slug. The public id is the store's own, never one from the host.
  const publicId = await lookups.bySlug(label);
  return publicId ? { slug: label, publicId } : null;
}
