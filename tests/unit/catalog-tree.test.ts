import { describe, expect, it } from "vitest";
import { childLevel, childrenOf, flattenTree, indexTree, levelOrderProblems, parentLevel, pathLabel, productHolders, shiftId } from "@/lib/catalog/tree";
import type { CatalogLevel, CatalogTreeNode } from "@/lib/catalog/types";

const level = (position: number, name: string, canHoldProducts = false): CatalogLevel => ({ id: `L${position}`, name, position, canHoldProducts, nodeCount: 0, createdAt: "", updatedAt: "" });
// Four levels here, but nothing in the helpers knows that: the owner could have 2 or 9.
const levels = [level(1, "Brand"), level(2, "Vehicle"), level(3, "Variant"), level(4, "Part group", true)];

const node = (id: string, parentId: string | null, pos: number, children: CatalogTreeNode[] = [], pathIds: string[] = [id]): CatalogTreeNode => ({
  id,
  levelId: `L${pos}`,
  levelName: levels[pos - 1].name,
  levelPosition: pos,
  parentId,
  name: id.toUpperCase(),
  slug: id,
  description: null,
  position: 0,
  status: "active",
  seoTitle: null,
  seoDescription: null,
  imagePath: null,
  imageAlt: null,
  depth: pos,
  pathIds,
  childCount: children.length,
  productCount: 0,
  createdAt: "",
  updatedAt: "",
  children,
});

const tree = [
  node("a", null, 1, [node("a1", "a", 2, [node("a1x", "a1", 3, [node("a1x1", "a1x", 4, [], ["a", "a1", "a1x", "a1x1"])], ["a", "a1", "a1x"])], ["a", "a1"]), node("a2", "a", 2, [], ["a", "a2"])]),
  node("b", null, 1),
];

describe("catalog tree helpers", () => {
  it("flattens depth first, parents before children, in display order", () => {
    expect(flattenTree(tree).map((n) => n.id)).toEqual(["a", "a1", "a1x", "a1x1", "a2", "b"]);
  });

  it("indexes every item by id", () => {
    expect([...indexTree(tree).keys()].sort()).toEqual(["a", "a1", "a1x", "a1x1", "a2", "b"]);
  });

  it("labels an item with the names on its path", () => {
    const byId = indexTree(tree);
    expect(pathLabel(byId.get("a1x1")!, byId)).toBe("A › A1 › A1X › A1X1");
    expect(pathLabel(byId.get("a2")!, byId, " / ")).toBe("A / A2");
    // An item whose ancestors are not in the (cut) tree still has a label.
    expect(pathLabel({ id: "z", name: "Zed", pathIds: ["gone", "z"] }, byId)).toBe("Zed");
  });

  it("offers only items on levels that may carry products, with their paths", () => {
    expect(productHolders(tree, levels)).toEqual([{ id: "a1x1", label: "A › A1 › A1X › A1X1", levelName: "Part group" }]);
    // The owner decides which levels carry products: allow level 2 as well and its items appear.
    const two = levels.map((l) => (l.position === 2 ? { ...l, canHoldProducts: true } : l));
    expect(productHolders(tree, two).map((h) => h.id)).toEqual(["a1", "a1x1", "a2"]);
    expect(productHolders(tree, levels.map((l) => ({ ...l, canHoldProducts: false })))).toEqual([]);
  });

  it("finds the level above and below an item from its position, whatever the number of levels", () => {
    expect(childLevel(levels, { levelPosition: 1 })?.name).toBe("Vehicle");
    expect(childLevel(levels, { levelPosition: 4 })).toBeNull();
    expect(parentLevel(levels, { levelPosition: 1 })).toBeNull();
    expect(parentLevel(levels, { levelPosition: 3 })?.name).toBe("Vehicle");
    expect(childLevel([level(1, "Only")], { levelPosition: 1 })).toBeNull();
  });

  it("moves an id one place and leaves the order alone at the ends or for an unknown id", () => {
    expect(shiftId(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
    expect(shiftId(["a", "b", "c"], "b", 1)).toEqual(["a", "c", "b"]);
    expect(shiftId(["a", "b", "c"], "a", -1)).toEqual(["a", "b", "c"]);
    expect(shiftId(["a", "b", "c"], "c", 1)).toEqual(["a", "b", "c"]);
    expect(shiftId(["a", "b"], "x", 1)).toEqual(["a", "b"]);
  });

  it("lists the siblings of an item, the top level for a null parent", () => {
    expect(childrenOf(tree, null).map((n) => n.id)).toEqual(["a", "b"]);
    expect(childrenOf(tree, "a").map((n) => n.id)).toEqual(["a1", "a2"]);
    expect(childrenOf(tree, "b")).toEqual([]);
    expect(childrenOf(tree, "missing")).toEqual([]);
  });

  it("reads the reasons of a refused level order, and nothing from other details", () => {
    expect(levelOrderProblems({ problems: ["one", "two"] })).toEqual(["one", "two"]);
    expect(levelOrderProblems({ problems: ["one", 2, null] })).toEqual(["one"]);
    expect(levelOrderProblems({ problems: "nope" })).toEqual([]);
    expect(levelOrderProblems(undefined)).toEqual([]);
    expect(levelOrderProblems(null)).toEqual([]);
    expect(levelOrderProblems("text")).toEqual([]);
  });
});
