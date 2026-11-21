import { describe, expect, it } from "vitest";
import { categoryDeletionImpact, describeCategoryDeletion } from "@/lib/categories/hierarchy";

const rows = [
  { id: "a", name: "Apparel", parentId: null, productCount: 3 },
  { id: "s1", name: "Shirts", parentId: "a", productCount: 5 },
  { id: "s2", name: "Hats", parentId: "a", productCount: 0 },
  { id: "b", name: "Bags", parentId: null, productCount: 1 },
];
describe("categoryDeletionImpact", () => {
  it("counts own products and names direct subcategories alphabetically", () => {
    expect(categoryDeletionImpact(rows, "a")).toEqual({ productCount: 3, subcategories: [{ id: "s2", name: "Hats" }, { id: "s1", name: "Shirts" }] });
  });
  it("leaf and unknown", () => {
    expect(categoryDeletionImpact(rows, "s1")).toEqual({ productCount: 5, subcategories: [] });
    expect(categoryDeletionImpact(rows, "zz")).toEqual({ productCount: 0, subcategories: [] });
  });
});
describe("describeCategoryDeletion", () => {
  it("states counts and names", () => {
    const t = describeCategoryDeletion(categoryDeletionImpact(rows, "a"));
    expect(t).toContain("3 products will become uncategorised.");
    expect(t).toContain("2 subcategories will become top-level categories: Hats, Shirts.");
    expect(t).toContain("The products themselves are kept.");
  });
  it("singular and none", () => {
    expect(describeCategoryDeletion({ productCount: 1, subcategories: [] })).toContain("1 product will become uncategorised. No subcategories are affected.");
    expect(describeCategoryDeletion({ productCount: 0, subcategories: [{ id: "x", name: "Solo" }] })).toContain("1 subcategory will become a top-level category: Solo.");
  });
});
