import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

/** Collections and customers in API mode: same return shapes, no database access, permission checked before the call. */

const tenant = { id: "11111111-1111-4111-8111-111111111111" };
const requireActiveTenant = vi.fn<(permission?: string) => Promise<{ tenant: typeof tenant; role: string }>>(async () => ({ tenant, role: "owner" }));
vi.mock("@/lib/tenant/context", () => ({
  requireActiveTenant: (p?: string) => requireActiveTenant(p),
  withTenantDb: () => {
    throw new Error("the database path must not be used in API mode");
  },
}));

const col = { list: vi.fn(), get: vi.fn(), options: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() };
vi.mock("@/lib/api/endpoints/collection-api", () => ({
  listCollectionsApi: (...a: unknown[]) => col.list(...a),
  getCollectionApi: (...a: unknown[]) => col.get(...a),
  listProductOptionsApi: (...a: unknown[]) => col.options(...a),
  createCollectionApi: (...a: unknown[]) => col.create(...a),
  updateCollectionApi: (...a: unknown[]) => col.update(...a),
  deleteCollectionApi: (...a: unknown[]) => col.remove(...a),
}));
const cus = { list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() };
vi.mock("@/lib/api/endpoints/customer-api", () => ({
  listCustomersApi: (...a: unknown[]) => cus.list(...a),
  getCustomerApi: (...a: unknown[]) => cus.get(...a),
  createCustomerApi: (...a: unknown[]) => cus.create(...a),
  updateCustomerApi: (...a: unknown[]) => cus.update(...a),
  deleteCustomerApi: (...a: unknown[]) => cus.remove(...a),
}));

const wireCollection = {
  id: "col1", name: "Summer", slug: "summer", description: null, status: "active", imagePath: null, productCount: 2,
  createdAt: "2026-01-02T03:04:05.000Z", updatedAt: "2026-01-03T03:04:05.000Z",
};
const wireCustomer = {
  id: "cu1", fullName: "Ada", email: "ada@example.com", phone: null, notes: null, orderCount: 2, totalSpentMinor: 5000,
  lastOrderAt: "2026-02-01T00:00:00.000Z", createdAt: "2026-01-02T03:04:05.000Z", updatedAt: "2026-01-03T03:04:05.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.API_BASE_URL = "http://localhost:4000/api/v1";
  process.env.AUTH_BFF_SECRET = "s".repeat(40);
});

describe("collections in API mode", () => {
  it("lists and gets with Dates, tenant id and ordered product ids", async () => {
    col.list.mockResolvedValue([wireCollection]);
    col.get.mockResolvedValue({ ...wireCollection, productIds: ["p2", "p1"] });
    const svc = await import("@/services/collection.service");
    const rows = await svc.listCollections();
    expect(rows[0]).toMatchObject({ id: "col1", tenantId: tenant.id, productCount: 2 });
    expect(rows[0].createdAt).toBeInstanceOf(Date);
    const one = await svc.getCollection("col1");
    expect(one?.productIds).toEqual(["p2", "p1"]);
    expect(one).not.toHaveProperty("orders");
  });

  it("returns null for a missing collection and rethrows other errors", async () => {
    const svc = await import("@/services/collection.service");
    col.get.mockRejectedValueOnce(new AppError("NOT_FOUND", "gone"));
    await expect(svc.getCollection("x")).resolves.toBeNull();
    col.get.mockRejectedValueOnce(new AppError("FORBIDDEN", "no"));
    await expect(svc.getCollection("x")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("sends the client-generated id on create and checks permissions first", async () => {
    col.create.mockResolvedValue({ ...wireCollection, productIds: [] });
    const svc = await import("@/services/collection.service");
    const input = { name: "Summer", description: null, status: "draft", imagePath: null, productIds: [] } as never;
    await expect(svc.createCollection("col1", input)).resolves.toEqual({ id: "col1" });
    expect(col.create).toHaveBeenCalledWith(tenant.id, { id: "col1", ...(input as object) });
    expect(requireActiveTenant).toHaveBeenCalledWith("catalog:manage");

    requireActiveTenant.mockRejectedValueOnce(new AppError("FORBIDDEN", "You do not have permission to do that."));
    await expect(svc.deleteCollection("col1")).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(col.remove).not.toHaveBeenCalled();
  });

  it("updates and deletes through the API", async () => {
    const svc = await import("@/services/collection.service");
    await svc.updateCollection("col1", { name: "S" } as never);
    await svc.deleteCollection("col1");
    expect(col.update).toHaveBeenCalledWith(tenant.id, "col1", { name: "S" });
    expect(col.remove).toHaveBeenCalledWith(tenant.id, "col1");
    expect(requireActiveTenant).toHaveBeenCalledWith("catalog:delete");
  });
});

describe("customers in API mode", () => {
  it("maps the list query and returns the page shape the UI expects", async () => {
    cus.list.mockResolvedValue({ items: [wireCustomer], meta: { page: 2, limit: 20, total: 41, totalPages: 3 } });
    const svc = await import("@/services/customer.service");
    const page = await svc.listCustomers({ q: "ad", sort: "created", dir: "desc", page: 2 });
    expect(cus.list).toHaveBeenCalledWith(tenant.id, { page: 2, limit: 20, search: "ad", sortBy: "createdAt", sortOrder: "desc" });
    expect(page).toMatchObject({ total: 41, page: 2, pageSize: 20 });
    expect(page.items[0].lastOrderAt).toBeInstanceOf(Date);
    expect(page.items[0].tenantId).toBe(tenant.id);
    expect(requireActiveTenant).toHaveBeenCalledWith("customers:view");
  });

  it("returns the customer with its order history as Dates, or null when missing", async () => {
    const svc = await import("@/services/customer.service");
    cus.get.mockResolvedValueOnce({
      ...wireCustomer,
      orders: [{ id: "o1", orderNumber: 7, status: "paid", currency: "INR", subtotalMinor: 100, totalMinor: 100, placedAt: "2026-02-01T00:00:00.000Z" }],
    });
    const found = await svc.getCustomer("cu1");
    expect(found?.customer.id).toBe("cu1");
    expect(found?.orders[0]).toMatchObject({ orderNumber: 7, customerId: "cu1", tenantId: tenant.id });
    expect(found?.orders[0].placedAt).toBeInstanceOf(Date);
    cus.get.mockRejectedValueOnce(new AppError("NOT_FOUND", "gone"));
    await expect(svc.getCustomer("nope")).resolves.toBeNull();
  });

  it("creates, updates and deletes with the right permissions", async () => {
    cus.create.mockResolvedValue(wireCustomer);
    const svc = await import("@/services/customer.service");
    const v = { fullName: "Ada", email: "ada@example.com", phone: null, notes: null };
    await expect(svc.createCustomer(v)).resolves.toEqual({ id: "cu1" });
    await svc.updateCustomer("cu1", v);
    await svc.deleteCustomer("cu1");
    expect(requireActiveTenant.mock.calls.map((c) => c[0])).toEqual(["customers:manage", "customers:manage", "customers:delete"]);
    expect(cus.update).toHaveBeenCalledWith(tenant.id, "cu1", v);
  });

  it("surfaces a duplicate e-mail conflict from the API unchanged", async () => {
    cus.create.mockRejectedValue(new AppError("CONFLICT", "A customer with this email already exists.", { email: "Already used." }));
    const svc = await import("@/services/customer.service");
    await expect(svc.createCustomer({ fullName: "A", email: "a@b.co", phone: null, notes: null })).rejects.toMatchObject({ code: "CONFLICT", fieldErrors: { email: "Already used." } });
  });
});
