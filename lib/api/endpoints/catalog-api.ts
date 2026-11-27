import "server-only";
import { apiRequest } from "@/lib/api/client";
import type {
  CatalogAssignResult,
  CatalogExportPage,
  CatalogHierarchy,
  CatalogImportRequest,
  CatalogImportResult,
  CatalogLevel,
  CatalogNode,
  CatalogNodeDetail,
  CatalogNodeProduct,
  CatalogPage,
  CatalogProductPlacement,
  CatalogStatus,
  CatalogTree,
  ProductExportPage,
} from "@/lib/catalog/types";

/**
 * `/catalog/*` of the StoreForge API (the manager side of the catalog hierarchy). Request and response shapes follow the API's
 * `catalog-hierarchy.dto.ts`; the API owns every rule (level order, which levels hold products, slugs, cycles).
 */

const ORG = (organizationId: string) => ({ organizationId });

// ------------------------------------------------------------------------------------------------------------------ hierarchy

export const getCatalogHierarchyApi = async (organizationId: string) => (await apiRequest<CatalogHierarchy>("/catalog/hierarchy", ORG(organizationId))).data;

export const createCatalogHierarchyApi = async (organizationId: string, input: { name: string; status?: CatalogStatus }) =>
  (await apiRequest<CatalogHierarchy>("/catalog/hierarchy", { ...ORG(organizationId), method: "POST", json: input })).data;

export const updateCatalogHierarchyApi = async (organizationId: string, input: { name?: string; status?: CatalogStatus }) =>
  (await apiRequest<CatalogHierarchy>("/catalog/hierarchy", { ...ORG(organizationId), method: "PATCH", json: input })).data;

// ------------------------------------------------------------------------------------------------------------------ levels

export const listCatalogLevelsApi = async (organizationId: string) => (await apiRequest<CatalogLevel[]>("/catalog/levels", ORG(organizationId))).data;

export const createCatalogLevelApi = async (organizationId: string, input: { name: string; canHoldProducts?: boolean; position?: number }) =>
  (await apiRequest<CatalogLevel>("/catalog/levels", { ...ORG(organizationId), method: "POST", json: input })).data;

export const reorderCatalogLevelsApi = async (organizationId: string, levelIds: string[]) =>
  (await apiRequest<CatalogLevel[]>("/catalog/levels/reorder", { ...ORG(organizationId), method: "POST", json: { levelIds } })).data;

export const updateCatalogLevelApi = async (organizationId: string, id: string, input: { name?: string; canHoldProducts?: boolean }) =>
  (await apiRequest<CatalogLevel>(`/catalog/levels/${id}`, { ...ORG(organizationId), method: "PATCH", json: input })).data;

export const deleteCatalogLevelApi = async (organizationId: string, id: string) => {
  await apiRequest(`/catalog/levels/${id}`, { ...ORG(organizationId), method: "DELETE" });
};

// ------------------------------------------------------------------------------------------------------------------ nodes

export const getCatalogTreeApi = async (organizationId: string, query: { parentId?: string; maxDepth?: number } = {}) =>
  (await apiRequest<CatalogTree>("/catalog/tree", { ...ORG(organizationId), query })).data;

export type CatalogNodeListApiQuery = {
  page: number;
  limit: number;
  search?: string;
  /** An item id, or `root` for the top level. */
  parentId?: string;
  levelId?: string;
  status?: CatalogStatus | "all";
  sortBy?: "position" | "name" | "createdAt";
  sortOrder?: "asc" | "desc";
};

export async function listCatalogNodesApi(organizationId: string, query: CatalogNodeListApiQuery): Promise<CatalogPage<CatalogNode>> {
  const { data, meta } = await apiRequest<CatalogNode[]>("/catalog/nodes", { ...ORG(organizationId), query });
  return pageOf(data, meta, query);
}

export type CatalogNodeApiInput = {
  name?: string;
  slug?: string;
  parentId?: string | null;
  description?: string | null;
  status?: CatalogStatus;
  position?: number;
  seoTitle?: string | null;
  seoDescription?: string | null;
};

export const createCatalogNodeApi = async (organizationId: string, input: CatalogNodeApiInput & { name: string }) =>
  (await apiRequest<CatalogNodeDetail>("/catalog/nodes", { ...ORG(organizationId), method: "POST", json: input })).data;

export const reorderCatalogNodesApi = async (organizationId: string, input: { parentId: string | null; nodeIds: string[] }) => {
  await apiRequest("/catalog/nodes/reorder", { ...ORG(organizationId), method: "POST", json: input });
};

export const getCatalogNodeApi = async (organizationId: string, id: string) => (await apiRequest<CatalogNodeDetail>(`/catalog/nodes/${id}`, ORG(organizationId))).data;

export const updateCatalogNodeApi = async (organizationId: string, id: string, input: Omit<CatalogNodeApiInput, "parentId">) =>
  (await apiRequest<CatalogNodeDetail>(`/catalog/nodes/${id}`, { ...ORG(organizationId), method: "PATCH", json: input })).data;

export const moveCatalogNodeApi = async (organizationId: string, id: string, input: { parentId: string | null; position?: number }) =>
  (await apiRequest<CatalogNodeDetail>(`/catalog/nodes/${id}/move`, { ...ORG(organizationId), method: "POST", json: input })).data;

export const deleteCatalogNodeApi = async (organizationId: string, id: string, cascade: boolean) =>
  (await apiRequest<{ deleted: number }>(`/catalog/nodes/${id}`, { ...ORG(organizationId), method: "DELETE", query: { cascade: cascade ? true : undefined } })).data;

// ------------------------------------------------------------------------------------------------------------------ products on nodes

export type CatalogNodeProductsApiQuery = {
  page: number;
  limit: number;
  search?: string;
  includeDescendants?: boolean;
  sortBy?: "position" | "name" | "createdAt";
  sortOrder?: "asc" | "desc";
};

export async function listCatalogNodeProductsApi(organizationId: string, nodeId: string, query: CatalogNodeProductsApiQuery): Promise<CatalogPage<CatalogNodeProduct>> {
  const { data, meta } = await apiRequest<CatalogNodeProduct[]>(`/catalog/nodes/${nodeId}/products`, { ...ORG(organizationId), query });
  return pageOf(data, meta, query);
}

export const assignCatalogProductsApi = async (organizationId: string, nodeId: string, productIds: string[]) =>
  (await apiRequest<CatalogAssignResult>(`/catalog/nodes/${nodeId}/products`, { ...ORG(organizationId), method: "POST", json: { productIds } })).data;

export const unassignCatalogProductsApi = async (organizationId: string, nodeId: string, productIds: string[]) =>
  (await apiRequest<{ removed: number }>(`/catalog/nodes/${nodeId}/products/unassign`, { ...ORG(organizationId), method: "POST", json: { productIds } })).data;

export const reorderCatalogNodeProductsApi = async (organizationId: string, nodeId: string, productIds: string[]) => {
  await apiRequest(`/catalog/nodes/${nodeId}/products/reorder`, { ...ORG(organizationId), method: "POST", json: { productIds } });
};

export const bulkCatalogAssignmentApi = async (organizationId: string, input: { action: "assign" | "unassign"; nodeIds: string[]; productIds: string[] }) =>
  (await apiRequest<CatalogAssignResult & { removed?: number }>("/catalog/assignments/bulk", { ...ORG(organizationId), method: "POST", json: input, timeoutMs: 60_000 })).data;

export const getProductPlacementsApi = async (organizationId: string, productId: string) =>
  (await apiRequest<CatalogProductPlacement[]>(`/catalog/products/${productId}/nodes`, ORG(organizationId))).data;

export const setProductPlacementsApi = async (organizationId: string, productId: string, nodeIds: string[]) =>
  (await apiRequest<CatalogProductPlacement[]>(`/catalog/products/${productId}/nodes`, { ...ORG(organizationId), method: "PUT", json: { nodeIds } })).data;

// ------------------------------------------------------------------------------------------------------------------ import / export

export const importCatalogApi = async (organizationId: string, input: CatalogImportRequest) =>
  (await apiRequest<CatalogImportResult>("/catalog/import", { ...ORG(organizationId), method: "POST", json: input, timeoutMs: 120_000 })).data;

export const exportCatalogApi = async (organizationId: string, query: { page: number; limit: number }) =>
  (await apiRequest<CatalogExportPage>("/catalog/export", { ...ORG(organizationId), query, timeoutMs: 60_000 })).data;

export const exportProductsApi = async (organizationId: string, query: { page: number; limit: number; status?: "all" | "draft" | "active" }) =>
  (await apiRequest<ProductExportPage>("/products/export", { ...ORG(organizationId), query, timeoutMs: 60_000 })).data;

function pageOf<T>(items: T[], meta: { page: number; limit: number; total: number; totalPages: number } | undefined, fallback: { page: number; limit: number }): CatalogPage<T> {
  return {
    items,
    total: meta?.total ?? items.length,
    page: meta?.page ?? fallback.page,
    pageSize: meta?.limit ?? fallback.limit,
    totalPages: meta?.totalPages ?? 1,
  };
}
