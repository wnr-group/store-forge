import "server-only";
import { apiRequest } from "@/lib/api/client";

/** `GET/POST/PATCH/DELETE /categories` of the StoreForge API. Dates arrive as ISO strings. */
export type CategoryApi = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  parentName: string | null;
  productCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CategoryApiInput = { name: string; slug?: string; description?: string | null; parentId?: string | null };

export const listCategoriesApi = async (organizationId: string) =>
  (await apiRequest<CategoryApi[]>("/categories", { organizationId })).data;

export const getCategoryApi = async (organizationId: string, id: string) =>
  (await apiRequest<CategoryApi>(`/categories/${id}`, { organizationId })).data;

export const createCategoryApi = async (organizationId: string, input: CategoryApiInput) =>
  (await apiRequest<CategoryApi>("/categories", { method: "POST", json: input, organizationId })).data;

export const updateCategoryApi = async (organizationId: string, id: string, input: CategoryApiInput) =>
  (await apiRequest<CategoryApi>(`/categories/${id}`, { method: "PATCH", json: input, organizationId })).data;

export const deleteCategoryApi = async (organizationId: string, id: string) => {
  await apiRequest(`/categories/${id}`, { method: "DELETE", organizationId });
};
