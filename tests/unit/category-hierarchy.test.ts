import { describe, expect, it } from "vitest";
import { orderCategories } from "@/lib/categories/hierarchy";

const row = (id: string, name: string, parentId: string | null = null) => ({ id, name, parentId });

describe("orderCategories", () => {
  it("lists each parent followed by its subcategories, alphabetical at each level, with Parent › Child labels", () => {
    const out = orderCategories([row("c1", "Zed", "b"), row("a", "Apparel"), row("b", "Books"), row("c2", "Atlas", "b"), row("a1", "Shirts", "a")]);
    expect(out.map((r) => [r.id, r.level, r.label])).toEqual([
      ["a", 1, "Apparel"],
      ["a1", 2, "Apparel › Shirts"],
      ["b", 1, "Books"],
      ["c2", 2, "Books › Atlas"],
      ["c1", 2, "Books › Zed"],
    ]);
  });
  it("never hides a legacy row that is deeper than two levels", () => {
    const out = orderCategories([row("a", "A"), row("b", "B", "a"), row("c", "C", "b")]);
    expect(out.map((r) => [r.id, r.level])).toEqual([["a", 1], ["b", 2], ["c", 3]]);
  });
  it("keeps a row whose parent is missing as a top-level row", () => {
    expect(orderCategories([row("x", "X", "gone")]).map((r) => [r.id, r.level])).toEqual([["x", 1]]);
  });
});
