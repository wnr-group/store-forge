import { describe, expect, it } from "vitest";
import { describeCollectionUsage, type CollectionUsage } from "@/lib/collections/usage";

const ref = (o: Partial<CollectionUsage["references"][number]> = {}) => ({ templateId: "t", templateName: "Home page", kind: "index", location: "index", sectionId: "f", inDraft: true, inPublished: false, ...o });
describe("describeCollectionUsage", () => {
  it("keeps the plain wording when unused", () => {
    expect(describeCollectionUsage({ total: 0, hash: "h", references: [] }, "Summer")).toBe("The collection and its image are removed. The products in it are kept.");
    expect(describeCollectionUsage(null, "Summer")).toBe("The collection and its image are removed. The products in it are kept.");
  });
  it("states count, locations and live/draft state", () => {
    const text = describeCollectionUsage({ total: 2, hash: "h", references: [ref(), ref({ templateName: "Theme", location: "cart page", inPublished: true })] }, "Summer");
    expect(text).toContain('"Summer" is used by 2 sections of your store design');
    expect(text).toContain("Home page (index, draft)");
    expect(text).toContain("Theme (cart page, live and draft)");
    expect(text).toContain("from shoppers until you choose another collection");
  });
  it("singular and live-only", () => {
    const text = describeCollectionUsage({ total: 1, hash: "h", references: [ref({ inDraft: false, inPublished: true })] }, "Summer");
    expect(text).toContain("used by 1 section of your store design");
    expect(text).toContain("Home page (index, live)");
  });
});
