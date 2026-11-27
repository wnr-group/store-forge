import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

/**
 * The catalog hierarchy's calls to the StoreForge API: each endpoint function sends exactly the verb, path, query and body the API's
 * controller declares (store-forge-api `catalog-hierarchy.controller.ts`), and each service function checks the right permission first.
 */

const tenant = { id: "11111111-1111-4111-8111-111111111111" };
const requireActiveTenant = vi.fn<(permission?: string) => Promise<{ tenant: typeof tenant }>>(async () => ({ tenant }));
vi.mock("@/lib/tenant/context", () => ({ requireActiveTenant: (p?: string) => requireActiveTenant(p) }));

const apiRequest = vi.fn();
vi.mock("@/lib/api/client", () => ({ apiRequest: (...a: unknown[]) => apiRequest(...a) }));
vi.mock("@/lib/storefront/cache", () => ({ storefrontCache: (slug: string) => ({ tags: [`storefront:${slug}`], revalidate: 300 }) }));

const ID = "22222222-2222-4222-8222-222222222222";
const ID2 = "33333333-3333-4333-8333-333333333333";

beforeEach(() => {
  vi.clearAllMocks();
  apiRequest.mockResolvedValue({ data: { ok: true }, meta: { page: 2, limit: 20, total: 45, totalPages: 3 } });
});

const call = () => apiRequest.mock.calls.at(-1) as [string, Record<string, unknown>];

describe("catalog item pictures (manager)", () => {
  it("sends the id, the picture's path and its description when an item is created", async () => {
    const api = await import("@/lib/api/endpoints/catalog-api");
    const body = { id: ID, name: "Toyota", imagePath: `${tenant.id}/catalog/${ID}/a.png`, imageAlt: "Logo" };
    await api.createCatalogNodeApi(tenant.id, body);
    expect(call()[0]).toBe("/catalog/nodes");
    expect(call()[1]).toMatchObject({ method: "POST", json: body });
  });
  it("sends null to remove a picture and nothing about it when it is unchanged", async () => {
    const api = await import("@/lib/api/endpoints/catalog-api");
    await api.updateCatalogNodeApi(tenant.id, ID, { imagePath: null, imageAlt: null });
    expect(call()[1]).toMatchObject({ method: "PATCH", json: { imagePath: null, imageAlt: null } });
    await api.updateCatalogNodeApi(tenant.id, ID, { name: "Renamed" });
    expect((call()[1] as { json: Record<string, unknown> }).json).toEqual({ name: "Renamed" });
  });
});

describe("catalog endpoints (manager)", () => {
  it("sends each request to the route the API declares, for the verified organization", async () => {
    const api = await import("@/lib/api/endpoints/catalog-api");
    const cases: [() => Promise<unknown>, string, string, Record<string, unknown>?][] = [
      [() => api.getCatalogHierarchyApi(tenant.id), "/catalog/hierarchy", "GET"],
      [() => api.createCatalogHierarchyApi(tenant.id, { name: "Parts" }), "/catalog/hierarchy", "POST", { json: { name: "Parts" } }],
      [() => api.updateCatalogHierarchyApi(tenant.id, { status: "active" }), "/catalog/hierarchy", "PATCH", { json: { status: "active" } }],
      [() => api.listCatalogLevelsApi(tenant.id), "/catalog/levels", "GET"],
      [() => api.createCatalogLevelApi(tenant.id, { name: "Brand", canHoldProducts: false, position: 1 }), "/catalog/levels", "POST", { json: { name: "Brand", canHoldProducts: false, position: 1 } }],
      [() => api.reorderCatalogLevelsApi(tenant.id, [ID, ID2]), "/catalog/levels/reorder", "POST", { json: { levelIds: [ID, ID2] } }],
      [() => api.updateCatalogLevelApi(tenant.id, ID, { name: "Make" }), `/catalog/levels/${ID}`, "PATCH", { json: { name: "Make" } }],
      [() => api.deleteCatalogLevelApi(tenant.id, ID), `/catalog/levels/${ID}`, "DELETE"],
      [() => api.getCatalogTreeApi(tenant.id), "/catalog/tree", "GET"],
      [() => api.createCatalogNodeApi(tenant.id, { name: "Toyota", parentId: null }), "/catalog/nodes", "POST", { json: { name: "Toyota", parentId: null } }],
      [() => api.reorderCatalogNodesApi(tenant.id, { parentId: null, nodeIds: [ID] }), "/catalog/nodes/reorder", "POST", { json: { parentId: null, nodeIds: [ID] } }],
      [() => api.getCatalogNodeApi(tenant.id, ID), `/catalog/nodes/${ID}`, "GET"],
      [() => api.updateCatalogNodeApi(tenant.id, ID, { description: null }), `/catalog/nodes/${ID}`, "PATCH", { json: { description: null } }],
      [() => api.moveCatalogNodeApi(tenant.id, ID, { parentId: ID2 }), `/catalog/nodes/${ID}/move`, "POST", { json: { parentId: ID2 } }],
      [() => api.assignCatalogProductsApi(tenant.id, ID, [ID2]), `/catalog/nodes/${ID}/products`, "POST", { json: { productIds: [ID2] } }],
      [() => api.unassignCatalogProductsApi(tenant.id, ID, [ID2]), `/catalog/nodes/${ID}/products/unassign`, "POST", { json: { productIds: [ID2] } }],
      [() => api.reorderCatalogNodeProductsApi(tenant.id, ID, [ID2]), `/catalog/nodes/${ID}/products/reorder`, "POST", { json: { productIds: [ID2] } }],
      [() => api.bulkCatalogAssignmentApi(tenant.id, { action: "assign", nodeIds: [ID], productIds: [ID2] }), "/catalog/assignments/bulk", "POST", { json: { action: "assign", nodeIds: [ID], productIds: [ID2] } }],
      [() => api.getProductPlacementsApi(tenant.id, ID), `/catalog/products/${ID}/nodes`, "GET"],
      [() => api.setProductPlacementsApi(tenant.id, ID, [ID2]), `/catalog/products/${ID}/nodes`, "PUT", { json: { nodeIds: [ID2] } }],
      [() => api.importCatalogApi(tenant.id, { dryRun: true, rows: [{ row: 2, level_1: "A" }] }), "/catalog/import", "POST", { json: { dryRun: true, rows: [{ row: 2, level_1: "A" }] } }],
      [() => api.exportCatalogApi(tenant.id, { page: 2, limit: 1000 }), "/catalog/export", "GET", { query: { page: 2, limit: 1000 } }],
      [() => api.exportProductsApi(tenant.id, { page: 1, limit: 500, status: "active" }), "/products/export", "GET", { query: { page: 1, limit: 500, status: "active" } }],
    ];
    for (const [run, path, method, extra] of cases) {
      apiRequest.mockClear();
      await run();
      const [p, options] = call();
      expect([p, options.method ?? "GET"]).toEqual([path, method]);
      expect(options.organizationId).toBe(tenant.id);
      if (extra) expect(options).toMatchObject(extra);
    }
  });

  it("deletes an item with cascade only when asked, and lists items and products with the API's query names", async () => {
    const api = await import("@/lib/api/endpoints/catalog-api");
    await api.deleteCatalogNodeApi(tenant.id, ID, false);
    expect(call()[1].query).toEqual({ cascade: undefined });
    await api.deleteCatalogNodeApi(tenant.id, ID, true);
    expect(call()[1].query).toEqual({ cascade: true });
    const nodes = await api.listCatalogNodesApi(tenant.id, { page: 2, limit: 20, search: "gus", parentId: "root", levelId: ID, status: "active", sortBy: "name", sortOrder: "asc" });
    expect(call()[0]).toBe("/catalog/nodes");
    expect(call()[1].query).toEqual({ page: 2, limit: 20, search: "gus", parentId: "root", levelId: ID, status: "active", sortBy: "name", sortOrder: "asc" });
    expect(nodes).toMatchObject({ page: 2, pageSize: 20, total: 45, totalPages: 3 });
    const prods = await api.listCatalogNodeProductsApi(tenant.id, ID, { page: 1, limit: 20, includeDescendants: true });
    expect(call()[0]).toBe(`/catalog/nodes/${ID}/products`);
    expect(call()[1].query).toMatchObject({ includeDescendants: true });
    expect(prods.totalPages).toBe(3);
  });

  it("reads a list without paging details as one page", async () => {
    apiRequest.mockResolvedValue({ data: [{ id: "n" }], meta: undefined });
    const { listCatalogNodesApi } = await import("@/lib/api/endpoints/catalog-api");
    expect(await listCatalogNodesApi(tenant.id, { page: 1, limit: 20 })).toMatchObject({ total: 1, page: 1, pageSize: 20, totalPages: 1 });
  });
});

describe("catalog service: permissions come first", () => {
  it("needs catalog:view to read, catalog:manage to change and catalog:delete to delete", async () => {
    const s = await import("@/services/catalog.service");
    apiRequest.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } });
    const needs: [() => Promise<unknown>, string][] = [
      [() => s.getCatalogTree(), "catalog:view"],
      [() => s.listCatalogNodes({ page: 1, limit: 20 }), "catalog:view"],
      [() => s.getCatalogNode(ID), "catalog:view"],
      [() => s.listCatalogNodeProducts(ID, { page: 1, limit: 20 }), "catalog:view"],
      [() => s.getProductPlacements(ID), "catalog:view"],
      [() => s.searchProductsForCatalog({ search: "", page: 1, limit: 20 }), "catalog:view"],
      [() => s.exportCatalogPage(1, 1000), "catalog:view"],
      [() => s.exportProductsPage(1, 1000), "catalog:view"],
      [() => s.createCatalogHierarchy({ name: "x" }), "catalog:manage"],
      [() => s.updateCatalogHierarchy({ name: "y" }), "catalog:manage"],
      [() => s.createCatalogLevel({ name: "L" }), "catalog:manage"],
      [() => s.updateCatalogLevel(ID, { name: "L" }), "catalog:manage"],
      [() => s.reorderCatalogLevels([ID]), "catalog:manage"],
      [() => s.createCatalogNode({ name: "n" }), "catalog:manage"],
      [() => s.updateCatalogNode(ID, { name: "n" }), "catalog:manage"],
      [() => s.moveCatalogNode(ID, { parentId: null }), "catalog:manage"],
      [() => s.reorderCatalogNodes({ parentId: null, nodeIds: [ID] }), "catalog:manage"],
      [() => s.assignCatalogProducts(ID, [ID2]), "catalog:manage"],
      [() => s.unassignCatalogProducts(ID, [ID2]), "catalog:manage"],
      [() => s.reorderCatalogNodeProducts(ID, [ID2]), "catalog:manage"],
      [() => s.bulkCatalogAssignment({ action: "assign", nodeIds: [ID], productIds: [ID2] }), "catalog:manage"],
      [() => s.setProductPlacements(ID, [ID2]), "catalog:manage"],
      [() => s.importCatalogRows({ dryRun: true, rows: [{ row: 2, level_1: "A" }] }), "catalog:manage"],
      [() => s.deleteCatalogLevel(ID), "catalog:delete"],
      [() => s.deleteCatalogNode(ID, false), "catalog:delete"],
    ];
    for (const [run, permission] of needs) {
      requireActiveTenant.mockClear();
      await run();
      expect(requireActiveTenant).toHaveBeenCalledWith(permission);
    }
  });

  it("calls nothing when the member lacks the permission", async () => {
    requireActiveTenant.mockRejectedValueOnce(new AppError("FORBIDDEN", "You do not have permission to do that."));
    const s = await import("@/services/catalog.service");
    await expect(s.createCatalogNode({ name: "x" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it("treats a catalog that is not set up as empty, but never hides any other failure", async () => {
    const s = await import("@/services/catalog.service");
    apiRequest.mockRejectedValueOnce(new AppError("NOT_FOUND", "not set up", undefined, "CATALOG_HIERARCHY_NOT_FOUND"));
    expect(await s.getCatalogHierarchy()).toBeNull();
    apiRequest.mockRejectedValueOnce(new AppError("NOT_FOUND", "not set up", undefined, "CATALOG_HIERARCHY_NOT_FOUND"));
    expect(await s.getCatalogTree()).toEqual({ nodes: [], truncated: false });
    apiRequest.mockRejectedValueOnce(new AppError("NOT_FOUND", "some other thing", undefined, "STORE_NOT_FOUND"));
    await expect(s.getCatalogHierarchy()).rejects.toMatchObject({ apiCode: "STORE_NOT_FOUND" });
    apiRequest.mockRejectedValueOnce(new AppError("UNKNOWN", "boom"));
    await expect(s.getCatalogTree()).rejects.toMatchObject({ code: "UNKNOWN" });
  });

  it("never fails the product page or the menu editor because of the catalog", async () => {
    const s = await import("@/services/catalog.service");
    apiRequest.mockRejectedValue(new AppError("UNKNOWN", "down"));
    expect(await s.getCatalogForProduct(ID)).toBeNull();
    expect(await s.getCatalogLinkChoices()).toEqual([]);
  });

  it("offers the catalog and its top-level items as menu links only once the catalog is live", async () => {
    const s = await import("@/services/catalog.service");
    apiRequest.mockImplementation(async (path: string) => {
      if (path === "/catalog/hierarchy") return { data: { id: "h", name: "Parts", status: "active", levels: [], nodeCount: 2 } };
      return { data: [{ name: "Toyota", slug: "toyota" }], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } };
    });
    expect(await s.getCatalogLinkChoices()).toEqual([
      { label: "Catalog: Parts", url: "/catalog" },
      { label: "Catalog: Toyota", url: "/catalog/toyota" },
    ]);
    apiRequest.mockImplementation(async () => ({ data: { id: "h", name: "Parts", status: "draft", levels: [], nodeCount: 0 } }));
    expect(await s.getCatalogLinkChoices()).toEqual([]);
  });

  it("lists products for the pickers with their part number, and a missing part number as null", async () => {
    apiRequest.mockResolvedValue({ data: [{ id: ID, name: "Pad", sku: "S1", status: "active", priceMinor: 100, imagePath: null }], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } });
    const { searchProductsForCatalog } = await import("@/services/catalog.service");
    const page = await searchProductsForCatalog({ search: "pad", page: 1, limit: 20 });
    expect(page.items[0]).toEqual({ id: ID, name: "Pad", sku: "S1", partNumber: null, status: "active", priceMinor: 100, imagePath: null });
    expect(call()[1].query).toMatchObject({ search: "pad", sortBy: "name" });
  });
});

describe("public catalog endpoints", () => {
  it("reads anonymously, cached under the store's own tag, and encodes every segment on its own", async () => {
    const { getPublicCatalogNodeApi, getPublicCatalogTreeApi } = await import("@/lib/api/endpoints/public-catalog-api");
    await getPublicCatalogTreeApi("prj-motors", 1);
    expect(call()[0]).toBe("/public/storefronts/prj-motors/catalog/tree");
    expect(call()[1]).toMatchObject({ anonymous: true, cache: { tags: ["storefront:prj-motors"] }, query: { maxDepth: 1 } });
    await getPublicCatalogNodeApi("prj-motors", ["mahindra", "centuro", "a%2Fb"], { page: 2, limit: 24, sort: "price_asc", includeDescendants: true });
    expect(call()[0]).toBe("/public/storefronts/prj-motors/catalog/nodes/mahindra/centuro/a%252Fb");
    expect(call()[1]).toMatchObject({ anonymous: true, query: { page: 2, limit: 24, sort: "price_asc", includeDescendants: true } });
    expect(call()[1].organizationId).toBeUndefined();
    await getPublicCatalogNodeApi("prj-motors", ["x"], {});
    expect(call()[1].query).toMatchObject({ includeDescendants: undefined });
  });
});
