import { describe, expect, it } from "vitest";
import type { ComponentNode, TemplateDocument } from "../../lib/templates/document";
import { LIMITS } from "../../lib/templates/limits";
import type { ComponentRegistry } from "../../lib/templates/engine/descriptors";
import {
  addNode,
  canMove,
  countComponents,
  depthOf,
  duplicateNode,
  findNode,
  generateId,
  moveNode,
  removeNode,
} from "../../lib/templates/engine/tree";

const node = (type: string, children: Record<string, ComponentNode> = {}, extra: Partial<ComponentNode> = {}): ComponentNode => ({
  type,
  settings: {},
  blocks: children,
  block_order: Object.keys(children),
  ...extra,
});

const doc = (sections: Record<string, ComponentNode>): TemplateDocument => ({
  schemaVersion: 1,
  layout: "classic",
  sections,
  order: Object.keys(sections),
});

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

/** Every id (sections and blocks, all depths) of a document. */
function allIds(d: TemplateDocument): string[] {
  const ids: string[] = [];
  const walk = (id: string, n: ComponentNode) => {
    ids.push(id);
    for (const [childId, child] of Object.entries(n.blocks)) walk(childId, child);
  };
  for (const [id, section] of Object.entries(d.sections)) walk(id, section);
  return ids;
}

const registry: ComponentRegistry = {
  sections: {
    box: { type: "box", name: "Box", accepts: ["leaf", "group"], maxChildren: 2, settings: [] },
    free: { type: "free", name: "Free", settings: [] },
  },
  blocks: {
    group: { type: "group", name: "Group", accepts: ["leaf"], maxChildren: 1, settings: [] },
    leaf: { type: "leaf", name: "Leaf", settings: [] },
    other: { type: "other", name: "Other", settings: [] },
  },
};

/**
 * s1 box (max 2): a leaf, b group (max 1) { b1 leaf }
 * s2 free:        c leaf, x other, d group { d1 leaf { d2 leaf } }   (d2 is at depth 3)
 * s3 free:        empty
 */
function sample(): TemplateDocument {
  return doc({
    s1: node("box", { a: node("leaf"), b: node("group", { b1: node("leaf") }) }),
    s2: node("free", {
      c: node("leaf", {}, { disabled: true }),
      x: node("other"),
      d: node("group", { d1: node("leaf", { d2: node("leaf") }) }),
    }),
    s3: node("free"),
  });
}

describe("canMove decision matrix [AC-ENG-009]", () => {
  const can = (id: string, parent: string | null, index = 0, reg: ComponentRegistry | undefined = registry) =>
    canMove(sample(), id, parent, index, reg);

  it("[AC-ENG-009] accepts: a type the parent does not accept is refused, an unrestricted parent takes anything", () => {
    const refused = can("x", "s1");
    expect(refused.allowed).toBe(false);
    expect(refused.reason).toMatch(/accept/i);
    expect(can("x", "s3").allowed).toBe(true);
    // Block parents have their own accepts list.
    expect(can("x", "b").allowed).toBe(false);
    expect(can("c", "s3").allowed).toBe(true);
  });

  it("[AC-ENG-009] maxChildren: a full section or block refuses another child, and a same-parent reorder is still allowed", () => {
    const full = can("c", "s1");
    expect(full.allowed).toBe(false);
    expect(full.reason).toMatch(/children|full|max/i);
    expect(can("c", "b").allowed).toBe(false);
    // Reordering inside the full parent does not add a child.
    expect(can("a", "s1", 1).allowed).toBe(true);
    expect(can("b1", "b", 0).allowed).toBe(true);
    // A parent below its limit accepts: remove one child first.
    expect(canMove(removeNode(sample(), "a"), "c", "s1", 0, registry).allowed).toBe(true);
  });

  it("[AC-ENG-009] a move out of a full parent is judged by the target alone: a full block refuses it, a roomy section takes it", () => {
    // The same-parent reorder inside a full parent and a move from another parent into one are pinned by the
    // maxChildren case above. s1 is full (a, b); moving a from s1 to inside b is refused by b's own max, not by s1.
    expect(can("a", "b").allowed).toBe(false);
    expect(can("a", "s3").allowed).toBe(true);
  });

  it("[AC-ENG-009] depth: a move is refused when the moved subtree would end deeper than 3", () => {
    // d has two levels below it; under a depth-1 block it would reach depth 4.
    expect(can("d", "a").allowed).toBe(false);
    expect(can("d", "a").reason).toMatch(/depth/i);
    // Under a section (depth 0) it reaches depth 3: allowed.
    expect(can("d", "s3").allowed).toBe(true);
    // d1 has one level below it: under a (depth 1) it reaches 3, under d2 (depth 3) it would reach 5.
    expect(can("d1", "a").allowed).toBe(true);
    expect(can("d1", "d2").allowed).toBe(false);
    // A leaf can sit at depth 3 but not 4.
    expect(can("c", "d1").allowed).toBe(true);
    expect(can("c", "d2").allowed).toBe(false);
  });

  it("[AC-ENG-009] cycles: into itself, into a child and into a deep descendant are refused", () => {
    expect(can("d", "d").allowed).toBe(false);
    expect(can("d", "d1").allowed).toBe(false);
    expect(can("d", "d2").allowed).toBe(false);
    expect(can("d", "d").reason).toMatch(/itself|descendant/i);
    expect(can("d1", "d2").allowed).toBe(false);
  });

  it("[AC-ENG-009] a missing node, a missing parent and prototype names are refused", () => {
    expect(can("nope", "s1").allowed).toBe(false);
    expect(can("c", "nope").allowed).toBe(false);
    expect(can("c", "nope").reason).toMatch(/not found/i);
    for (const name of ["constructor", "__proto__", "toString", "hasOwnProperty"]) {
      expect(can(name, "s1").allowed).toBe(false);
      expect(can("c", name).allowed).toBe(false);
    }
  });

  it("[AC-ENG-009] sections only live at the root, blocks never do", () => {
    expect(can("s3", "s1").allowed).toBe(false);
    expect(can("s3", "a").allowed).toBe(false);
    expect(can("s3", "nope").allowed).toBe(false);
    expect(can("c", null).allowed).toBe(false);
    expect(can("s3", null, 0).allowed).toBe(true);
    expect(can("s3", null, 2).allowed).toBe(true);
  });

  it("[AC-ENG-009] a disabled node moves like any other, and keeps its disabled flag", () => {
    expect(can("c", "s3").allowed).toBe(true);
    const moved = moveNode(sample(), "c", "s3", 0);
    expect(moved.sections.s3.blocks.c.disabled).toBe(true);
  });

  // Changed by final-review item 9: the index is a real position (0 through the sibling count after removal),
  // not something clamped silently; the rejections are covered in engine-tree-guards.test.ts.
  it("[AC-ENG-009] canMove accepts exactly the positions 0..n; moveNode puts the node there", () => {
    for (const index of [0, 1]) expect(can("a", "s1", index).allowed).toBe(true);
    for (const index of [-5, 2, 3, 99, Number.NaN]) expect(can("a", "s1", index).allowed).toBe(false);
    const order = (index: number) => moveNode(sample(), "a", "s1", index).sections.s1.block_order;
    expect(order(0)).toEqual(["a", "b"]);
    expect(order(1)).toEqual(["b", "a"]); // n = 1 after removal: the last position
    expect(() => order(2)).toThrow(/index/i);
    expect(() => order(99)).toThrow(/index/i);
    expect(moveNode(sample(), "s3", null, 0).order).toEqual(["s3", "s1", "s2"]);
    expect(moveNode(sample(), "s1", null, 2).order).toEqual(["s2", "s3", "s1"]);
    expect(() => moveNode(sample(), "s3", null, -3)).toThrow(/index/i);
    expect(() => moveNode(sample(), "s1", null, 99)).toThrow(/index/i);
  });

  it("[AC-ENG-009] the component limit is not a reason to refuse a move: a move never changes the component count", () => {
    const bulk = doc(
      Object.fromEntries(
        Array.from({ length: 8 }, (_, s) => [
          `s${s}`,
          node("free", Object.fromEntries(Array.from({ length: 49 }, (_, b) => [`s${s}b${b}`, node("leaf")]))),
        ]),
      ),
    );
    expect(countComponents(bulk)).toBe(LIMITS.maxComponentsPerTemplate);
    expect(canMove(bulk, "s0b0", "s1", 0, registry).allowed).toBe(true);
    expect(countComponents(moveNode(bulk, "s0b0", "s1", 0))).toBe(LIMITS.maxComponentsPerTemplate);
  });

  it("[AC-ENG-009] blocks per section: a move into a section that would pass 50 blocks is refused, a reorder or a move with room is not", () => {
    const leaves = (prefix: string, n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`${prefix}${i}`, node("leaf")]));
    const bulk = doc({
      full: node("free", leaves("f", 50)),
      near: node("free", leaves("n", 47)),
      src: node("free", { one: node("leaf"), trio: node("group", { t1: node("leaf"), t2: node("leaf") }) }),
    });
    // 50 blocks already: any block from another section is one too many; a reorder inside it adds none.
    expect(canMove(bulk, "one", "full", 0).allowed).toBe(false);
    expect(canMove(bulk, "one", "full", 0).reason).toMatch(/50 blocks/);
    expect(canMove(bulk, "f0", "f1", 0).allowed).toBe(true);
    // Room for exactly three more in `near`: the three-node subtree fits, a fourth block would not.
    expect(canMove(bulk, "trio", "near", 0).allowed).toBe(true);
    expect(canMove(bulk, "one", "n0", 0).allowed).toBe(true);
    const nearFull = moveNode(bulk, "trio", "near", 0);
    expect(canMove(nearFull, "one", "near", 0).allowed).toBe(false);
    expect(() => moveNode(nearFull, "one", "near", 0)).toThrow(/50 blocks/);
    // Moving out of a full section into a roomy one is fine.
    expect(canMove(bulk, "f0", "src", 0).allowed).toBe(true);
    expect(countComponents(moveNode(bulk, "f0", "src", 0))).toBe(countComponents(bulk));
  });

  it("[AC-ENG-009] moveNode enforces the registry rules when it is given the registry, and throws before changing anything", () => {
    const original = deepFreeze(sample());
    expect(() => moveNode(original, "x", "s1", 0, registry)).toThrow(/accept/i);
    expect(() => moveNode(original, "c", "s1", 0, registry)).toThrow(/children|max/i);
    expect(() => moveNode(original, "d", "a", 0, registry)).toThrow(/depth/i);
    expect(() => moveNode(original, "d", "d1", 0, registry)).toThrow(/itself|descendant/i);
    expect(() => moveNode(original, "c", "s3", 0, registry)).not.toThrow();
  });
});

describe("move, add, remove and duplicate preserve ids, settings and order [AC-ENG-010]", () => {
  const rich = (): TemplateDocument =>
    doc({
      s1: node("box", {
        a: { ...node("leaf"), settings: { text: "A", nested: { deep: [1, 2, { z: true }] } } },
        b: node("group", { b1: { ...node("leaf", {}, { disabled: true }), settings: { text: "B1" } }, b2: node("leaf") }),
      }),
      s2: node("free", { c: node("leaf") }),
    });

  it("[AC-ENG-010] no operation mutates its input (deep-frozen input)", () => {
    const frozen = deepFreeze(rich());
    const snapshot = JSON.stringify(frozen);
    moveNode(frozen, "b", "s2", 0);
    moveNode(frozen, "s2", null, 0);
    addNode(frozen, "s1", node("leaf"), 0, "new1");
    addNode(frozen, null, node("free"));
    removeNode(frozen, "b");
    removeNode(frozen, "s1");
    duplicateNode(frozen, "b");
    duplicateNode(frozen, "s1");
    expect(JSON.stringify(frozen)).toBe(snapshot);
  });

  it("[AC-ENG-010] moveNode keeps every id, every setting, the disabled flag and the sibling order, and moves the whole subtree", () => {
    const before = rich();
    const after = moveNode(before, "b", "s2", 0);
    expect(after.sections.s2.block_order).toEqual(["b", "c"]);
    expect(after.sections.s1.block_order).toEqual(["a"]);
    expect(after.sections.s2.blocks.b.block_order).toEqual(["b1", "b2"]);
    expect(after.sections.s2.blocks.b.blocks.b1).toEqual(before.sections.s1.blocks.b.blocks.b1);
    expect(after.sections.s2.blocks.b.blocks.b1.disabled).toBe(true);
    expect(after.sections.s1.blocks.a).toEqual(before.sections.s1.blocks.a);
    expect([...allIds(after)].sort()).toEqual([...allIds(before)].sort());
    expect(countComponents(after)).toBe(countComponents(before));
    // Nothing is shared with the input.
    expect(after.sections.s1.blocks.a).not.toBe(before.sections.s1.blocks.a);
    expect(after.sections.s2.blocks.b.blocks.b1.settings).not.toBe(before.sections.s1.blocks.b.blocks.b1.settings);
  });

  it("[AC-ENG-010] moving a section keeps its content and reorders only the root", () => {
    const before = rich();
    const after = moveNode(before, "s2", null, 0);
    expect(after.order).toEqual(["s2", "s1"]);
    expect(after.sections.s1).toEqual(before.sections.s1);
    expect(after.sections.s2).toEqual(before.sections.s2);
  });

  it("[AC-ENG-010] addNode keeps the new node's content, honours the index, keeps existing order and does not alias the argument", () => {
    const before = rich();
    const fresh: ComponentNode = { ...node("leaf", {}, { disabled: true }), settings: { text: "N", list: [1, 2] } };
    const { doc: after, id } = addNode(before, "s1", fresh, 1, "mine");
    expect(id).toBe("mine");
    expect(after.sections.s1.block_order).toEqual(["a", "mine", "b"]);
    expect(after.sections.s1.blocks.mine).toEqual(fresh);
    expect(after.sections.s1.blocks.mine).not.toBe(fresh);
    expect(after.sections.s1.blocks.mine.settings).not.toBe(fresh.settings);
    expect(after.sections.s1.blocks.a).toEqual(before.sections.s1.blocks.a);

    const appended = addNode(before, "s1", node("leaf"));
    expect(appended.doc.sections.s1.block_order).toEqual(["a", "b", appended.id]);
    expect(appended.id).toMatch(/^blk_[0-9a-f]{12}$/);
    const newSection = addNode(before, null, node("free"), 0);
    expect(newSection.doc.order).toEqual([newSection.id, "s1", "s2"]);
    expect(newSection.id).toMatch(/^sec_[0-9a-f]{12}$/);
    expect(() => addNode(before, "missing", node("leaf"))).toThrow(/not found/i);
  });

  it("[AC-ENG-010] removeNode drops the whole subtree, keeps the other ids and order, and ignores a missing id", () => {
    const before = rich();
    const after = removeNode(before, "b");
    expect(allIds(after)).toEqual(["s1", "a", "s2", "c"]);
    expect(after.sections.s1.block_order).toEqual(["a"]);
    expect(after.order).toEqual(["s1", "s2"]);
    expect(removeNode(before, "s1").order).toEqual(["s2"]);
    expect(removeNode(before, "missing")).toEqual(before);
    expect(removeNode(before, "missing")).not.toBe(before);
  });

  it("[AC-ENG-010] duplicateNode gives every copied node a fresh id, that matches no original and no other id", () => {
    const before = rich();
    const { doc: after, newId } = duplicateNode(before, "b");
    const originalIds = new Set(allIds(before));
    const afterIds = allIds(after);
    expect(new Set(afterIds).size).toBe(afterIds.length);
    const copy = after.sections.s1.blocks[newId];
    expect(after.sections.s1.block_order).toEqual(["a", "b", newId]);
    const copyIds = allIds(doc({ [newId]: copy }));
    expect(copyIds).toHaveLength(3);
    for (const id of copyIds) expect(originalIds.has(id)).toBe(false);
    expect(afterIds).toHaveLength(originalIds.size + 3);
  });

  it("[AC-ENG-010] duplicateNode copies settings and disabled by value, not by reference, in the same order", () => {
    const before = rich();
    const { doc: after, newId } = duplicateNode(before, "b");
    const copy = after.sections.s1.blocks[newId];
    const original = after.sections.s1.blocks.b;
    expect(copy.block_order).toHaveLength(2);
    const [c1, c2] = copy.block_order.map((id) => copy.blocks[id]);
    expect(c1.settings).toEqual({ text: "B1" });
    expect(c1.settings).not.toBe(original.blocks.b1.settings);
    expect(c1.disabled).toBe(true);
    expect(c2.disabled).toBeUndefined();
    expect(copy.type).toBe("group");

    const a = duplicateNode(before, "a");
    const copyA = a.doc.sections.s1.blocks[a.newId];
    expect(copyA.settings).toEqual(before.sections.s1.blocks.a.settings);
    expect(copyA.settings).not.toBe(a.doc.sections.s1.blocks.a.settings);
    (copyA.settings.nested as { deep: unknown[] }).deep.push("mutated");
    expect((a.doc.sections.s1.blocks.a.settings.nested as { deep: unknown[] }).deep).toHaveLength(3);
  });

  it("[AC-ENG-010] duplicating a section places it right after the original with fresh ids all the way down", () => {
    const before = rich();
    const { doc: after, newId } = duplicateNode(before, "s1");
    expect(after.order).toEqual(["s1", newId, "s2"]);
    const ids = allIds(after);
    expect(new Set(ids).size).toBe(ids.length);
    expect(after.sections[newId].block_order).toHaveLength(2);
    expect(after.sections[newId].type).toBe("box");
    expect(() => duplicateNode(before, "missing")).toThrow(/not found/i);
  });

  it("[AC-ENG-010] a colliding id generator can never produce a duplicate id", () => {
    const before = rich();
    const existing = allIds(before);
    let calls = 0;
    const collidingFirst = (prefix?: string) => (calls++ === 0 ? "a" : generateId(prefix));
    const { doc: after } = duplicateNode(before, "s1", collidingFirst);
    const ids = allIds(after);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(existing.length + 5);
    expect(calls).toBeGreaterThan(5);
    // A generator that can only repeat itself is an error, not an infinite loop or a duplicate.
    expect(() => duplicateNode(before, "a", () => "b")).toThrow(/unique|id/i);
  });

  it("[AC-ENG-010] an id generator that returns a non-string, an empty or a blank string is rejected, never stored as a key", () => {
    const before = deepFreeze(rich());
    const snapshot = JSON.stringify(before);
    const broken: [string, () => string][] = [
      ["undefined", () => undefined as unknown as string],
      ["null", () => null as unknown as string],
      ["number", () => 7 as unknown as string],
      ["object", () => ({}) as unknown as string],
      ["empty", () => ""],
      ["blank", () => "   "],
      ["tab", () => "\t\n"],
    ];
    for (const [name, generator] of broken) {
      for (const target of ["a", "b", "s1"]) {
        expect(() => duplicateNode(before, target, generator), `${name} on ${target}`).toThrow(/id generator.*(invalid|empty|string)/i);
      }
    }
    expect(JSON.stringify(before)).toBe(snapshot);
    // A generator that fails only for the children of a subtree still leaves the input untouched.
    let calls = 0;
    const failsLater = (prefix?: string) => (calls++ < 1 ? generateId(prefix) : (undefined as unknown as string));
    expect(() => duplicateNode(before, "b", failsLater)).toThrow(/id generator/i);
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it("[AC-ENG-010] the limit pre-check counts only the nodes the copy creates: children missing from block_order are not counted", () => {
    // `g` has five children that block_order does not list; duplicate drops them, so the copy is one node.
    const orphans = Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`o${i}`, node("leaf")]));
    const g: ComponentNode = { ...node("group", orphans), block_order: [] };
    const leaves = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`l${i}`, node("leaf")]));
    // Section total today: 40 leaves + g + 5 orphans = 46 blocks; the copy adds exactly 1 (47), never 6 (52 > 50).
    const bulk = doc({ s: node("free", { ...leaves, g }) });
    const { doc: after, newId } = duplicateNode(bulk, "g");
    const copy = after.sections.s.blocks[newId];
    expect(copy.block_order).toEqual([]);
    expect(Object.keys(copy.blocks)).toEqual([]);
    expect(Object.keys(after.sections.s.blocks)).toHaveLength(42);

    // Orphans are not a reason to refuse the component limit either: 396 components + 1 copy = 397, not 402.
    const manySections = Object.fromEntries(
      Array.from({ length: 7 }, (_, s) => [`m${s}`, node("free", Object.fromEntries(Array.from({ length: 49 }, (_, b) => [`m${s}b${b}`, node("leaf")])))]),
    );
    const filler = Object.fromEntries(Array.from({ length: 39 }, (_, i) => [`t${i}`, node("leaf")]));
    const nearLimit = doc({ ...manySections, tail: node("free", { g: { ...node("group", orphans), block_order: [] }, ...filler }) });
    expect(countComponents(nearLimit)).toBe(7 * 50 + 1 + 1 + 5 + 39);
    expect(countComponents(duplicateNode(nearLimit, "g").doc)).toBe(397);

    // The exact count still refuses what really does not fit: ordered children are copied and counted.
    const listed = Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`k${i}`, node("leaf")]));
    const real = doc({ s: node("free", { ...leaves, g: node("group", listed) }) });
    expect(() => duplicateNode(real, "g")).toThrow(/50 blocks/);
  });

  describe("duplicate respects the limits", () => {
    const sections = (n: number, blocksEach = 0) =>
      doc(
        Object.fromEntries(
          Array.from({ length: n }, (_, s) => [
            `s${s}`,
            node("free", Object.fromEntries(Array.from({ length: blocksEach }, (_, b) => [`s${s}b${b}`, node("leaf")]))),
          ]),
        ),
      );

    it("[AC-ENG-010] section limit: the 25th section can be duplicated into, the 26th cannot", () => {
      expect(Object.keys(duplicateNode(sections(LIMITS.maxSectionsPerTemplate - 1), "s0").doc.sections)).toHaveLength(25);
      expect(() => duplicateNode(sections(LIMITS.maxSectionsPerTemplate), "s0")).toThrow(/section/i);
    });

    it("[AC-ENG-010] component limit: duplicating up to exactly 400 works, one more throws", () => {
      // 7 sections of 49 blocks = 7 x 50 = 350 components, plus a section with 48 blocks (49) = 399.
      const at399 = sections(7, 49);
      at399.sections.last = node("free", Object.fromEntries(Array.from({ length: 48 }, (_, b) => [`l${b}`, node("leaf")])));
      at399.order.push("last");
      expect(countComponents(at399)).toBe(399);
      const ok = duplicateNode(at399, "l0");
      expect(countComponents(ok.doc)).toBe(LIMITS.maxComponentsPerTemplate);
      expect(() => duplicateNode(ok.doc, "l0")).toThrow(/400|component/i);
      // A subtree that does not fit is refused as a whole, while a single block still fits.
      const trimmed = removeNode(removeNode(at399, "l0"), "l1");
      const withGroup = addNode(trimmed, "last", node("group", { g1: node("leaf") }), 0, "grp").doc;
      expect(countComponents(withGroup)).toBe(399);
      expect(() => duplicateNode(withGroup, "grp")).toThrow(/component/i);
      expect(countComponents(duplicateNode(withGroup, "l5").doc)).toBe(LIMITS.maxComponentsPerTemplate);
    });

    it("[AC-ENG-010] blocks-per-section limit: the 50th block can be duplicated into, the 51st cannot", () => {
      const ok = duplicateNode(sections(1, LIMITS.maxBlocksPerSection - 1), "s0b0");
      expect(ok.doc.sections.s0.block_order).toHaveLength(50);
      expect(() => duplicateNode(sections(1, LIMITS.maxBlocksPerSection), "s0b0")).toThrow(/block/i);
      // Nested blocks count towards the section total too.
      const nested = sections(1, 49);
      nested.sections.s0.blocks.s0b0.blocks.n1 = node("leaf");
      nested.sections.s0.blocks.s0b0.block_order = ["n1"];
      expect(() => duplicateNode(nested, "s0b1")).toThrow(/block/i);
    });

    it("[AC-ENG-010] maxChildren: a full parent refuses a duplicate when the registry says so, and takes it below the limit", () => {
      const d = sample();
      expect(() => duplicateNode(d, "a", generateId, registry)).toThrow(/children|max/i);
      expect(() => duplicateNode(d, "b1", generateId, registry)).toThrow(/children|max/i);
      expect(duplicateNode(d, "c", generateId, registry).doc.sections.s2.block_order).toHaveLength(4);
      // Without a registry nothing is known about maxChildren: the duplicate is made.
      expect(duplicateNode(d, "a").doc.sections.s1.block_order).toHaveLength(3);
    });

    it("[AC-ENG-010] a refused duplicate leaves the input untouched", () => {
      const full = deepFreeze(sections(LIMITS.maxSectionsPerTemplate));
      const snapshot = JSON.stringify(full);
      expect(() => duplicateNode(full, "s0")).toThrow();
      expect(JSON.stringify(full)).toBe(snapshot);
    });
  });

  it("[AC-ENG-010] depth is unchanged by duplicate: the copy sits at its original's depth", () => {
    const { doc: after, newId } = duplicateNode(sample(), "d1");
    expect(depthOf(after, newId)).toBe(depthOf(after, "d1"));
    expect(findNode(after, newId)?.parentId).toBe("d");
  });
});
