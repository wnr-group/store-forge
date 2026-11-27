import { beforeEach, describe, expect, it, vi } from "vitest";
import { toAppError } from "@/lib/api/client";
import { AppError } from "@/lib/errors";
import { bulkAssignmentSchema, importRequestSchema, levelCreateSchema, nodeCreateSchema, nodeListSchema, nodeMoveSchema, nodeUpdateSchema } from "@/lib/validations/catalog-hierarchy";

const ID = "22222222-2222-4222-8222-222222222222";
const ID2 = "33333333-3333-4333-8333-333333333333";

describe("catalog input validation", () => {
  it("does not clear what an edit did not send, and clears what was emptied", () => {
    expect(nodeUpdateSchema.parse({ name: "  Gusto  " })).toEqual({ name: "Gusto" });
    expect(nodeUpdateSchema.parse({ description: "", seoTitle: "" })).toEqual({ description: null, seoTitle: null });
    expect(nodeUpdateSchema.parse({ slug: "" })).toEqual({});
    expect(nodeUpdateSchema.parse({ slug: " Rock-Star " })).toEqual({ slug: "rock-star" });
  });

  it("checks names, addresses and limits like the API does", () => {
    expect(nodeCreateSchema.safeParse({ name: "" }).success).toBe(false);
    expect(nodeCreateSchema.safeParse({ name: "x".repeat(121) }).success).toBe(false);
    expect(nodeCreateSchema.safeParse({ name: "x", slug: "bad slug" }).success).toBe(false);
    expect(nodeCreateSchema.safeParse({ name: "x", slug: "5" }).success).toBe(true); // one character is fine for an item
    expect(nodeCreateSchema.safeParse({ name: "x", parentId: "nope" }).success).toBe(false);
    expect(nodeCreateSchema.safeParse({ name: "x", parentId: null }).success).toBe(true);
    expect(levelCreateSchema.safeParse({ name: "L".repeat(61) }).success).toBe(false);
    expect(levelCreateSchema.safeParse({ name: "Brand", position: 21 }).success).toBe(false);
    expect(levelCreateSchema.safeParse({ name: "Brand", position: 20, canHoldProducts: true }).success).toBe(true);
    expect(nodeMoveSchema.safeParse({ parentId: null }).success).toBe(true);
    expect(nodeMoveSchema.safeParse({}).success).toBe(false);
  });

  it("limits a bulk placement to 100 items, 500 products and 20000 pairs", () => {
    const ids = (n: number) => Array.from({ length: n }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);
    expect(bulkAssignmentSchema.safeParse({ action: "assign", nodeIds: [ID], productIds: [ID2] }).success).toBe(true);
    expect(bulkAssignmentSchema.safeParse({ action: "assign", nodeIds: ids(101), productIds: [ID2] }).success).toBe(false);
    expect(bulkAssignmentSchema.safeParse({ action: "assign", nodeIds: [ID], productIds: ids(501) }).success).toBe(false);
    expect(bulkAssignmentSchema.safeParse({ action: "assign", nodeIds: ids(100), productIds: ids(200) }).success).toBe(true);
    expect(bulkAssignmentSchema.safeParse({ action: "assign", nodeIds: ids(100), productIds: ids(201) }).success).toBe(false);
    expect(bulkAssignmentSchema.safeParse({ action: "delete", nodeIds: [ID], productIds: [ID2] }).success).toBe(false);
    expect(bulkAssignmentSchema.safeParse({ action: "unassign", nodeIds: [], productIds: [ID2] }).success).toBe(false);
  });

  it("lets an item search narrow by root, level or parent and nothing else", () => {
    expect(nodeListSchema.parse({})).toMatchObject({ page: 1, limit: 20 });
    expect(nodeListSchema.safeParse({ parentId: "root" }).success).toBe(true);
    expect(nodeListSchema.safeParse({ parentId: ID }).success).toBe(true);
    expect(nodeListSchema.safeParse({ parentId: "all" }).success).toBe(false);
    expect(nodeListSchema.safeParse({ limit: 101 }).success).toBe(false);
  });

  it("accepts an import request of up to 2000 rows and up to 20 levels", () => {
    const row = (i: number) => ({ row: i + 2, level_1: `Item ${i}`, source_errors: [{ column: "level_1", message: "x" }] });
    expect(importRequestSchema.safeParse({ dryRun: true, rows: Array.from({ length: 2000 }, (_, i) => row(i)) }).success).toBe(true);
    expect(importRequestSchema.safeParse({ rows: Array.from({ length: 2001 }, (_, i) => row(i)) }).success).toBe(false);
    expect(importRequestSchema.safeParse({ rows: [] }).success).toBe(false);
    expect(importRequestSchema.safeParse({ rows: [{ row: 1, level_1: "x" }] }).success).toBe(false); // the header is row 1
    expect(importRequestSchema.safeParse({ rows: [{ row: 2 }], levels: Array.from({ length: 21 }, (_, i) => ({ row: i + 2, name: `L${i}` })) }).success).toBe(false);
    expect(importRequestSchema.safeParse({ rows: [{ row: 2 }], defaultStatus: "archived" }).success).toBe(false);
  });
});

describe("API errors that carry details for the catalog screens", () => {
  it("passes the rows of a refused import and the reasons of a refused level order through, typed", () => {
    const rows = { total: 2, errors: [{ row: 3, column: "level_2", message: "Gap", value: "" }] };
    const a = toAppError(400, { success: false, message: "Nothing was imported.", error: { code: "CATALOG_IMPORT_INVALID", details: rows } });
    expect(a.code).toBe("VALIDATION");
    expect(a.details).toEqual(rows);
    const b = toAppError(409, { success: false, message: "The levels cannot be put in this order.", error: { code: "CATALOG_LEVEL_ORDER_BLOCKED", details: { problems: ["a before b"] } } });
    expect(b.code).toBe("CONFLICT");
    expect(b.details).toEqual({ problems: ["a before b"] });
  });

  it("still keeps the details of unrelated errors out", () => {
    const e = toAppError(409, { success: false, message: "Taken", error: { code: "CATALOG_NODE_SLUG_TAKEN", details: { internal: "x" } } });
    expect(e.details).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------------------------------------------- actions

const requireActiveTenant = vi.fn<(permission?: string) => Promise<{ tenant: { id: string } }>>(async () => ({ tenant: { id: "t" } }));
vi.mock("@/lib/tenant/context", () => ({ requireActiveTenant: (p?: string) => requireActiveTenant(p) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
const invalidateStorefront = vi.fn(async () => {});
vi.mock("@/lib/storefront/cache", () => ({ invalidateStorefront: () => invalidateStorefront() }));
const service = {
  importCatalogRows: vi.fn(),
  createCatalogNode: vi.fn(),
  updateCatalogNode: vi.fn(),
  deleteCatalogNode: vi.fn(),
  reorderCatalogLevels: vi.fn(),
};
vi.mock("@/services/catalog.service", () => ({
  importCatalogRows: (...a: unknown[]) => service.importCatalogRows(...a),
  createCatalogNode: (...a: unknown[]) => service.createCatalogNode(...a),
  updateCatalogNode: (...a: unknown[]) => service.updateCatalogNode(...a),
  deleteCatalogNode: (...a: unknown[]) => service.deleteCatalogNode(...a),
  reorderCatalogLevels: (...a: unknown[]) => service.reorderCatalogLevels(...a),
}));

describe("catalog server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("checks the file only after the permission, and answers file problems with their list", async () => {
    const { parseCatalogFileAction } = await import("@/app/(dashboard)/dashboard/catalog/actions");
    requireActiveTenant.mockRejectedValueOnce(new AppError("FORBIDDEN", "You do not have permission to do that."));
    const body = new FormData();
    body.set("file", new File(["level_1\r\nA\r\n"], "c.csv", { type: "text/csv" }));
    expect(await parseCatalogFileAction(body)).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(requireActiveTenant).toHaveBeenCalledWith("catalog:manage");

    const bad = new FormData();
    bad.set("file", new File(["colour\r\nred\r\n"], "c.csv", { type: "text/csv" }));
    const res = await parseCatalogFileAction(bad);
    expect(res).toMatchObject({ ok: false, details: { kind: "file" } });

    expect(await parseCatalogFileAction(new FormData())).toMatchObject({ ok: false, error: "Choose a file to import." });

    const good = new FormData();
    good.set("file", new File(["level_1,level_2\r\nA,B\r\n"], "c.csv", { type: "text/csv" }));
    good.set("levels", new File(["name,can_hold_products\r\nBrand,false\r\nModel,true\r\n"], "l.csv", { type: "text/csv" }));
    const ok = await parseCatalogFileAction(good);
    expect(ok).toMatchObject({ ok: true, data: { depth: 2, rows: [{ row: 2, level_1: "A", level_2: "B" }] } });
    expect(ok.ok && ok.data?.levels).toHaveLength(2);
  });

  it("does not drop the storefront cache for a dry run, and does for a real import", async () => {
    const { importCatalogChunkAction } = await import("@/app/(dashboard)/dashboard/catalog/actions");
    service.importCatalogRows.mockResolvedValue({ dryRun: true, valid: true, summary: {}, errors: [], totalErrors: 0 });
    await importCatalogChunkAction({ dryRun: true, rows: [{ row: 2, level_1: "A" }] });
    expect(invalidateStorefront).not.toHaveBeenCalled();
    service.importCatalogRows.mockResolvedValue({ dryRun: false, valid: true, summary: {}, errors: [], totalErrors: 0 });
    expect(await importCatalogChunkAction({ rows: [{ row: 2, level_1: "A" }] })).toMatchObject({ ok: true });
    expect(invalidateStorefront).toHaveBeenCalledTimes(1);
  });

  it("returns the rows of a refused import as typed details, and refuses a malformed request before calling the API", async () => {
    const { importCatalogChunkAction } = await import("@/app/(dashboard)/dashboard/catalog/actions");
    service.importCatalogRows.mockRejectedValue(new AppError("VALIDATION", "Nothing was imported.", undefined, "CATALOG_IMPORT_INVALID", { total: 1, errors: [{ row: 2, column: "status", message: "Use draft or active.", value: "x" }] }));
    const res = await importCatalogChunkAction({ rows: [{ row: 2, level_1: "A", status: "x" }] });
    expect(res).toMatchObject({ ok: false, details: { kind: "rows", total: 1, errors: [{ row: 2, column: "status" }] } });
    expect(invalidateStorefront).not.toHaveBeenCalled();
    service.importCatalogRows.mockClear();
    expect(await importCatalogChunkAction({ rows: [] })).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(service.importCatalogRows).not.toHaveBeenCalled();
  });

  it("sends only the fields an edit changed, and drops the cached storefront after a change", async () => {
    const { updateNodeAction, deleteNodeAction, reorderLevelsAction } = await import("@/app/(dashboard)/dashboard/catalog/actions");
    service.updateCatalogNode.mockResolvedValue({});
    await updateNodeAction(ID, { name: "New name" });
    expect(service.updateCatalogNode).toHaveBeenCalledWith(ID, { name: "New name" });
    expect(invalidateStorefront).toHaveBeenCalledTimes(1);
    expect(await updateNodeAction("not-an-id", { name: "x" })).toMatchObject({ ok: false, code: "VALIDATION" });
    service.deleteCatalogNode.mockResolvedValue({ deleted: 3 });
    expect(await deleteNodeAction(ID, true)).toMatchObject({ ok: true, data: { deleted: 3 } });
    expect(service.deleteCatalogNode).toHaveBeenCalledWith(ID, true);
    expect(await deleteNodeAction(ID, "yes")).toMatchObject({ ok: false, code: "VALIDATION" });
    service.reorderCatalogLevels.mockRejectedValue(new AppError("CONFLICT", "The levels cannot be put in this order.", undefined, "CATALOG_LEVEL_ORDER_BLOCKED", { problems: ["x"] }));
    expect(await reorderLevelsAction([ID, ID2])).toMatchObject({ ok: false, code: "CONFLICT", details: { problems: ["x"] } });
  });
});
