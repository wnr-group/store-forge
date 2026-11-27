import "server-only";
import {
  assignCatalogProductsApi,
  bulkCatalogAssignmentApi,
  createCatalogHierarchyApi,
  createCatalogLevelApi,
  createCatalogNodeApi,
  deleteCatalogLevelApi,
  deleteCatalogNodeApi,
  exportCatalogApi,
  exportProductsApi,
  getCatalogHierarchyApi,
  getCatalogNodeApi,
  getCatalogTreeApi,
  getProductPlacementsApi,
  importCatalogApi,
  listCatalogNodeProductsApi,
  listCatalogNodesApi,
  moveCatalogNodeApi,
  reorderCatalogLevelsApi,
  reorderCatalogNodeProductsApi,
  reorderCatalogNodesApi,
  setProductPlacementsApi,
  unassignCatalogProductsApi,
  updateCatalogHierarchyApi,
  updateCatalogLevelApi,
  updateCatalogNodeApi,
  type CatalogNodeApiInput,
  type CatalogNodeListApiQuery,
  type CatalogNodeProductsApiQuery,
} from "@/lib/api/endpoints/catalog-api";
import { listProductsApi } from "@/lib/api/endpoints/product-api";
import type { CatalogHierarchy, CatalogImportRequest, CatalogStatus, CatalogTree } from "@/lib/catalog/types";
import { productHolders } from "@/lib/catalog/tree";
import { AppError } from "@/lib/errors";
import { requireActiveTenant } from "@/lib/tenant/context";

/**
 * The catalog hierarchy of the active store, served by the StoreForge API (`/catalog/*`). Each call checks the member's permission
 * first (the API checks it again): `catalog:view` reads, `catalog:manage` writes, `catalog:delete` deletes. The API owns the rules.
 */

const NOT_SET_UP = "CATALOG_HIERARCHY_NOT_FOUND";

/** The hierarchy with its levels, or null while the owner has not set one up (the API answers 404 `CATALOG_HIERARCHY_NOT_FOUND`). */
export async function getCatalogHierarchy(): Promise<CatalogHierarchy | null> {
  const { tenant } = await requireActiveTenant("catalog:view");
  try {
    return await getCatalogHierarchyApi(tenant.id);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND" && error.apiCode === NOT_SET_UP) return null;
    throw error;
  }
}

/** The whole tree (cut at 5000 items by the API; `truncated` says so), or an empty tree before the hierarchy exists. */
export async function getCatalogTree(): Promise<CatalogTree> {
  const { tenant } = await requireActiveTenant("catalog:view");
  try {
    return await getCatalogTreeApi(tenant.id);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND" && error.apiCode === NOT_SET_UP) return { nodes: [], truncated: false };
    throw error;
  }
}

export async function createCatalogHierarchy(input: { name: string; status?: CatalogStatus }) {
  const { tenant } = await requireActiveTenant("catalog:manage");
  return createCatalogHierarchyApi(tenant.id, input);
}

export async function updateCatalogHierarchy(input: { name?: string; status?: CatalogStatus }) {
  const { tenant } = await requireActiveTenant("catalog:manage");
  return updateCatalogHierarchyApi(tenant.id, input);
}

// ------------------------------------------------------------------------------------------------------------------ levels

export async function createCatalogLevel(input: { name: string; canHoldProducts?: boolean; position?: number }) {
  const { tenant } = await requireActiveTenant("catalog:manage");
  return createCatalogLevelApi(tenant.id, input);
}

export async function updateCatalogLevel(id: string, input: { name?: string; canHoldProducts?: boolean }) {
  const { tenant } = await requireActiveTenant("catalog:manage");
  return updateCatalogLevelApi(tenant.id, id, input);
}

export async function reorderCatalogLevels(levelIds: string[]) {
  const { tenant } = await requireActiveTenant("catalog:manage");
  return reorderCatalogLevelsApi(tenant.id, levelIds);
}

export async function deleteCatalogLevel(id: string) {
  const { tenant } = await requireActiveTenant("catalog:delete");
  await deleteCatalogLevelApi(tenant.id, id);
}

// ------------------------------------------------------------------------------------------------------------------ nodes

export async function listCatalogNodes(query: CatalogNodeListApiQuery) {
  const { tenant } = await requireActiveTenant("catalog:view");
  return listCatalogNodesApi(tenant.id, query);
}

export async function getCatalogNode(id: string) {
  const { tenant } = await requireActiveTenant("catalog:view");
  return getCatalogNodeApi(tenant.id, id);
}

export async function createCatalogNode(input: CatalogNodeApiInput & { name: string }) {
  const { tenant } = await requireActiveTenant("catalog:manage");
  return createCatalogNodeApi(tenant.id, input);
}

export async function updateCatalogNode(id: string, input: Omit<CatalogNodeApiInput, "parentId">) {
  const { tenant } = await requireActiveTenant("catalog:manage");
  return updateCatalogNodeApi(tenant.id, id, input);
}

export async function moveCatalogNode(id: string, input: { parentId: string | null; position?: number }) {
  const { tenant } = await requireActiveTenant("catalog:manage");
  return moveCatalogNodeApi(tenant.id, id, input);
}

export async function reorderCatalogNodes(input: { parentId: string | null; nodeIds: string[] }) {
  const { tenant } = await requireActiveTenant("catalog:manage");
  await reorderCatalogNodesApi(tenant.id, input);
}

export async function deleteCatalogNode(id: string, cascade: boolean) {
  const { tenant } = await requireActiveTenant("catalog:delete");
  return deleteCatalogNodeApi(tenant.id, id, cascade);
}

// ------------------------------------------------------------------------------------------------------------------ products on nodes

export async function listCatalogNodeProducts(nodeId: string, query: CatalogNodeProductsApiQuery) {
  const { tenant } = await requireActiveTenant("catalog:view");
  return listCatalogNodeProductsApi(tenant.id, nodeId, query);
}

export async function assignCatalogProducts(nodeId: string, productIds: string[]) {
  const { tenant } = await requireActiveTenant("catalog:manage");
  return assignCatalogProductsApi(tenant.id, nodeId, productIds);
}

export async function unassignCatalogProducts(nodeId: string, productIds: string[]) {
  const { tenant } = await requireActiveTenant("catalog:manage");
  return unassignCatalogProductsApi(tenant.id, nodeId, productIds);
}

export async function reorderCatalogNodeProducts(nodeId: string, productIds: string[]) {
  const { tenant } = await requireActiveTenant("catalog:manage");
  await reorderCatalogNodeProductsApi(tenant.id, nodeId, productIds);
}

export async function bulkCatalogAssignment(input: { action: "assign" | "unassign"; nodeIds: string[]; productIds: string[] }) {
  const { tenant } = await requireActiveTenant("catalog:manage");
  return bulkCatalogAssignmentApi(tenant.id, input);
}

export async function getProductPlacements(productId: string) {
  const { tenant } = await requireActiveTenant("catalog:view");
  return getProductPlacementsApi(tenant.id, productId);
}

export async function setProductPlacements(productId: string, nodeIds: string[]) {
  const { tenant } = await requireActiveTenant("catalog:manage");
  return setProductPlacementsApi(tenant.id, productId, nodeIds);
}

/** A page of the store's products for the "add products" pickers (any status: a draft can be placed before it is published). */
export async function searchProductsForCatalog(input: { search: string; page: number; limit: number }) {
  const { tenant } = await requireActiveTenant("catalog:view");
  const { items, meta } = await listProductsApi(tenant.id, { page: input.page, limit: input.limit, search: input.search || undefined, sortBy: "name", sortOrder: "asc" });
  return {
    items: items.map((p) => ({ id: p.id, name: p.name, sku: p.sku, partNumber: p.partNumber ?? null, status: p.status, priceMinor: p.priceMinor, imagePath: p.imagePath })),
    total: meta.total,
    page: meta.page,
    pageSize: meta.limit,
    totalPages: meta.totalPages,
  };
}

// ------------------------------------------------------------------------------------------------------------------ import / export

/** One request of an import (a dry run when `dryRun` is set). A real import with any problem changes nothing (the API answers 400 with the rows). */
export async function importCatalogRows(input: CatalogImportRequest) {
  const { tenant } = await requireActiveTenant("catalog:manage");
  return importCatalogApi(tenant.id, input);
}

export async function exportCatalogPage(page: number, limit: number) {
  const { tenant } = await requireActiveTenant("catalog:view");
  return exportCatalogApi(tenant.id, { page, limit });
}

export async function exportProductsPage(page: number, limit: number, status: "all" | "draft" | "active" = "all") {
  const { tenant } = await requireActiveTenant("catalog:view");
  return exportProductsApi(tenant.id, { page, limit, status });
}

// ------------------------------------------------------------------------------------------------------------------ product page

/**
 * What the product page needs to show and edit where a product sits in the catalog: the items that may carry products (with their
 * paths) and the product's current placements. Null when the store has no catalog hierarchy, or when it cannot be read: the product
 * page must never fail because of the catalog.
 */
export async function getCatalogForProduct(productId: string) {
  try {
    const hierarchy = await getCatalogHierarchy();
    if (!hierarchy) return null;
    const [tree, placements] = await Promise.all([getCatalogTree(), getProductPlacements(productId)]);
    return { choices: productHolders(tree.nodes, hierarchy.levels), placements, truncated: tree.truncated };
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------------------------------------------------------ navigation

/**
 * Menu link choices for the storefront navigation editor: the catalog itself and its top-level items, once the catalog is live. The
 * menu is part of the theme, so a link added here is one the owner chooses; it is never added behind their back. Empty when there is
 * no live catalog, the member may not read it, or it cannot be read: the navigation page must never fail because of the catalog.
 */
export async function getCatalogLinkChoices(): Promise<{ label: string; url: string }[]> {
  try {
    const hierarchy = await getCatalogHierarchy();
    if (!hierarchy || hierarchy.status !== "active") return [];
    const { tenant } = await requireActiveTenant("catalog:view");
    const top = await listCatalogNodesApi(tenant.id, { page: 1, limit: 20, parentId: "root", status: "active", sortBy: "position", sortOrder: "asc" });
    return [{ label: `Catalog: ${hierarchy.name}`, url: "/catalog" }, ...top.items.map((n) => ({ label: `Catalog: ${n.name}`, url: `/catalog/${n.slug}` }))];
  } catch {
    return [];
  }
}
