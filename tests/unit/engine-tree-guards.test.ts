import { describe, expect, it } from "vitest";
import type { ComponentNode, TemplateDocument } from "../../lib/templates/document";
import { addNode, canMove, findNode, moveNode } from "../../lib/templates/engine/tree";

// Final-review fixes 4 and 9: addNode never overwrites or duplicates an id, and move indexes must be real positions.
const node = (type: string, children: Record<string, ComponentNode> = {}): ComponentNode => ({
  type,
  settings: {},
  blocks: children,
  block_order: Object.keys(children),
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

/** s: hero { b1 card { b2 card }, b3 card }, t: hero (empty) */
const sample = (): TemplateDocument =>
  doc({
    s: node("hero", { b1: node("card", { b2: node("card") }), b3: node("card") }),
    t: node("hero"),
  });

const snapshot = (d: TemplateDocument) => JSON.stringify(d);

describe("addNode refuses an id that already exists anywhere in the document [AC-ENG-010]", () => {
  const frozen = deepFreeze(sample());
  const before = snapshot(frozen);

  const collisions: { label: string; parent: string | null; id: string }[] = [
    { label: "an existing section id as a new section", parent: null, id: "s" },
    { label: "an existing section id as a block", parent: "t", id: "s" },
    { label: "an existing block id as a section", parent: null, id: "b1" },
    { label: "an existing block id as a block in the same parent", parent: "s", id: "b3" },
    { label: "an existing block id as a block in another section", parent: "t", id: "b3" },
    { label: "an existing nested block id as a block", parent: "t", id: "b2" },
    { label: "an id equal to the parent's own id", parent: "t", id: "t" },
  ];
  for (const { label, parent, id } of collisions) {
    it(`[AC-ENG-010] ${label} throws and leaves the document unchanged`, () => {
      expect(() => addNode(frozen, parent, node("card"), 0, id)).toThrow(/already (exists|used)|duplicate/i);
      expect(snapshot(frozen)).toBe(before);
    });
  }

  it("[AC-ENG-010] the original section is not replaced and order never lists an id twice", () => {
    expect(() => addNode(frozen, null, node("hero"), 0, "s")).toThrow();
    const ok = addNode(frozen, null, node("hero"), 0, "fresh");
    expect(ok.doc.order).toEqual(["fresh", "s", "t"]);
    expect(new Set(ok.doc.order).size).toBe(ok.doc.order.length);
    expect(Object.keys(ok.doc.sections.s.blocks)).toEqual(["b1", "b3"]);
  });

  it("[AC-ENG-010] a generated id never collides with an existing one", () => {
    let current = sample();
    const seen = new Set(["s", "t", "b1", "b2", "b3"]);
    for (let i = 0; i < 50; i++) {
      const added = addNode(current, "t", node("card"));
      expect(seen.has(added.id)).toBe(false);
      seen.add(added.id);
      current = added.doc;
    }
  });
});

describe("addNode accepts only a non-empty safe string as a custom id [AC-ENG-010]", () => {
  const bad: unknown[] = ["", "   ", "has space", "dot.ted", "tab\there", "a/b", "x".repeat(129), 123, null, {}, [], true];
  for (const id of bad) {
    it(`[AC-ENG-010] custom id ${JSON.stringify(id) ?? String(id)} is refused and the document is unchanged`, () => {
      const frozen = deepFreeze(sample());
      const before = snapshot(frozen);
      expect(() => addNode(frozen, null, node("hero"), 0, id as string)).toThrow(/id/i);
      expect(() => addNode(frozen, "t", node("card"), 0, id as string)).toThrow(/id/i);
      expect(snapshot(frozen)).toBe(before);
    });
  }

  it("[AC-ENG-010] ordinary ids (letters, digits, - and _) are accepted", () => {
    for (const id of ["new1", "blk_1a2b", "Hero-2", "a", "x".repeat(128)]) {
      expect(addNode(sample(), "t", node("card"), 0, id).id).toBe(id);
    }
  });

  // Changed (Task 13): `__proto__` left this list: it is refused as an unsafe id (engine-proto-ids.test.ts). The
  // other prototype names stay ordinary ids.
  it("[AC-ENG-010] `constructor`, `toString` and `valueOf` ids are stored as own keys, once, and collide like any id", () => {
    for (const id of ["constructor", "toString", "valueOf"]) {
      const first = addNode(sample(), null, node("hero"), undefined, id);
      expect(Object.hasOwn(first.doc.sections, id)).toBe(true);
      expect(Object.getPrototypeOf(first.doc.sections)).toBe(Object.prototype);
      expect(() => addNode(first.doc, null, node("hero"), undefined, id)).toThrow(/already|duplicate/i);
      expect(() => addNode(first.doc, "t", node("card"), undefined, id)).toThrow(/already|duplicate/i);
      expect(first.doc.order.filter((x) => x === id)).toHaveLength(1);
    }
  });
});

describe("canMove and moveNode accept only a real position [AC-ENG-009]", () => {
  // s has two children (b1, b3), t has none. Valid positions: 0..n, n = children left after the moved node is removed.
  const reasonFor = (index: number, nodeId = "b1", target: string | null = "s") => canMove(sample(), nodeId, target, index);

  const invalid: { label: string; index: number }[] = [
    { label: "NaN", index: Number.NaN },
    { label: "Infinity", index: Number.POSITIVE_INFINITY },
    { label: "-Infinity", index: Number.NEGATIVE_INFINITY },
    { label: "a fraction", index: 0.5 },
    // Negative zero used to be listed here. Rewritten (round 3, item 3): the approved rule now accepts -0 as 0,
    // see the "negative zero" test below.
    { label: "a negative number", index: -1 },
    { label: "far past the end", index: 99 },
    { label: "one past the end", index: 2 },
  ];
  for (const { label, index } of invalid) {
    it(`[AC-ENG-009] ${label} is refused by canMove with a reason and by moveNode with an error`, () => {
      const check = reasonFor(index);
      expect(check.allowed).toBe(false);
      expect(check.reason).toMatch(/index|position/i);
      const frozen = deepFreeze(sample());
      expect(() => moveNode(frozen, "b1", "s", index)).toThrow(/index|position/i);
    });
  }

  it("[AC-ENG-009] positions 0..n are accepted: a same-parent reorder (n = 1) and a move to another parent (n = 0 and n = 1)", () => {
    expect(reasonFor(0).allowed).toBe(true);
    expect(reasonFor(1).allowed).toBe(true);
    expect(moveNode(sample(), "b1", "s", 1).sections.s.block_order).toEqual(["b3", "b1"]);
    expect(moveNode(sample(), "b1", "s", 0).sections.s.block_order).toEqual(["b1", "b3"]);
    expect(canMove(sample(), "b3", "t", 0).allowed).toBe(true);
    expect(canMove(sample(), "b3", "t", 1).allowed).toBe(false);
    expect(canMove(sample(), "b3", "b1", 1).allowed).toBe(true);
    expect(canMove(sample(), "b3", "b1", 2).allowed).toBe(false);
  });

  it("[AC-ENG-009] sections follow the same rule against the section list", () => {
    expect(canMove(sample(), "s", null, 0).allowed).toBe(true);
    expect(canMove(sample(), "s", null, 1).allowed).toBe(true);
    for (const index of [2, -1, Number.NaN, 0.5]) {
      const check = canMove(sample(), "s", null, index);
      expect({ index, allowed: check.allowed }).toEqual({ index, allowed: false });
      expect(() => moveNode(sample(), "s", null, index)).toThrow(/index|position/i);
    }
    expect(moveNode(sample(), "s", null, 1).order).toEqual(["t", "s"]);
  });

  it("[AC-ENG-009] negative zero is accepted as 0 by canMove and moveNode (sections and blocks)", () => {
    expect(canMove(sample(), "b1", "s", -0).allowed).toBe(true);
    expect(canMove(sample(), "s", null, -0).allowed).toBe(true);
    expect(moveNode(sample(), "b3", "s", -0).sections.s.block_order).toEqual(["b3", "b1"]);
    expect(moveNode(sample(), "t", null, -0).order).toEqual(["t", "s"]);
  });

  it("[AC-ENG-009] a moved node lands exactly at the requested position", () => {
    const moved = moveNode(sample(), "b3", "b1", 0);
    expect(findNode(moved, "b3")?.parentId).toBe("b1");
    expect(moved.sections.s.blocks.b1.block_order).toEqual(["b3", "b2"]);
  });
});

describe("addNode accepts only a real position, like moveNode [AC-ENG-010]", () => {
  // s has two blocks (b1, b3), the document two sections (s, t): valid positions are 0..2 in both lists.
  const invalid: { label: string; index: unknown }[] = [
    { label: "NaN", index: Number.NaN },
    { label: "Infinity", index: Number.POSITIVE_INFINITY },
    { label: "-Infinity", index: Number.NEGATIVE_INFINITY },
    { label: "a fraction", index: 0.5 },
    { label: "a negative number", index: -1 },
    { label: "one past the end", index: 3 },
    { label: "far past the end", index: 99 },
    { label: "a numeric string", index: "1" },
    { label: "null", index: null },
  ];
  for (const { label, index } of invalid) {
    it(`[AC-ENG-010] ${label} is refused for a block and for a section, and the (frozen) document is unchanged`, () => {
      const frozen = deepFreeze(sample());
      const before = snapshot(frozen);
      expect(() => addNode(frozen, "s", node("card"), index as number)).toThrow(/index|position/i);
      expect(() => addNode(frozen, null, node("hero"), index as number)).toThrow(/index|position/i);
      expect(() => addNode(frozen, "s", node("card"), index as number, "custom")).toThrow(/index|position/i);
      expect(snapshot(frozen)).toBe(before);
    });
  }

  it("[AC-ENG-010] positions 0 through the list length (and -0) place the node exactly there; omitting the index appends", () => {
    const blockOrder = (index?: number) => {
      const res = addNode(sample(), "s", node("card"), index, "n");
      return res.doc.sections.s.block_order;
    };
    expect(blockOrder(0)).toEqual(["n", "b1", "b3"]);
    expect(blockOrder(-0)).toEqual(["n", "b1", "b3"]);
    expect(blockOrder(1)).toEqual(["b1", "n", "b3"]);
    expect(blockOrder(2)).toEqual(["b1", "b3", "n"]);
    expect(blockOrder()).toEqual(["b1", "b3", "n"]);
    const sectionOrder = (index?: number) => addNode(sample(), null, node("hero"), index, "n").doc.order;
    expect(sectionOrder(0)).toEqual(["n", "s", "t"]);
    expect(sectionOrder(-0)).toEqual(["n", "s", "t"]);
    expect(sectionOrder(1)).toEqual(["s", "n", "t"]);
    expect(sectionOrder(2)).toEqual(["s", "t", "n"]);
    expect(sectionOrder()).toEqual(["s", "t", "n"]);
    // An empty parent has exactly one valid position.
    expect(addNode(sample(), "t", node("card"), 0, "n").doc.sections.t.block_order).toEqual(["n"]);
    expect(() => addNode(sample(), "t", node("card"), 1, "n")).toThrow(/index|position/i);
  });
});
