import { beforeEach, describe, expect, it, vi } from "vitest";
import { createImageFields, imageProblem, pickedPath, updateImageFields, type PickedImage } from "@/lib/catalog/node-image";
import { catalogFolder } from "@/lib/storage/paths";
import { nodeCreateSchema, nodeUpdateSchema } from "@/lib/validations/catalog-hierarchy";

/**
 * The picture of a catalog item: what the dialog sends for a new item, a replaced picture, a removed one and an unchanged one; the
 * schemas of the server actions; and the upload scope. The API owns the storage rules (folder, type, size); this checks what we send.
 */

const TENANT = "11111111-1111-4111-8111-111111111111";
const NODE = "22222222-2222-4222-8222-222222222222";
const OLD = `${TENANT}/catalog/${NODE}/old.png`;
const NEW = `${TENANT}/catalog/${NODE}/new.webp`;
const done = (path: string): PickedImage => ({ status: "done", path });

const requestSigned = vi.fn();
const requireActiveTenant = vi.fn<(permission?: string) => Promise<{ tenant: { id: string } }>>(async () => ({ tenant: { id: TENANT } }));
vi.mock("@/lib/tenant/context", () => ({ requireActiveTenant: (p?: string) => requireActiveTenant(p) }));
vi.mock("@/lib/api/endpoints/upload-api", () => ({ requestSignedUploadsApi: (...a: unknown[]) => requestSigned(...a) }));

describe("what the dialog sends for a new item", () => {
  it("sends the picture and its description when there is a picture", () => {
    expect(createImageFields([done(NEW)], "  Front view  ")).toEqual({ imagePath: NEW, imageAlt: "Front view" });
  });
  it("sends only the path when the description is empty (the storefront then uses the item's name)", () => {
    expect(createImageFields([done(NEW)], "   ")).toEqual({ imagePath: NEW });
  });
  it("sends nothing about a picture when there is none, whatever the description says", () => {
    expect(createImageFields([], "left over")).toEqual({});
  });
  it("ignores an upload that did not finish", () => {
    expect(createImageFields([{ status: "uploading", path: null }], "x")).toEqual({});
    expect(createImageFields([{ status: "error", path: null }], "x")).toEqual({});
  });
});

describe("what the dialog sends for an existing item", () => {
  const withPicture = { imagePath: OLD, imageAlt: "Old text" };
  const without = { imagePath: null, imageAlt: null };

  it("sends no picture field at all when nothing changed", () => {
    expect(updateImageFields(withPicture, [done(OLD)], "Old text")).toEqual({});
    expect(updateImageFields(withPicture, [done(OLD)], "  Old text ")).toEqual({});
    expect(updateImageFields(without, [], "")).toEqual({});
  });
  it("sends the new path with its description for a replacement", () => {
    expect(updateImageFields(withPicture, [done(NEW)], "New text")).toEqual({ imagePath: NEW, imageAlt: "New text" });
    expect(updateImageFields(withPicture, [done(NEW)], "")).toEqual({ imagePath: NEW, imageAlt: null });
  });
  it("sends null for the path and the description when the picture is removed", () => {
    expect(updateImageFields(withPicture, [], "Old text")).toEqual({ imagePath: null, imageAlt: null });
  });
  it("adds a picture to an item that had none", () => {
    expect(updateImageFields(without, [done(NEW)], "Side")).toEqual({ imagePath: NEW, imageAlt: "Side" });
  });
  it("sends only the description when only the description changed, and can clear it", () => {
    expect(updateImageFields(withPicture, [done(OLD)], "Changed")).toEqual({ imageAlt: "Changed" });
    expect(updateImageFields(withPicture, [done(OLD)], "")).toEqual({ imageAlt: null });
  });
  it("does not send a description for an item that has no picture", () => {
    expect(updateImageFields(without, [], "orphan text")).toEqual({});
  });
});

describe("when the picture blocks saving", () => {
  it("waits for an upload in progress and refuses one that failed", () => {
    expect(imageProblem([{ status: "uploading", path: null }])).toMatch(/finish uploading/);
    expect(imageProblem([{ status: "error", path: null }])).toMatch(/failed to upload/);
    expect(imageProblem([done(NEW)])).toBeNull();
    expect(imageProblem([])).toBeNull();
  });
  it("reads the path of the finished upload only", () => {
    expect(pickedPath([{ status: "error", path: "x" }, done(NEW)])).toBe(NEW);
    expect(pickedPath([{ status: "uploading", path: null }])).toBeNull();
  });
});

describe("the actions' schemas", () => {
  it("accepts a new item with an id, a path and a description", () => {
    const r = nodeCreateSchema.parse({ id: NODE, name: "Gusto", imagePath: NEW, imageAlt: "  Side view " });
    expect(r).toMatchObject({ id: NODE, imagePath: NEW, imageAlt: "Side view" });
  });
  it("accepts a new item without a picture, with or without an id", () => {
    expect(nodeCreateSchema.safeParse({ name: "Gusto" }).success).toBe(true);
    expect(nodeCreateSchema.safeParse({ id: NODE, name: "Gusto" }).success).toBe(true);
  });
  it("refuses a picture without an id, a bad id and a description over 200 characters", () => {
    expect(nodeCreateSchema.safeParse({ name: "Gusto", imagePath: NEW }).success).toBe(false);
    expect(nodeCreateSchema.safeParse({ id: "nope", name: "Gusto" }).success).toBe(false);
    expect(nodeCreateSchema.safeParse({ id: NODE, name: "Gusto", imageAlt: "x".repeat(201) }).success).toBe(false);
    expect(nodeCreateSchema.safeParse({ id: NODE, name: "Gusto", imageAlt: "x".repeat(200) }).success).toBe(true);
    expect(nodeCreateSchema.safeParse({ id: NODE, name: "Gusto", imagePath: "x".repeat(301) }).success).toBe(false);
  });
  it("keeps an update without picture fields free of them, and turns null or empty into null", () => {
    expect(nodeUpdateSchema.parse({ name: "Gusto" })).toEqual({ name: "Gusto" });
    expect(nodeUpdateSchema.parse({ imagePath: null, imageAlt: null })).toEqual({ imagePath: null, imageAlt: null });
    expect(nodeUpdateSchema.parse({ imagePath: "", imageAlt: "" })).toEqual({ imagePath: null, imageAlt: null });
    expect(nodeUpdateSchema.parse({ imagePath: NEW, imageAlt: " Side " })).toEqual({ imagePath: NEW, imageAlt: "Side" });
    expect(nodeUpdateSchema.safeParse({ imageAlt: "x".repeat(201) }).success).toBe(false);
  });
});

describe("the catalog upload scope", () => {
  const file = { type: "image/png", size: 1024 };
  const target = { path: `${TENANT}/catalog/${NODE}/a.png`, token: "t", signedUrl: "https://x.supabase.co/upload" };

  beforeEach(() => {
    vi.clearAllMocks();
    requireActiveTenant.mockResolvedValue({ tenant: { id: TENANT } });
    requestSigned.mockResolvedValue([target]);
  });

  it("asks the API for a link in the item's folder, with the item's id as owner, under catalog:manage", async () => {
    const { requestUploadsAction } = await import("@/app/(dashboard)/dashboard/uploads/actions");
    const res = await requestUploadsAction({ scope: "catalog", ownerId: NODE, files: [file] });
    expect(requireActiveTenant).toHaveBeenCalledWith("catalog:manage");
    expect(requestSigned).toHaveBeenCalledWith(TENANT, { scope: "catalog", ownerId: NODE, files: [file] });
    expect(res).toMatchObject({ ok: true, data: [target] });
  });
  it("needs the item's id, refuses videos and non-images, and reports a refusal by the API", async () => {
    const { requestUploadsAction } = await import("@/app/(dashboard)/dashboard/uploads/actions");
    expect((await requestUploadsAction({ scope: "catalog", files: [file] })).ok).toBe(false);
    expect((await requestUploadsAction({ scope: "catalog", ownerId: NODE, files: [{ type: "video/mp4", size: 5 }] })).ok).toBe(false);
    expect((await requestUploadsAction({ scope: "catalog", ownerId: NODE, files: [{ type: "image/gif", size: 5 }] })).ok).toBe(false);
    expect(requestSigned).not.toHaveBeenCalled();
    requestSigned.mockRejectedValueOnce(new Error("api said no"));
    expect((await requestUploadsAction({ scope: "catalog", ownerId: NODE, files: [file] })).ok).toBe(false);
  });
  it("names the folder like the API does", () => {
    expect(catalogFolder(TENANT, NODE)).toBe(`${TENANT}/catalog/${NODE}`);
  });
});
