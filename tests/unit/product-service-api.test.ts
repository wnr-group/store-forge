import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

/** Products in API mode: same return shapes, the form values reach the API unchanged, no database path. */

const tenant = { id: "11111111-1111-4111-8111-111111111111" };
const requireActiveTenant = vi.fn<(permission?: string) => Promise<{ tenant: typeof tenant; role: string }>>(async () => ({ tenant, role: "owner" }));
vi.mock("@/lib/tenant/context", () => ({
  requireActiveTenant: (p?: string) => requireActiveTenant(p),
  withTenantDb: () => {
    throw new Error("the database path must not be used in API mode");
  },
}));

const api = { list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), del: vi.fn(), status: vi.fn(), dup: vi.fn() };
vi.mock("@/lib/api/endpoints/product-api", () => ({
  listProductsApi: (...a: unknown[]) => api.list(...a),
  getProductApi: (...a: unknown[]) => api.get(...a),
  createProductApi: (...a: unknown[]) => api.create(...a),
  updateProductApi: (...a: unknown[]) => api.update(...a),
  bulkDeleteProductsApi: (...a: unknown[]) => api.del(...a),
  bulkProductStatusApi: (...a: unknown[]) => api.status(...a),
  duplicateProductApi: (...a: unknown[]) => api.dup(...a),
}));

const PID = "22222222-2222-4222-8222-222222222222";
const detail = {
  id: PID, name: "Tee", slug: "tee", description: null, shortDescription: null, productType: null, categoryId: null, sku: null,
  priceMinor: 129900, compareAtPriceMinor: null, costMinor: null, hasVariants: true, trackInventory: true, quantity: 0, lowStockThreshold: 5,
  status: "active", createdAt: "2026-01-02T03:04:05.000Z", updatedAt: "2026-01-03T03:04:05.000Z",
  options: [{ id: "op1", name: "Size", position: 0, values: ["S", "M"] }],
  variants: [{ id: "v1", title: "S", options: { Size: "S" }, sku: null, priceMinor: 129900, compareAtPriceMinor: null, quantity: 4, imageId: null, isActive: true, position: 0 }],
  images: [{ id: "i1", storagePath: "t/p/a.png", altText: null, position: 0, isPrimary: true, mimeType: "image/png", sizeBytes: 10 }],
  collectionIds: ["c1"],
};
const values = {
  id: PID, name: "Tee", description: null, shortDescription: null, productType: null, categoryId: null, collectionIds: [], sku: null,
  price: "1299.00", compareAtPrice: null, cost: null, trackInventory: true, quantity: 0, lowStockThreshold: 5, status: "active",
  options: [{ name: "Size", values: ["S"] }],
  variants: [{ options: { Size: "S" }, sku: null, price: "1299.00", compareAtPrice: null, quantity: 4, isActive: true }],
  images: [],
} as never;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.AUTH_API_URL = "http://localhost:4000/api/v1";
  process.env.AUTH_BFF_SECRET = "s".repeat(40);
});

describe("products in API mode", () => {
  it("maps the list query (sort names, page size) and returns Dates", async () => {
    api.list.mockResolvedValue({
      items: [{ id: PID, name: "Tee", slug: "tee", sku: null, status: "active", priceMinor: 1, hasVariants: false, variantCount: 0, trackInventory: true, stock: 3, lowStockThreshold: 5, categoryName: null, imagePath: null, updatedAt: "2026-01-03T00:00:00.000Z", createdAt: "2026-01-02T00:00:00.000Z" }],
      meta: { page: 2, limit: 20, total: 21, totalPages: 2 },
    });
    const { listProducts } = await import("@/services/product.service");
    const page = await listProducts({ q: "tee", status: "all", category: "none", stock: "low", sort: "price", dir: "asc", page: 2 });
    expect(api.list).toHaveBeenCalledWith(tenant.id, { page: 2, limit: 20, search: "tee", status: "all", category: "none", stock: "low", sortBy: "price", sortOrder: "asc" });
    expect(page).toMatchObject({ total: 21, page: 2, pageSize: 20 });
    expect(page.items[0].createdAt).toBeInstanceOf(Date);
  });

  it("rebuilds the detail shape the product form reads", async () => {
    api.get.mockResolvedValue(detail);
    const { getProduct } = await import("@/services/product.service");
    const d = await getProduct(PID);
    expect(d?.product).toMatchObject({ id: PID, tenantId: tenant.id, priceMinor: 129900 });
    expect(d?.product).not.toHaveProperty("variants");
    expect(d?.options[0]).toMatchObject({ name: "Size", productId: PID, tenantId: tenant.id });
    expect(d?.variants[0]).toMatchObject({ id: "v1", quantity: 4, imageId: null });
    expect(d?.images[0]).toMatchObject({ storagePath: "t/p/a.png", isPrimary: true });
    expect(d?.collectionIds).toEqual(["c1"]);
    expect(d?.product.createdAt).toBeInstanceOf(Date);
  });

  it("returns null for a missing product", async () => {
    api.get.mockRejectedValue(new AppError("NOT_FOUND", "gone"));
    const { getProduct } = await import("@/services/product.service");
    await expect(getProduct(PID)).resolves.toBeNull();
  });

  it("creates with the form values as they are and updates without the id in the body", async () => {
    api.create.mockResolvedValue(detail);
    const { createProduct, updateProduct } = await import("@/services/product.service");
    await expect(createProduct(values)).resolves.toEqual({ id: PID });
    expect(api.create).toHaveBeenCalledWith(tenant.id, values);
    await expect(updateProduct(values)).resolves.toEqual({ id: PID });
    const [org, id, body] = api.update.mock.calls[0];
    expect([org, id]).toEqual([tenant.id, PID]);
    expect(body).not.toHaveProperty("id");
    expect(body).toMatchObject({ name: "Tee", price: "1299.00" });
    expect(requireActiveTenant).toHaveBeenCalledWith("catalog:manage");
  });

  it("still rejects an inconsistent variant before calling the API", async () => {
    const { createProduct } = await import("@/services/product.service");
    const bad = { ...(values as object), variants: [{ options: { Size: "XL" }, price: "1", quantity: 1, isActive: true }] } as never;
    await expect(createProduct(bad)).rejects.toMatchObject({ code: "VALIDATION" });
    expect(api.create).not.toHaveBeenCalled();
  });

  it("bulk delete / status / duplicate use the right permissions and return counts", async () => {
    api.del.mockResolvedValue(2);
    api.status.mockResolvedValue(3);
    api.dup.mockResolvedValue({ ...detail, id: "copy" });
    const svc = await import("@/services/product.service");
    await expect(svc.deleteProducts([PID, "x"])).resolves.toBe(2);
    await expect(svc.setProductsStatus([PID], "archived" as never)).resolves.toBe(3);
    await expect(svc.duplicateProduct(PID)).resolves.toEqual({ id: "copy" });
    expect(requireActiveTenant.mock.calls.map((c) => c[0])).toEqual(["catalog:delete", "catalog:manage", "catalog:manage"]);
    expect(api.status).toHaveBeenCalledWith(tenant.id, [PID], "archived");
  });

  it("refuses a bulk delete without permission before calling the API", async () => {
    requireActiveTenant.mockRejectedValueOnce(new AppError("FORBIDDEN", "You do not have permission to do that."));
    const { deleteProducts } = await import("@/services/product.service");
    await expect(deleteProducts([PID])).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(api.del).not.toHaveBeenCalled();
  });
});
