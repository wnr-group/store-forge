import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

/** payment.service: the permission is checked first, the API gets the verified organization, nothing secret comes back. */

const tenant = { id: "11111111-1111-4111-8111-111111111111" };
const SECRET = `SYNTH${"a1b2c3d4e5f6a7b8c9d0".slice(0, 16)}`;
const KEY_ID = "rzp_test_AbCdEfGh12345678";

const requireActiveTenant = vi.fn<(permission?: string) => Promise<{ tenant: typeof tenant; role: string }>>(async () => ({ tenant, role: "owner" }));
vi.mock("@/lib/tenant/context", () => ({ requireActiveTenant: (p?: string) => requireActiveTenant(p) }));

const api = { get: vi.fn(), save: vi.fn(), remove: vi.fn() };
vi.mock("@/lib/api/endpoints/payment-api", () => ({
  getPaymentConfigApi: (...a: unknown[]) => api.get(...a),
  savePaymentConfigApi: (...a: unknown[]) => api.save(...a),
  removePaymentConfigApi: (...a: unknown[]) => api.remove(...a),
}));

const configured = { configured: true, keyIdMasked: "rzp_test_••••5678", mode: "test", updatedAt: "2026-11-19T12:45:00.000Z", updatedByName: "Alice" };

beforeEach(() => {
  // mockReset drops implementations too, so a rejection set by one test never leaks into the next.
  for (const fn of [requireActiveTenant, api.get, api.save, api.remove]) fn.mockReset();
  requireActiveTenant.mockResolvedValue({ tenant, role: "owner" });
});

describe("payment service [layer:FE]", () => {
  it("AC-FE-04: the payments:manage check runs before any API call, for every operation", async () => {
    const { getPaymentConfig, removePaymentConfig, savePaymentConfig } = await import("@/services/payment.service");
    const order: string[] = [];
    requireActiveTenant.mockImplementation(async (p) => {
      order.push(`check:${p}`);
      return { tenant, role: "owner" };
    });
    api.get.mockImplementation(async () => (order.push("api:get"), { configured: false }));
    api.save.mockImplementation(async () => (order.push("api:save"), configured));
    api.remove.mockImplementation(async () => void order.push("api:remove"));
    await getPaymentConfig();
    await savePaymentConfig({ keyId: KEY_ID, keySecret: SECRET });
    await removePaymentConfig();
    expect(order).toEqual(["check:payments:manage", "api:get", "check:payments:manage", "api:save", "check:payments:manage", "api:remove"]);
  });

  it("AC-FE-04: a non-owner gets zero API calls", async () => {
    const { getPaymentConfig, removePaymentConfig, savePaymentConfig } = await import("@/services/payment.service");
    requireActiveTenant.mockRejectedValue(new AppError("FORBIDDEN", "You do not have permission to do that."));
    await expect(getPaymentConfig()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(savePaymentConfig({ keyId: KEY_ID, keySecret: SECRET })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(removePaymentConfig()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(api.get).not.toHaveBeenCalled();
    expect(api.save).not.toHaveBeenCalled();
    expect(api.remove).not.toHaveBeenCalled();
  });

  it("sends the verified active organization to every call, never one from the input", async () => {
    const { getPaymentConfig, removePaymentConfig, savePaymentConfig } = await import("@/services/payment.service");
    api.get.mockResolvedValue({ configured: false });
    api.save.mockResolvedValue(configured);
    await getPaymentConfig();
    await savePaymentConfig({ keyId: KEY_ID, keySecret: SECRET });
    await removePaymentConfig();
    expect(api.get).toHaveBeenCalledWith(tenant.id);
    expect(api.save).toHaveBeenCalledWith(tenant.id, { keyId: KEY_ID, keySecret: SECRET });
    expect(api.remove).toHaveBeenCalledWith(tenant.id);
  });

  it("validates before the API: an invalid pair, an unknown field and a tenant id never leave the server", async () => {
    const { savePaymentConfig } = await import("@/services/payment.service");
    await expect(savePaymentConfig({ keyId: "nope", keySecret: SECRET })).rejects.toMatchObject({ code: "VALIDATION", fieldErrors: { keyId: expect.any(String) } });
    await expect(savePaymentConfig({ keyId: KEY_ID, keySecret: "short" })).rejects.toMatchObject({ code: "VALIDATION", fieldErrors: { keySecret: expect.any(String) } });
    await expect(savePaymentConfig({ keyId: KEY_ID, keySecret: SECRET, tenantId: tenant.id })).rejects.toMatchObject({ code: "VALIDATION" });
    expect(api.save).not.toHaveBeenCalled();
  });

  it("AC-FE-09: PAYMENTS_UNAVAILABLE becomes the exact Owner message", async () => {
    const { PAYMENTS_UNAVAILABLE_MESSAGE, getPaymentConfig, removePaymentConfig, savePaymentConfig } = await import("@/services/payment.service");
    expect(PAYMENTS_UNAVAILABLE_MESSAGE).toBe("Payment settings are temporarily unavailable. Please contact support.");
    const unavailable = () => new AppError("UNKNOWN", "Something went wrong. Please try again.", undefined, "PAYMENTS_UNAVAILABLE");
    api.save.mockRejectedValue(unavailable());
    api.get.mockRejectedValue(unavailable());
    api.remove.mockRejectedValue(unavailable());
    for (const call of [() => savePaymentConfig({ keyId: KEY_ID, keySecret: SECRET }), getPaymentConfig, removePaymentConfig])
      await expect(call()).rejects.toMatchObject({ code: "UNKNOWN", message: PAYMENTS_UNAVAILABLE_MESSAGE });
  });

  it("other API errors pass through unchanged (rate limit, generic failure)", async () => {
    const { savePaymentConfig } = await import("@/services/payment.service");
    const limited = new AppError("RATE_LIMITED", "Too many requests. Please wait a moment and try again.");
    api.save.mockRejectedValue(limited);
    await expect(savePaymentConfig({ keyId: KEY_ID, keySecret: SECRET })).rejects.toBe(limited);
  });

  it("AC-FE-10: the result carries the safe status only, never the submitted secret", async () => {
    const { savePaymentConfig } = await import("@/services/payment.service");
    api.save.mockResolvedValue(configured);
    const result = await savePaymentConfig({ keyId: KEY_ID, keySecret: SECRET });
    expect(result).toEqual({ configured: true, keyIdMasked: "rzp_test_••••5678", mode: "test", updatedAt: new Date("2026-11-19T12:45:00.000Z"), updatedByName: "Alice" });
    expect(JSON.stringify(result)).not.toContain(SECRET);
  });

  it("removing when nothing is saved succeeds (idempotent)", async () => {
    const { removePaymentConfig } = await import("@/services/payment.service");
    api.remove.mockResolvedValue(undefined);
    await expect(removePaymentConfig()).resolves.toBeUndefined();
    await expect(removePaymentConfig()).resolves.toBeUndefined();
    expect(api.remove).toHaveBeenCalledTimes(2);
  });
});
