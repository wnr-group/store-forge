import "server-only";
import { apiRequest } from "@/lib/api/client";

/** `/collections` of the StoreForge API. Dates arrive as ISO strings. */
export type CollectionApi = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: "draft" | "active" | "archived" | (string & {});
  imagePath: string | null;
  productCount: number;
  createdAt: string;
  updatedAt: string;
};
export type CollectionDetailApi = CollectionApi & { productIds: string[] };

export type CollectionApiInput = {
  id?: string;
  name: string;
  slug?: string;
  description?: string | null;
  status?: string;
  imagePath?: string | null;
  productIds?: string[];
};

export const listCollectionsApi = async (organizationId: string) =>
  (await apiRequest<CollectionApi[]>("/collections", { organizationId })).data;

export const getCollectionApi = async (organizationId: string, id: string) =>
  (await apiRequest<CollectionDetailApi>(`/collections/${id}`, { organizationId })).data;

export const listProductOptionsApi = async (organizationId: string) =>
  (await apiRequest<{ id: string; name: string }[]>("/collections/product-options", { organizationId })).data;

export const createCollectionApi = async (organizationId: string, input: CollectionApiInput) =>
  (await apiRequest<CollectionDetailApi>("/collections", { method: "POST", json: input, organizationId })).data;

export const updateCollectionApi = async (organizationId: string, id: string, input: Omit<CollectionApiInput, "id">) =>
  (await apiRequest<CollectionDetailApi>(`/collections/${id}`, { method: "PATCH", json: input, organizationId })).data;

export const deleteCollectionApi = async (organizationId: string, id: string) => {
  await apiRequest(`/collections/${id}`, { method: "DELETE", organizationId });
};
