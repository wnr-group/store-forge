import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

/** Inventory and analytics in API mode: same shapes, no database path, permission before the stock change. */

const tenant = { id: "11111111-1111-4111-8111-111111111111" };
const requireActiveTenant = vi.fn<(permission?: string) => Promise<{ tenant: typeof tenant; role: string }>>(async () => ({ tenant, role: "owner" }));
vi.mock("@/lib/tenant/context", () => ({
  requireActiveTenant: (p?: string) => requireActiveTenant(p),
  withTenantDb: () => {
    throw new Error("the database path must not be used in API mode");
  },
}));

const inv = { list: vi.fn(), adjustments: vi.fn(), adjust: vi.fn() };
vi.mock("@/lib/api/endpoints/inventory-api", () => ({
  listInventoryApi: (...a: unknown[]) => inv.list(...a),
  listAdjustmentsApi: (...a: unknown[]) => inv.adjustments(...a),
  adjustStockApi: (...a: unknown[]) => inv.adjust(...a),
}));
const getAnalyticsApi = vi.fn();
vi.mock("@/lib/api/endpoints/analytics-api", () => ({ getAnalyticsApi: (...a: unknown[]) => getAnalyticsApi(...a) }));

beforeEach(() => {
  vi.clearAllMocks();
  process.env.API_BASE_URL = "http://localhost:4000/api/v1";
  process.env.AUTH_BFF_SECRET = "s".repeat(40);
});

describe("inventory in API mode", () => {
  it("passes filters through and returns the page shape", async () => {
    const row = { productId: "p1", variantId: null, productName: "Tee", variantTitle: null, sku: "T", quantity: 0, tracked: true, threshold: 5, state: "out" };
    inv.list.mockResolvedValue({ items: [row], meta: { page: 3, limit: 20, total: 41, totalPages: 3 } });
    const { listInventory } = await import("@/services/inventory.service");
    const page = await listInventory({ q: "tee", stock: "out", page: 3 });
    expect(inv.list).toHaveBeenCalledWith(tenant.id, { page: 3, limit: 20, search: "tee", stock: "out" });
    expect(page).toEqual({ items: [row], total: 41, page: 3, pageSize: 20 });
  });

  it("returns ledger rows with Dates and the tenant id", async () => {
    inv.adjustments.mockResolvedValue([
      { id: "a1", productId: "p1", variantId: null, productName: "Tee", variantTitle: null, delta: -2, quantityAfter: 3, reason: "damaged", note: null, createdBy: "u1", createdAt: "2026-03-01T00:00:00.000Z" },
    ]);
    const { listAdjustments } = await import("@/services/inventory.service");
    const rows = await listAdjustments(15);
    expect(inv.adjustments).toHaveBeenCalledWith(tenant.id, 15);
    expect(rows[0]).toMatchObject({ tenantId: tenant.id, delta: -2, productName: "Tee" });
    expect(rows[0].createdAt).toBeInstanceOf(Date);
  });

  it("requires catalog:manage before adjusting, and surfaces API validation errors", async () => {
    const { adjustStock } = await import("@/services/inventory.service");
    const input = { productId: "p1", variantId: null, mode: "add", value: -9, reason: "damaged" } as never;
    requireActiveTenant.mockRejectedValueOnce(new AppError("FORBIDDEN", "You do not have permission to do that."));
    await expect(adjustStock(input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(inv.adjust).not.toHaveBeenCalled();

    inv.adjust.mockRejectedValueOnce(new AppError("VALIDATION", "Stock cannot go below zero (currently 3).", { value: "Would make stock negative" }));
    await expect(adjustStock(input)).rejects.toMatchObject({ code: "VALIDATION", fieldErrors: { value: "Would make stock negative" } });
    expect(requireActiveTenant).toHaveBeenLastCalledWith("catalog:manage");

    inv.adjust.mockResolvedValueOnce({ quantity: 12 });
    await expect(adjustStock(input)).resolves.toEqual({ quantity: 12 });
  });
});

describe("analytics in API mode", () => {
  it("returns the API's figures untouched, with Dates for recent orders", async () => {
    getAnalyticsApi.mockResolvedValue({
      range: 30, hasOrders: true, totalSalesMinor: 12345, previousSalesMinor: 100, orders: 4, customers: 2, averageOrderMinor: 3086,
      series: [{ day: "2026-03-01", salesMinor: 1, orders: 1 }], bestSellers: [{ name: "Tee", units: 2, salesMinor: 10 }],
      recentOrders: [{ id: "o1", orderNumber: 1, status: "paid", totalMinor: 5, placedAt: "2026-03-01T10:00:00.000Z", customerName: null }],
      lowStock: [], currency: "INR", timezone: "Asia/Kolkata",
    });
    const { getAnalytics } = await import("@/services/analytics.service");
    const data = await getAnalytics(7);
    expect(getAnalyticsApi).toHaveBeenCalledWith(tenant.id, 7);
    expect(data).toMatchObject({ range: 7, totalSalesMinor: 12345, previousSalesMinor: 100, averageOrderMinor: 3086 });
    expect(data.recentOrders[0].placedAt).toBeInstanceOf(Date);
    expect(data.series).toHaveLength(1);
  });
});
