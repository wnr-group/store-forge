import "server-only";
import { apiRequest } from "@/lib/api/client";
import type { PublicCatalogNodePage, PublicCatalogSort, PublicCatalogTree } from "@/lib/catalog/public-types";
import { storefrontCache } from "@/lib/storefront/cache";

/**
 * `GET /public/storefronts/:slug/catalog/...`: the published catalog hierarchy of a store, one shape for every storefront template.
 * Anonymous and cached under the store's own tag, like every other public read, so a dashboard change shows on the next page.
 */

export const getPublicCatalogTreeApi = async (slug: string, maxDepth?: number) =>
  (await apiRequest<PublicCatalogTree>(`/public/storefronts/${encodeURIComponent(slug)}/catalog/tree`, { anonymous: true, cache: storefrontCache(slug), query: { maxDepth } })).data;

/** `segments` are the item slugs from the top level down; each one is encoded on its own so a "/" can never be smuggled into a segment. */
export const getPublicCatalogNodeApi = async (slug: string, segments: string[], query: { page?: number; limit?: number; sort?: PublicCatalogSort; includeDescendants?: boolean }) =>
  (
    await apiRequest<PublicCatalogNodePage>(`/public/storefronts/${encodeURIComponent(slug)}/catalog/nodes/${segments.map(encodeURIComponent).join("/")}`, {
      anonymous: true,
      cache: storefrontCache(slug),
      query: { page: query.page, limit: query.limit, sort: query.sort, includeDescendants: query.includeDescendants ? true : undefined },
    })
  ).data;
