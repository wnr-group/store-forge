import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

const tenant = { id: "11111111-1111-4111-8111-111111111111" };
const requireActiveTenant = vi.fn<(permission?: string) => Promise<{ tenant: typeof tenant; role: string }>>(async () => ({ tenant, role: "owner" }));
vi.mock("@/lib/tenant/context", () => ({ requireActiveTenant: (p?: string) => requireActiveTenant(p) }));
const apiRequest = vi.fn();
vi.mock("@/lib/api/client", () => ({ apiRequest: (...a: unknown[]) => apiRequest(...a) }));

import { importProducts } from "@/services/product-import.service";

beforeEach(() => { apiRequest.mockReset(); requireActiveTenant.mockClear(); });

describe("importProducts", () => {
  it("checks catalog:manage first and posts the rows with a 60 s timeout", async () => {
    apiRequest.mockResolvedValue({ data: { count: 2 } });
    await expect(importProducts([{ row: 2, name: "A", price: "1" }, { row: 3, name: "B", price: "1" }])).resolves.toEqual({ count: 2 });
    expect(requireActiveTenant).toHaveBeenCalledWith("catalog:manage");
    expect(apiRequest).toHaveBeenCalledWith("/products/import", expect.objectContaining({ method: "POST", organizationId: tenant.id, timeoutMs: 60_000, json: { rows: expect.any(Array) } }));
  });
  it("turns the API's PRODUCT_IMPORT_INVALID details into typed row details and drops anything unexpected", async () => {
    apiRequest.mockRejectedValue(new AppError("VALIDATION", "No products were imported.", undefined, undefined, { total: 1, errors: [{ row: 2, column: "price", message: "m", value: "0" }], secret: "internal" }));
    const err = await importProducts([{ row: 2, name: "A", price: "0" }]).catch((e) => e as AppError);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).details).toEqual({ kind: "rows", total: 1, errors: [{ row: 2, column: "price", message: "m", value: "0" }] });
  });
  it("passes other errors through unchanged", async () => {
    apiRequest.mockRejectedValue(new AppError("CONFLICT", "That SKU is already used."));
    await expect(importProducts([{ row: 2, name: "A", price: "1" }])).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
