import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

/** `getPublishedCatalogPage`: what the catalog route gets for each kind of address, and when it is "not found". */

const publicApi = {
  getStorefrontApi: vi.fn(),
  getPublicLayoutApi: vi.fn(),
  getPublicCollectionsApi: vi.fn(),
  getPublicCollectionApi: vi.fn(),
};
vi.mock("@/lib/api/endpoints/public-api", () => ({
  getStorefrontApi: (...a: unknown[]) => publicApi.getStorefrontApi(...a),
  getPublicLayoutApi: (...a: unknown[]) => publicApi.getPublicLayoutApi(...a),
  getPublicCollectionsApi: (...a: unknown[]) => publicApi.getPublicCollectionsApi(...a),
  getPublicCollectionApi: (...a: unknown[]) => publicApi.getPublicCollectionApi(...a),
  getPublicLayoutForApi: vi.fn(),
  getPublicPageApi: vi.fn(),
  getPublicPagesApi: vi.fn(),
  getPublicProductApi: vi.fn(),
}));
const catalogApi = { tree: vi.fn(), node: vi.fn() };
vi.mock("@/lib/api/endpoints/public-catalog-api", () => ({
  getPublicCatalogTreeApi: (...a: unknown[]) => catalogApi.tree(...a),
  getPublicCatalogNodeApi: (...a: unknown[]) => catalogApi.node(...a),
}));

const store = { name: "PRJ", slug: "prj", publicId: "x", description: null, logoPath: null, currency: "INR", products: [], template: null };
const levels = [
  { id: "L1", name: "Brand", position: 1, canHoldProducts: false },
  { id: "L2", name: "Part group", position: 2, canHoldProducts: true },
];
const tree = { store: { name: "PRJ", slug: "prj", currency: "INR" }, hierarchy: { id: "h", name: "Parts" }, levels, nodes: [{ id: "n1", parentId: null, levelId: "L1", name: "Mahindra", slug: "mahindra", path: "mahindra", description: null, position: 0, depth: 1, hasChildren: true, productCount: 0 }], truncated: false };
const nodePage = {
  store: tree.store,
  hierarchy: tree.hierarchy,
  node: { ...tree.nodes[0], level: levels[0] },
  breadcrumbs: [],
  children: [],
  products: { items: [], page: 1, limit: 24, total: 0, includeDescendants: false },
};

beforeEach(() => {
  vi.clearAllMocks();
  publicApi.getStorefrontApi.mockResolvedValue(store);
  // No published design: the frame falls back to the engine's defaults, and the catalog still works.
  publicApi.getPublicLayoutApi.mockResolvedValue({ source: null, template: null, theme: null, groups: {} });
  publicApi.getPublicCollectionsApi.mockResolvedValue([]);
  catalogApi.tree.mockResolvedValue(tree);
  catalogApi.node.mockResolvedValue(nodePage);
});

const load = async (path: string, page = 1, sort: "position" | "name" = "position", all = false) => {
  const { getPublishedCatalogPage } = await import("@/services/storefront.service");
  return getPublishedCatalogPage("prj", path, page, sort, all);
};

describe("getPublishedCatalogPage", () => {
  it("shows the top of the catalog from one small read, with the engine's default frame when no design is published", async () => {
    const page = await load("");
    expect(page?.data).toMatchObject({ view: "root", hierarchyName: "Parts", childLevelName: "Brand" });
    expect(page?.frame).toEqual({ layout: { theme: null, groups: {} }, collections: [] });
    expect(catalogApi.tree).toHaveBeenCalledWith("prj", 1);
    expect(catalogApi.node).not.toHaveBeenCalled();
  });

  it("shows an item with the page, sort and include-all choices passed to the API, and names the next level from the tree", async () => {
    catalogApi.node.mockResolvedValue({ ...nodePage, children: [{ ...tree.nodes[0], id: "c", name: "Brakes", slug: "brakes", path: "mahindra/brakes" }] });
    const page = await load("mahindra", 3, "name", true);
    expect(catalogApi.node).toHaveBeenCalledWith("prj", ["mahindra"], { page: 3, limit: 24, sort: "name", includeDescendants: true });
    expect(page?.data).toMatchObject({ view: "node", childLevelName: "Part group", query: { page: 3, sort: "name", all: true } });
  });

  it("is not found for an address that cannot be an item, without calling the API", async () => {
    for (const path of ["a/../b", "A B", "a//b", "x".repeat(81)]) expect(await load(path)).toBeNull();
    expect(catalogApi.tree).not.toHaveBeenCalled();
  });

  it("is not found for an unknown store, a store with no published catalog, and an item that is not public", async () => {
    publicApi.getStorefrontApi.mockRejectedValue(new AppError("NOT_FOUND", "no store"));
    expect(await load("")).toBeNull();
    publicApi.getStorefrontApi.mockResolvedValue(store);
    catalogApi.tree.mockResolvedValue({ ...tree, hierarchy: null, levels: [], nodes: [] });
    expect(await load("")).toBeNull();
    expect(await load("mahindra")).toBeNull();
    catalogApi.tree.mockResolvedValue(tree);
    catalogApi.node.mockRejectedValue(new AppError("NOT_FOUND", "no item"));
    expect(await load("mahindra/draft")).toBeNull();
  });

  it("does not hide a real failure behind a not-found page", async () => {
    catalogApi.node.mockRejectedValue(new AppError("UNKNOWN", "Something went wrong."));
    await expect(load("mahindra")).rejects.toMatchObject({ code: "UNKNOWN" });
    catalogApi.tree.mockRejectedValue(new AppError("UNKNOWN", "Something went wrong."));
    await expect(load("")).rejects.toMatchObject({ code: "UNKNOWN" });
  });
});
