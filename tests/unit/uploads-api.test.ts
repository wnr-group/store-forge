import { beforeEach, describe, expect, it, vi } from "vitest";

/** Signed upload URLs come from the StoreForge API; the folder is never chosen by this app or the browser. */

const TENANT = "11111111-1111-4111-8111-111111111111";
const OWNER = "22222222-2222-4222-8222-222222222222";
const requireActiveTenant = vi.fn<(permission?: string) => Promise<{ tenant: { id: string } }>>(async () => ({ tenant: { id: TENANT } }));
vi.mock("@/lib/tenant/context", () => ({ requireActiveTenant: (p?: string) => requireActiveTenant(p) }));
const requestSigned = vi.fn();
vi.mock("@/lib/api/endpoints/upload-api", () => ({ requestSignedUploadsApi: (...a: unknown[]) => requestSigned(...a) }));

const file = { type: "image/png", size: 1024 };
const target = { path: `${TENANT}/${OWNER}/a.png`, token: "t", signedUrl: "https://x.supabase.co/storage/v1/object/upload/sign/products/a.png?token=t" };

beforeEach(() => {
  vi.clearAllMocks();
  requireActiveTenant.mockResolvedValue({ tenant: { id: TENANT } });
  requestSigned.mockResolvedValue([target]);
});

describe("requestUploadsAction", () => {
  it("asks the API with the verified organization and returns its targets unchanged", async () => {
    const { requestUploadsAction } = await import("@/app/(dashboard)/dashboard/uploads/actions");
    const res = await requestUploadsAction({ scope: "product", ownerId: OWNER, files: [file] });
    expect(requireActiveTenant).toHaveBeenCalledWith("catalog:manage");
    expect(requestSigned).toHaveBeenCalledWith(TENANT, { scope: "product", ownerId: OWNER, files: [file] });
    expect(res).toMatchObject({ ok: true, data: [target] });
  });

  it("needs store:manage for the store logo and sends no ownerId", async () => {
    const { requestUploadsAction } = await import("@/app/(dashboard)/dashboard/uploads/actions");
    await requestUploadsAction({ scope: "store", ownerId: OWNER, files: [file] });
    expect(requireActiveTenant).toHaveBeenCalledWith("store:manage");
    expect(requestSigned).toHaveBeenCalledWith(TENANT, { scope: "store", ownerId: undefined, files: [file] });
  });

  it("does not call the API when the role check fails or the input is invalid", async () => {
    const { requestUploadsAction } = await import("@/app/(dashboard)/dashboard/uploads/actions");
    requireActiveTenant.mockRejectedValueOnce(new Error("forbidden"));
    expect((await requestUploadsAction({ scope: "product", ownerId: OWNER, files: [file] })).ok).toBe(false);
    expect((await requestUploadsAction({ scope: "product", files: [file] })).ok).toBe(false);
    expect((await requestUploadsAction({ scope: "product", ownerId: OWNER, files: [{ type: "image/gif", size: 5 }] })).ok).toBe(false);
    expect(requestSigned).not.toHaveBeenCalled();
  });

  it("surfaces an API refusal as a failed result", async () => {
    const { requestUploadsAction } = await import("@/app/(dashboard)/dashboard/uploads/actions");
    requestSigned.mockRejectedValueOnce(new Error("api said no"));
    expect((await requestUploadsAction({ scope: "product", ownerId: OWNER, files: [file] })).ok).toBe(false);
  });
});
