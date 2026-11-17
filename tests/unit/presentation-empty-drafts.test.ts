import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

/** Telling empty never-published drafts from real ones: the list of customized products carries states only. */

const tenant = { id: "11111111-1111-4111-8111-111111111111" };
const requireActiveTenant = vi.fn<(permission?: string) => Promise<{ tenant: typeof tenant; role: string }>>(async () => ({ tenant, role: "owner" }));
vi.mock("@/lib/tenant/context", () => ({ requireActiveTenant: (p?: string) => requireActiveTenant(p), getActiveStore: async () => ({ slug: "acme" }) }));

const getPresentation = vi.fn();
const listPresentations = vi.fn();
vi.mock("@/lib/api/endpoints/presentation-api", () => ({
  getPresentationApi: (...a: unknown[]) => getPresentation(...a),
  listPresentationsApi: (...a: unknown[]) => listPresentations(...a),
  savePresentationDraftApi: vi.fn(),
  publishPresentationApi: vi.fn(),
  resetPresentationApi: vi.fn(),
}));
vi.mock("@/lib/api/endpoints/product-api", () => ({ listProductsApi: vi.fn(), getProductApi: vi.fn() }));
vi.mock("@/lib/api/endpoints/public-api", () => ({ getPublicProductApi: vi.fn() }));
vi.mock("@/lib/api/endpoints/store-api", () => ({ getStoreApi: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("@/lib/storefront/cache", () => ({ invalidateStorefront: vi.fn(), storefrontCache: () => ({ tags: [], revalidate: 1 }) }));
vi.mock("@/services/theme.service", () => ({ publishTheme: vi.fn() }));

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const D = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const E = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const row = (productId: string, document: unknown, publishedDocument: unknown = null) => ({ productId, revision: 1, publicationState: "draft", document, publishedDocument });
const ids = (n: number) => Array.from({ length: n }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);

beforeEach(() => {
  vi.clearAllMocks();
  process.env.API_BASE_URL = "http://localhost:4000/api/v1";
  process.env.AUTH_BFF_SECRET = "s".repeat(40);
});

describe("checkDrafts", () => {
  it("sorts never-published products into empty and real, and names nothing it could not establish", async () => {
    const svc = await import("@/services/presentation.service");
    getPresentation.mockImplementation(async (_tenant: string, id: string) => {
      if (id === A) return row(A, { schemaVersion: 1 }); // empty, never published
      if (id === B) return row(B, { schemaVersion: 1, hiddenBlocks: ["product-sku"] }); // real settings
      if (id === C) return row(C, { schemaVersion: 1 }, { schemaVersion: 1 }); // published once: not a never-published draft
      if (id === D) return row(D, { schemaVersion: 2, gallery: {} }); // newer version: never guessed
      throw new AppError("NOT_FOUND", "gone");
    });
    expect(await svc.checkDrafts([A, B, C, D, E])).toEqual({ empty: [A], real: [B] });
  });

  it("reads at most 50 distinct products per call, ten at a time, and needs no write permission", async () => {
    const svc = await import("@/services/presentation.service");
    let inFlight = 0;
    let peak = 0;
    getPresentation.mockImplementation(async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight -= 1;
      throw new AppError("UNKNOWN", "down");
    });
    const many = ids(80);
    expect(await svc.checkDrafts([...many, ...many])).toEqual({ empty: [], real: [] });
    expect(getPresentation).toHaveBeenCalledTimes(50);
    expect(peak).toBeLessThanOrEqual(10);
    expect(requireActiveTenant).toHaveBeenCalledWith(undefined);
  });
});

describe("checkDraftsAction", () => {
  it("validates the ids before reading anything", async () => {
    const actions = await import("@/app/(dashboard)/dashboard/templates/actions");
    expect((await actions.checkDraftsAction(["nope"])).ok).toBe(false);
    expect((await actions.checkDraftsAction(ids(51))).ok).toBe(false);
    expect((await actions.checkDraftsAction("x")).ok).toBe(false);
    expect(getPresentation).not.toHaveBeenCalled();
  });

  it("returns the two groups", async () => {
    const actions = await import("@/app/(dashboard)/dashboard/templates/actions");
    getPresentation.mockImplementation(async (_t: string, id: string) => (id === A ? row(A, { schemaVersion: 1 }) : row(B, { schemaVersion: 1, focalPoint: { x: 1, y: 1 } })));
    expect(await actions.checkDraftsAction([A, B])).toEqual({ ok: true, data: { empty: [A], real: [B] } });
  });
});

describe("the list of customized products is paged and says when it is cut off", () => {
  const summary = (productId: string) => ({ productId, revision: 1, publicationState: "draft", publishedAt: null, updatedAt: "2026-01-01T00:00:00.000Z" });

  it("reads every page the API reports (100 each)", async () => {
    const svc = await import("@/services/presentation.service");
    listPresentations
      .mockResolvedValueOnce({ items: [summary("a")], meta: { page: 1, limit: 100, total: 101, totalPages: 2 } })
      .mockResolvedValueOnce({ items: [summary("b")], meta: { page: 2, limit: 100, total: 101, totalPages: 2 } });
    const result = await svc.listPresentations();
    expect(result.items.map((r) => r.productId)).toEqual(["a", "b"]);
    expect(result.truncated).toBe(false);
    expect(listPresentations).toHaveBeenNthCalledWith(2, tenant.id, { page: 2, limit: 100 });
  });

  it("stops after 10 pages and reports that the list is incomplete instead of pretending it is whole", async () => {
    const svc = await import("@/services/presentation.service");
    listPresentations.mockImplementation(async (_t: string, q: { page: number }) => ({ items: [summary(`p${q.page}`)], meta: { page: q.page, limit: 100, total: 5000, totalPages: 50 } }));
    const result = await svc.listPresentations();
    expect(listPresentations).toHaveBeenCalledTimes(10);
    expect(result.items).toHaveLength(10);
    expect(result.truncated).toBe(true);
  });

  it("exactly ten pages is complete, not truncated", async () => {
    const svc = await import("@/services/presentation.service");
    listPresentations.mockImplementation(async (_t: string, q: { page: number }) => ({ items: [summary(`p${q.page}`)], meta: { page: q.page, limit: 100, total: 1000, totalPages: 10 } }));
    expect((await svc.listPresentations()).truncated).toBe(false);
  });

  it("an error on a page fails the whole read (no half-list is passed off as complete)", async () => {
    const svc = await import("@/services/presentation.service");
    listPresentations
      .mockResolvedValueOnce({ items: [summary("a")], meta: { page: 1, limit: 100, total: 200, totalPages: 2 } })
      .mockRejectedValueOnce(new AppError("UNKNOWN", "down"));
    await expect(svc.listPresentations()).rejects.toMatchObject({ code: "UNKNOWN" });
  });
});
