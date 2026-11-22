import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * D-001 / AC-ERR-2: the storefront reads the published home design strictly (a failed read or a document that is not a
 * document is an error for the error boundary), while the dashboard keeps the lenient read (never breaks the Themes page).
 */

vi.mock("@/lib/db", () => ({ getDatabase: () => { throw new Error("no database in API mode"); } }));
const getPublicLayoutApi = vi.fn();
const getPublicCollectionsApi = vi.fn();
vi.mock("@/lib/api/endpoints/public-api", () => ({
  getPublicLayoutApi: (...a: unknown[]) => getPublicLayoutApi(...a),
  getPublicCollectionsApi: (...a: unknown[]) => getPublicCollectionsApi(...a),
  getPublicCollectionApi: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  getPublicCollectionsApi.mockResolvedValue([]);
});

const published = { order: ["a"], sections: { a: { type: "rich-text", settings: {}, blocks: {}, block_order: [] } }, schemaVersion: 1, layout: "classic" };

describe("storefront design read", () => {
  it("returns the published design", async () => {
    getPublicLayoutApi.mockResolvedValue({ source: "published", template: { document: published }, groups: {}, theme: null });
    const { getStorefrontDesign } = await import("@/services/storefront.service");
    expect((await getStorefrontDesign("ok-shop"))?.layout.template.document).toEqual(published);
  });

  it("nothing published yet: no design, so the storefront keeps its built-in template", async () => {
    getPublicLayoutApi.mockResolvedValue({ source: "default", template: null, groups: {}, theme: null });
    const { getStorefrontDesign, getPublishedDesign } = await import("@/services/storefront.service");
    await expect(getStorefrontDesign("fresh-shop")).resolves.toBeNull();
    await expect(getPublishedDesign("fresh-shop")).resolves.toBeNull();
  });

  it("a failed read is an error for the storefront but not for the dashboard", async () => {
    getPublicLayoutApi.mockRejectedValue(new Error("API unreachable"));
    const { getStorefrontDesign, getPublishedDesign } = await import("@/services/storefront.service");
    await expect(getStorefrontDesign("down-shop")).rejects.toThrow("API unreachable");
    await expect(getPublishedDesign("down-shop")).resolves.toBeNull();
  });

  it.each([null, "not a document", 42, [1, 2]])("a published template whose document is %j is an error for the storefront", async (document) => {
    getPublicLayoutApi.mockResolvedValue({ source: "published", template: { document }, groups: {}, theme: null });
    const { getStorefrontDesign, getPublishedDesign } = await import("@/services/storefront.service");
    await expect(getStorefrontDesign(`bad-${String(document)}`)).rejects.toThrow("not a valid document");
    await expect(getPublishedDesign(`bad-${String(document)}`)).resolves.toBeNull();
  });
});
