import "server-only";
import { apiRequest } from "@/lib/api/client";

/** `/store/pages` of the StoreForge API: the content pages of the store (About, Contact...). Dates arrive as ISO strings. */
export type StorePageApi = {
  id: string;
  title: string;
  slug: string;
  body: string;
  status: "draft" | "published";
  createdAt: string;
  updatedAt: string;
};

export type StorePageInput = { title: string; slug?: string; body?: string; status?: "draft" | "published" };

export const listPagesApi = async (organizationId: string) => (await apiRequest<StorePageApi[]>("/store/pages", { organizationId })).data;

export const createPageApi = async (organizationId: string, input: StorePageInput) =>
  (await apiRequest<StorePageApi>("/store/pages", { method: "POST", json: input, organizationId })).data;

export const updatePageApi = async (organizationId: string, id: string, input: Partial<StorePageInput>) =>
  (await apiRequest<StorePageApi>(`/store/pages/${id}`, { method: "PATCH", json: input, organizationId })).data;

export const deletePageApi = async (organizationId: string, id: string) => {
  await apiRequest(`/store/pages/${id}`, { method: "DELETE", organizationId });
};
