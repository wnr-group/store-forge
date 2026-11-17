import "server-only";
import { apiRequest, type PageMeta } from "@/lib/api/client";
import type { PresentationDetail, PresentationPublishResult, PresentationSummary } from "@/lib/themes/types";

/**
 * Per-product presentation endpoints of the StoreForge API: `/store/product-presentations`. Reading needs `dashboard:view`,
 * writing needs `store:manage` (the API checks both). Only products that have settings are listed; any other product reads
 * as the default design with revision 0.
 */

export async function listPresentationsApi(organizationId: string, query: { page: number; limit: number }): Promise<{ items: PresentationSummary[]; meta: PageMeta }> {
  const { data, meta } = await apiRequest<PresentationSummary[]>("/store/product-presentations", { organizationId, query });
  return { items: data, meta: meta ?? { page: query.page, limit: query.limit, total: data.length, totalPages: 1 } };
}

export const getPresentationApi = async (organizationId: string, productId: string) =>
  (await apiRequest<PresentationDetail>(`/store/product-presentations/${productId}`, { organizationId })).data;

/** The whole document plus the revision it was loaded at (0 when the product has none yet). A 409 means someone saved first. */
export const savePresentationDraftApi = async (organizationId: string, productId: string, document: unknown, expectedRevision: number) =>
  (await apiRequest<PresentationDetail>(`/store/product-presentations/${productId}/draft`, { method: "PUT", json: { document, expectedRevision }, organizationId })).data;

export const publishPresentationApi = async (organizationId: string, productId: string, expectedRevision?: number) =>
  (await apiRequest<PresentationPublishResult>(`/store/product-presentations/${productId}/publish`, { method: "POST", json: expectedRevision === undefined ? {} : { expectedRevision }, organizationId })).data;

/** Removes the draft AND the live settings at once; the storefront goes back to the store design immediately. */
export const resetPresentationApi = async (organizationId: string, productId: string) =>
  (await apiRequest<PresentationDetail>(`/store/product-presentations/${productId}`, { method: "DELETE", organizationId })).data;
