import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

/** Product presentation in API mode: the five endpoints, the service layer, the server actions and cache invalidation. */

const tenant = { id: "11111111-1111-4111-8111-111111111111" };
const requireActiveTenant = vi.fn<(permission?: string) => Promise<{ tenant: typeof tenant; role: string }>>(async () => ({ tenant, role: "owner" }));
const getActiveStore = vi.fn(async () => ({ slug: "acme" }));
vi.mock("@/lib/tenant/context", () => ({ requireActiveTenant: (p?: string) => requireActiveTenant(p), getActiveStore: () => getActiveStore() }));

const apiRequest = vi.fn();
vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
  return { ...actual, apiRequest: (...a: unknown[]) => apiRequest(...a) };
});

const productApi = { list: vi.fn(), get: vi.fn() };
vi.mock("@/lib/api/endpoints/product-api", () => ({ listProductsApi: (...a: unknown[]) => productApi.list(...a), getProductApi: (...a: unknown[]) => productApi.get(...a) }));
const publicProduct = vi.fn();
vi.mock("@/lib/api/endpoints/public-api", () => ({ getPublicProductApi: (...a: unknown[]) => publicProduct(...a) }));
vi.mock("@/lib/api/endpoints/store-api", () => ({ getStoreApi: async () => ({ slug: "acme", name: "Acme" }) }));

const updateTag = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: (...a: unknown[]) => updateTag(...a) }));
const invalidateStorefront = vi.fn(async () => undefined);
vi.mock("@/lib/storefront/cache", () => ({ invalidateStorefront: () => invalidateStorefront(), storefrontCache: () => ({ tags: [], revalidate: 1 }) }));
vi.mock("@/services/theme.service", () => ({ publishTheme: vi.fn() }));

const PID = "22222222-2222-4222-8222-222222222222";
const detail = (over: Record<string, unknown> = {}) => ({ productId: PID, revision: 1, publicationState: "draft", document: { schemaVersion: 1 }, publishedDocument: null, publishedAt: null, updatedAt: "2026-01-01T00:00:00.000Z", ...over });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.API_BASE_URL = "http://localhost:4000/api/v1";
  process.env.AUTH_BFF_SECRET = "s".repeat(40);
});

describe("the five product-presentation endpoints", () => {
  it("calls each path, method and body of the API contract", async () => {
    const api = await import("@/lib/api/endpoints/presentation-api");
    apiRequest.mockResolvedValue({ data: detail(), meta: { page: 1, limit: 100, total: 1, totalPages: 1 } });

    await api.listPresentationsApi(tenant.id, { page: 2, limit: 100 });
    expect(apiRequest).toHaveBeenLastCalledWith("/store/product-presentations", { organizationId: tenant.id, query: { page: 2, limit: 100 } });

    await api.getPresentationApi(tenant.id, PID);
    expect(apiRequest).toHaveBeenLastCalledWith(`/store/product-presentations/${PID}`, { organizationId: tenant.id });

    await api.savePresentationDraftApi(tenant.id, PID, { schemaVersion: 1, gallery: { layout: "stacked" } }, 0);
    expect(apiRequest).toHaveBeenLastCalledWith(`/store/product-presentations/${PID}/draft`, { method: "PUT", json: { document: { schemaVersion: 1, gallery: { layout: "stacked" } }, expectedRevision: 0 }, organizationId: tenant.id });

    await api.publishPresentationApi(tenant.id, PID, 3);
    expect(apiRequest).toHaveBeenLastCalledWith(`/store/product-presentations/${PID}/publish`, { method: "POST", json: { expectedRevision: 3 }, organizationId: tenant.id });
    await api.publishPresentationApi(tenant.id, PID);
    expect(apiRequest).toHaveBeenLastCalledWith(`/store/product-presentations/${PID}/publish`, { method: "POST", json: {}, organizationId: tenant.id });

    await api.resetPresentationApi(tenant.id, PID);
    expect(apiRequest).toHaveBeenLastCalledWith(`/store/product-presentations/${PID}`, { method: "DELETE", organizationId: tenant.id });
  });

  it("a list without paging meta still yields one page", async () => {
    const api = await import("@/lib/api/endpoints/presentation-api");
    apiRequest.mockResolvedValue({ data: [{ productId: PID }] });
    expect((await api.listPresentationsApi(tenant.id, { page: 1, limit: 100 })).meta).toEqual({ page: 1, limit: 100, total: 1, totalPages: 1 });
  });
});

describe("API errors reach the editor in the shape it handles", () => {
  it("a revision conflict is a CONFLICT with its message", async () => {
    const { toAppError } = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
    const e = toAppError(409, { success: false, message: "Someone else changed this product design. Reload to see their changes before saving.", error: { code: "PRESENTATION_REVISION_CONFLICT", details: { revision: "Current revision is 4." } } });
    expect(e.code).toBe("CONFLICT");
    expect(e.message).toContain("Someone else changed");
  });
  it("document problems come back as field errors keyed by product id", async () => {
    const { toAppError } = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
    const e = toAppError(400, { success: false, message: "These product settings have problems that must be fixed first.", error: { code: "PRESENTATION_DOCUMENT_INVALID", details: { [`productPresentation.${PID}.gallery.layout`]: "Layout must be one of: thumbnails, stacked." } } });
    expect(e.code).toBe("VALIDATION");
    expect(e.fieldErrors).toEqual({ [`productPresentation.${PID}.gallery.layout`]: "Layout must be one of: thumbnails, stacked." });
  });
});

describe("presentation service", () => {
  it("reading needs design:view; saving a draft needs design:edit; publishing and resetting need design:publish", async () => {
    const svc = await import("@/services/presentation.service");
    apiRequest.mockResolvedValueOnce({ data: detail() }).mockResolvedValueOnce({ data: [], meta: { page: 1, limit: 100, total: 0, totalPages: 1 } });
    await svc.getPresentation(PID);
    await svc.listPresentations();
    expect(requireActiveTenant.mock.calls.map((c) => c[0])).toEqual(["design:view", "design:view"]);
    requireActiveTenant.mockClear();
    await svc.savePresentationDraft(PID, { schemaVersion: 1 }, 0);
    await svc.publishPresentation(PID, 1);
    await svc.resetPresentation(PID);
    expect(requireActiveTenant.mock.calls.map((c) => c[0])).toEqual(["design:edit", "design:publish", "design:publish"]);
  });

  it("a permission failure stops before any call to the API", async () => {
    const svc = await import("@/services/presentation.service");
    requireActiveTenant.mockRejectedValueOnce(new AppError("FORBIDDEN", "no"));
    await expect(svc.savePresentationDraft(PID, { schemaVersion: 1 }, 0)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it("lists every page of customized products", async () => {
    const svc = await import("@/services/presentation.service");
    apiRequest
      .mockResolvedValueOnce({ data: [{ productId: "a" }], meta: { page: 1, limit: 100, total: 101, totalPages: 2 } })
      .mockResolvedValueOnce({ data: [{ productId: "b" }], meta: { page: 2, limit: 100, total: 101, totalPages: 2 } });
    expect((await svc.listPresentations()).items.map((r) => r.productId)).toEqual(["a", "b"]);
    expect(apiRequest).toHaveBeenCalledTimes(2);
  });

  it("the picker reads the existing admin product list: active products only, mapped to what the picker shows", async () => {
    const svc = await import("@/services/presentation.service");
    productApi.list.mockResolvedValue({ items: [{ id: PID, name: "Tee", slug: "tee", imagePath: "t/p/a.webp", sku: "x", status: "active" }], meta: { page: 2, limit: 20, total: 41, totalPages: 3 } });
    const result = await svc.listPickerProducts({ page: 2, search: "te" });
    expect(productApi.list).toHaveBeenCalledWith(tenant.id, { page: 2, limit: 20, search: "te", status: "active", sortBy: "createdAt", sortOrder: "desc" });
    expect(result).toEqual({ items: [{ id: PID, name: "Tee", slug: "tee", imagePath: "t/p/a.webp" }], page: 2, totalPages: 3, total: 41 });
  });
});

const publicData = (over: Record<string, unknown> = {}) => ({
  store: { name: "Acme", slug: "acme", description: null, logo_path: null, currency: "INR" },
  product: { name: "Tee", slug: "tee", description: null, short_description: null, product_type: null, sku: null, price_minor: 100, compare_at_price_minor: null, has_variants: false, category_name: null },
  images: [{ id: "i1", path: "t/p/a.webp", alt: null, position: 0, is_primary: true }],
  options: [], variants: [], related: [], presentation: { schemaVersion: 1, hiddenBlocks: ["product-sku"] }, ...over,
});

describe("loadProductPreview (product selection)", () => {
  it("a picked product: the product as the storefront renders it, plus its settings", async () => {
    const svc = await import("@/services/presentation.service");
    productApi.get.mockResolvedValue({ id: PID, slug: "tee" });
    publicProduct.mockResolvedValue(publicData());
    apiRequest.mockResolvedValue({ data: detail({ revision: 2 }) });
    const preview = await svc.loadProductPreview({ productId: PID });
    expect(publicProduct).toHaveBeenCalledWith("acme", "tee");
    expect(preview).toMatchObject({ productId: PID, slug: "tee", name: "Tee", presentationError: null });
    expect(preview.presentation?.revision).toBe(2);
    expect(preview.resource).toMatchObject({ name: "Tee", image_path: "t/p/a.webp", presentation: { schemaVersion: 1, hiddenBlocks: ["product-sku"] } });
  });

  it("the default first product is found by its slug in the admin list", async () => {
    const svc = await import("@/services/presentation.service");
    productApi.list.mockResolvedValueOnce({ items: [{ id: "other", slug: "tee-2" }, { id: PID, slug: "tee" }], meta: { page: 1, limit: 50, total: 2, totalPages: 1 } });
    publicProduct.mockResolvedValue(publicData());
    apiRequest.mockResolvedValue({ data: detail() });
    expect((await svc.loadProductPreview({ slug: "tee" })).productId).toBe(PID);
    expect(productApi.get).not.toHaveBeenCalled();
  });

  it("a slug that matches no active product is not found", async () => {
    const svc = await import("@/services/presentation.service");
    productApi.list.mockResolvedValue({ items: [], meta: { page: 1, limit: 50, total: 0, totalPages: 1 } });
    await expect(svc.loadProductPreview({ slug: "ghost" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("a product that is not on the storefront (inactive) says so", async () => {
    const svc = await import("@/services/presentation.service");
    productApi.get.mockResolvedValue({ id: PID, slug: "tee" });
    publicProduct.mockRejectedValue(new AppError("NOT_FOUND", "not found"));
    await expect(svc.loadProductPreview({ productId: PID })).rejects.toThrow(/not visible on your store/);
  });

  it("settings that cannot be read (for example an API without the feature) do not stop the preview", async () => {
    const svc = await import("@/services/presentation.service");
    productApi.get.mockResolvedValue({ id: PID, slug: "tee" });
    publicProduct.mockResolvedValue(publicData({ presentation: undefined }));
    apiRequest.mockRejectedValue(new AppError("NOT_FOUND", "Cannot GET /store/product-presentations"));
    const preview = await svc.loadProductPreview({ productId: PID });
    expect(preview.presentation).toBeNull();
    expect(preview.presentationError).toBe("Cannot GET /store/product-presentations");
    expect(preview.resource.presentation).toBeNull();
  });

  it("asking for nothing is a validation error", async () => {
    const svc = await import("@/services/presentation.service");
    await expect(svc.loadProductPreview({})).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("server actions and storefront cache invalidation", () => {
  it("saving a draft sends the revision, passes a 409 on, and never touches the storefront cache", async () => {
    const actions = await import("@/app/(dashboard)/dashboard/templates/actions");
    apiRequest.mockResolvedValueOnce({ data: detail({ revision: 5 }) });
    const ok = await actions.savePresentationDraftAction({ productId: PID, document: { schemaVersion: 1 }, expectedRevision: 4 });
    expect(ok).toMatchObject({ ok: true, data: { revision: 5 } });
    expect(apiRequest).toHaveBeenLastCalledWith(`/store/product-presentations/${PID}/draft`, expect.objectContaining({ json: { document: { schemaVersion: 1 }, expectedRevision: 4 } }));

    apiRequest.mockRejectedValueOnce(new AppError("CONFLICT", "Someone else changed this product design."));
    expect(await actions.savePresentationDraftAction({ productId: PID, document: { schemaVersion: 1 }, expectedRevision: 4 })).toMatchObject({ ok: false, code: "CONFLICT" });

    apiRequest.mockRejectedValueOnce(new AppError("VALIDATION", "problems", { [`productPresentation.${PID}.focalPoint.x`]: "x must be a number from 0 to 100." }));
    expect(await actions.savePresentationDraftAction({ productId: PID, document: { schemaVersion: 1 }, expectedRevision: 4 })).toMatchObject({ ok: false, fieldErrors: { [`productPresentation.${PID}.focalPoint.x`]: expect.any(String) } });

    expect(invalidateStorefront).not.toHaveBeenCalled();
  });

  it("revision 0 is accepted (a product with no customization yet) and a bad id or negative revision never reaches the API", async () => {
    const actions = await import("@/app/(dashboard)/dashboard/templates/actions");
    apiRequest.mockResolvedValueOnce({ data: detail() });
    expect((await actions.savePresentationDraftAction({ productId: PID, document: { schemaVersion: 1 }, expectedRevision: 0 })).ok).toBe(true);
    apiRequest.mockClear();
    expect((await actions.savePresentationDraftAction({ productId: "nope", document: {}, expectedRevision: 0 })).ok).toBe(false);
    expect((await actions.savePresentationDraftAction({ productId: PID, document: {}, expectedRevision: -1 })).ok).toBe(false);
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it("publishing one product drops the storefront cache; a failed publish does not", async () => {
    const actions = await import("@/app/(dashboard)/dashboard/templates/actions");
    apiRequest.mockResolvedValueOnce({ data: { ...detail({ publicationState: "published" }), published: true } });
    const ok = await actions.publishPresentationAction({ productId: PID, expectedRevision: 1 });
    expect(ok).toMatchObject({ ok: true, data: { published: true } });
    expect(invalidateStorefront).toHaveBeenCalledTimes(1);

    invalidateStorefront.mockClear();
    apiRequest.mockRejectedValueOnce(new AppError("CONFLICT", "changed"));
    expect(await actions.publishPresentationAction({ productId: PID, expectedRevision: 1 })).toMatchObject({ ok: false, code: "CONFLICT" });
    expect(invalidateStorefront).not.toHaveBeenCalled();
  });

  it("resetting drops the storefront cache straight away, because the API removes the live settings at once", async () => {
    const actions = await import("@/app/(dashboard)/dashboard/templates/actions");
    apiRequest.mockResolvedValueOnce({ data: detail({ revision: 0, publicationState: "default" }) });
    expect(await actions.resetPresentationAction(PID)).toMatchObject({ ok: true, data: { publicationState: "default", revision: 0 } });
    expect(apiRequest).toHaveBeenLastCalledWith(`/store/product-presentations/${PID}`, expect.objectContaining({ method: "DELETE" }));
    expect(invalidateStorefront).toHaveBeenCalledTimes(1);

    invalidateStorefront.mockClear();
    apiRequest.mockRejectedValueOnce(new AppError("FORBIDDEN", "no"));
    expect(await actions.resetPresentationAction(PID)).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(invalidateStorefront).not.toHaveBeenCalled();
  });

  it("a cache problem never fails the publish", async () => {
    const actions = await import("@/app/(dashboard)/dashboard/templates/actions");
    getActiveStore.mockRejectedValueOnce(new Error("boom"));
    apiRequest.mockResolvedValueOnce({ data: { ...detail(), published: true } });
    expect((await actions.publishPresentationAction({ productId: PID })).ok).toBe(true);
    expect(invalidateStorefront).toHaveBeenCalled();
  });

  it("the picker and preview actions validate their input", async () => {
    const actions = await import("@/app/(dashboard)/dashboard/templates/actions");
    expect((await actions.loadProductPreviewAction({})).ok).toBe(false);
    expect((await actions.loadProductPreviewAction({ productId: PID, slug: "x" })).ok).toBe(false);
    expect((await actions.loadProductPreviewAction({ productId: "nope" })).ok).toBe(false);
    expect((await actions.listPickerProductsAction({ page: 0 })).ok).toBe(false);
  });

  it("publish-all returns the API's product count and still drops the cache", async () => {
    const theme = await import("@/services/theme.service");
    vi.mocked(theme.publishTheme).mockResolvedValueOnce({ published: [{ templateId: "t", kind: "product", versionNumber: 2 }], unchanged: 0, storeSlug: "acme", publishedAt: "now", productPresentations: { published: 2 } });
    const actions = await import("@/app/(dashboard)/dashboard/templates/actions");
    const result = await actions.publishThemeAction();
    expect(result).toMatchObject({ ok: true, data: { productPresentations: { published: 2 }, storeSlug: "acme" } });
    expect(invalidateStorefront).toHaveBeenCalledTimes(1);
  });
});
