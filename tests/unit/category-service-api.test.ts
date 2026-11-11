import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

/** `services/category.service.ts` in API mode: same return shapes, no database access, permission checked first. */

const tenant = { id: "11111111-1111-4111-8111-111111111111" };
const requireActiveTenant = vi.fn<(permission?: string) => Promise<{ tenant: typeof tenant; role: string }>>(async () => ({ tenant, role: "owner" }));
const withTenantDb = vi.fn(async () => {
  throw new Error("the database path must not be used in API mode");
});
vi.mock("@/lib/tenant/context", () => ({
  requireActiveTenant: (p?: string) => requireActiveTenant(p),
  withTenantDb: () => withTenantDb(),
}));

const api = {
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
};
vi.mock("@/lib/api/endpoints/category-api", () => ({
  listCategoriesApi: (...a: unknown[]) => api.list(...a),
  getCategoryApi: (...a: unknown[]) => api.get(...a),
  createCategoryApi: (...a: unknown[]) => api.create(...a),
  updateCategoryApi: (...a: unknown[]) => api.update(...a),
  deleteCategoryApi: (...a: unknown[]) => api.remove(...a),
}));

const wire = {
  id: "c1",
  name: "Shoes",
  slug: "shoes",
  description: null,
  parentId: null,
  parentName: null,
  productCount: 3,
  createdAt: "2026-01-02T03:04:05.000Z",
  updatedAt: "2026-01-03T03:04:05.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.AUTH_API_URL = "http://localhost:4000/api/v1";
  process.env.AUTH_BFF_SECRET = "s".repeat(40);
});

describe("category service in API mode", () => {
  it("lists with Date fields and the tenant id, for the verified active tenant", async () => {
    api.list.mockResolvedValue([wire]);
    const { listCategories } = await import("@/services/category.service");
    const rows = await listCategories();
    expect(api.list).toHaveBeenCalledWith(tenant.id);
    expect(rows[0]).toMatchObject({ id: "c1", tenantId: tenant.id, productCount: 3 });
    expect(rows[0].createdAt).toBeInstanceOf(Date);
    expect(withTenantDb).not.toHaveBeenCalled();
  });

  it("returns null when the API says the category does not exist", async () => {
    api.get.mockRejectedValue(new AppError("NOT_FOUND", "That category no longer exists."));
    const { getCategory } = await import("@/services/category.service");
    await expect(getCategory("c1")).resolves.toBeNull();
  });

  it("rethrows other errors from a read", async () => {
    api.get.mockRejectedValue(new AppError("FORBIDDEN", "nope"));
    const { getCategory } = await import("@/services/category.service");
    await expect(getCategory("c1")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it.each([
    ["create", "catalog:manage"],
    ["update", "catalog:manage"],
    ["delete", "catalog:delete"],
  ])("%s requires %s before calling the API", async (op, permission) => {
    requireActiveTenant.mockRejectedValueOnce(new AppError("FORBIDDEN", "You do not have permission to do that."));
    const svc = await import("@/services/category.service");
    const input = svc.normalize({ name: "Shoes" });
    const call = op === "create" ? svc.createCategory(input) : op === "update" ? svc.updateCategory("c1", input) : svc.deleteCategory("c1");
    await expect(call).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(requireActiveTenant).toHaveBeenCalledWith(permission);
    expect(api.create).not.toHaveBeenCalled();
    expect(api.update).not.toHaveBeenCalled();
    expect(api.remove).not.toHaveBeenCalled();
  });

  it("creates, updates and deletes through the API with the normalized input", async () => {
    api.create.mockResolvedValue(wire);
    const svc = await import("@/services/category.service");
    const input = svc.normalize({ name: "Shoes", parentId: null });
    await expect(svc.createCategory(input)).resolves.toEqual({ id: "c1" });
    await svc.updateCategory("c1", input);
    await svc.deleteCategory("c1");
    expect(api.create).toHaveBeenCalledWith(tenant.id, input);
    expect(api.update).toHaveBeenCalledWith(tenant.id, "c1", input);
    expect(api.remove).toHaveBeenCalledWith(tenant.id, "c1");
  });
});
