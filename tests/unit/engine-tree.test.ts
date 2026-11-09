import { describe, expect, it } from "vitest";
import type { TemplateDocument } from "../../lib/templates/document";
import {
  addNode,
  canMove,
  countComponents,
  depthOf,
  duplicateNode,
  findNode,
  moveNode,
  removeNode,
} from "../../lib/templates/engine/tree";
import { getRegistry } from "../../lib/templates/registry/index";

describe("Engine Tree Operations [AC-ENG-009] [AC-ENG-010]", () => {
  const registry = getRegistry();

  const createTestDoc = (): TemplateDocument => ({
    schemaVersion: 1,
    layout: "classic",
    sections: {
      hero: {
        type: "hero",
        settings: { heading: "Welcome" },
        blocks: {
          b1: {
            type: "text",
            settings: { content: "Text 1" },
            blocks: {
              b1_child: {
                type: "text",
                settings: { content: "Nested" },
                blocks: {},
                block_order: [],
              },
            },
            block_order: ["b1_child"],
          },
          b2: {
            type: "button",
            settings: { text: "Click" },
            blocks: {},
            block_order: [],
          },
        },
        block_order: ["b1", "b2"],
      },
      products: {
        type: "product-grid",
        settings: { columns: 4 },
        blocks: {},
        block_order: [],
      },
    },
    order: ["hero", "products"],
  });

  it("[AC-ENG-009] canMove rejects cycles: moving a node into itself or its descendant", () => {
    const doc = createTestDoc();

    // Trying to move b1 into b1
    expect(canMove(doc, "b1", "b1", 0, registry).allowed).toBe(false);

    // Trying to move b1 into b1_child (its descendant)
    expect(canMove(doc, "b1", "b1_child", 0, registry).allowed).toBe(false);

    // Moving b2 into b1 is allowed
    expect(canMove(doc, "b2", "b1", 0, registry).allowed).toBe(true);
  });

  it("[AC-ENG-009] canMove prevents exceeding max depth (3)", () => {
    const doc = createTestDoc();
    // b1 is depth 1, b1_child is depth 2.
    // If we add another block b1_grandchild under b1_child, it's depth 3.
    const docWithGrandchild = addNode(doc, "b1_child", {
      type: "text",
      settings: {},
      blocks: {},
      block_order: [],
    }, 0, "b1_grandchild").doc;

    expect(depthOf(docWithGrandchild, "b1_grandchild")).toBe(3);

    // Trying to move a block with children under b1_grandchild would exceed depth 3
    expect(canMove(docWithGrandchild, "b1", "b1_grandchild", 0, registry).allowed).toBe(false);
  });

  it("[AC-ENG-010] moveNode preserves IDs, settings, and updates parent orders", () => {
    const doc = createTestDoc();

    // Move b2 before b1 in the same hero section
    const reordered = moveNode(doc, "b2", "hero", 0);
    expect(reordered.sections.hero.block_order).toEqual(["b2", "b1"]);
    expect(reordered.sections.hero.blocks.b2.settings).toEqual({ text: "Click" });

    // Move b2 from hero into b1
    const movedToChild = moveNode(doc, "b2", "b1", 0);
    expect(movedToChild.sections.hero.block_order).toEqual(["b1"]);
    expect(movedToChild.sections.hero.blocks.b1.block_order).toEqual(["b2", "b1_child"]);
    expect(movedToChild.sections.hero.blocks.b1.blocks.b2.settings).toEqual({ text: "Click" });
  });

  it("[AC-ENG-010] addNode and removeNode work immutably and update order", () => {
    const doc = createTestDoc();

    // Add new section
    const { doc: withNewSec, id: newSecId } = addNode(doc, null, {
      type: "hero",
      settings: { heading: "Second Hero" },
      blocks: {},
      block_order: [],
    });
    expect(withNewSec.order).toContain(newSecId);
    expect(withNewSec.sections[newSecId].settings.heading).toBe("Second Hero");

    // Remove section
    const removed = removeNode(withNewSec, newSecId);
    expect(removed.order).not.toContain(newSecId);
    expect(removed.sections[newSecId]).toBeUndefined();
  });

  it("[AC-ENG-010] duplicateNode generates fresh IDs for duplicated node and its children", () => {
    const doc = createTestDoc();
    const initialCount = countComponents(doc);

    // Duplicate b1 (which has child b1_child)
    const { doc: dupDoc, newId } = duplicateNode(doc, "b1");

    expect(newId).not.toBe("b1");
    expect(dupDoc.sections.hero.block_order).toEqual(["b1", newId, "b2"]);

    const dupBlock = dupDoc.sections.hero.blocks[newId];
    expect(dupBlock.settings).toEqual({ content: "Text 1" });

    // The child block must also have a fresh ID!
    expect(dupBlock.block_order.length).toBe(1);
    const dupChildId = dupBlock.block_order[0];
    expect(dupChildId).not.toBe("b1_child");
    expect(dupBlock.blocks[dupChildId].settings).toEqual({ content: "Nested" });

    // Component count increased by 2 (b1 and b1_child)
    expect(countComponents(dupDoc)).toBe(initialCount + 2);
  });
});

describe("Engine Tree Operations never resolve prototype member names [AC-ENG-009] [AC-ENG-010]", () => {
  const registry = getRegistry();
  const NAMES = ["constructor", "__proto__", "toString", "hasOwnProperty", "valueOf"];
  const blank = (type = "text") => ({ type, settings: {}, blocks: {}, block_order: [] as string[] });
  const baseDoc = (): TemplateDocument => ({
    schemaVersion: 1,
    layout: "classic",
    sections: { hero: { ...blank("hero"), blocks: { b1: blank() }, block_order: ["b1"] } },
    order: ["hero"],
  });
  /** Runs `fn` and fails when it left any property behind on the shared prototypes. */
  function withoutPollution<T>(fn: () => T): T {
    try {
      return fn();
    } finally {
      const polluted = ["blocks", "block_order", "settings", "type"].filter(
        (k) => Object.hasOwn(Object.prototype, k) || Object.hasOwn(Object, k) || Object.hasOwn(Function.prototype, k),
      );
      for (const k of polluted) {
        delete (Object.prototype as Record<string, unknown>)[k];
        delete (Object as unknown as Record<string, unknown>)[k];
        delete (Function.prototype as unknown as Record<string, unknown>)[k];
      }
      expect(polluted).toEqual([]);
    }
  }

  for (const name of NAMES) {
    it(`[AC-ENG-009] "${name}" is not a node: findNode, depthOf, canMove, moveNode, removeNode, duplicateNode`, () => {
      withoutPollution(() => {
        const doc = baseDoc();
        const before = JSON.stringify(doc);
        expect(findNode(doc, name)).toBeNull();
        expect(depthOf(doc, name)).toBe(-1);
        expect(canMove(doc, name, "hero", 0, registry)).toEqual({ allowed: false, reason: "Node not found" });
        expect(canMove(doc, "b1", name, 0, registry)).toEqual({ allowed: false, reason: "Target parent not found" });
        expect(() => moveNode(doc, name, "hero", 0)).toThrow(/Node not found/);
        expect(() => moveNode(doc, "b1", name, 0)).toThrow(/Target parent not found/);
        expect(JSON.stringify(removeNode(doc, name))).toBe(before);
        expect(() => duplicateNode(doc, name)).toThrow(/not found/);
        expect(JSON.stringify(doc)).toBe(before);
      });
    });

    it(`[AC-ENG-010] addNode with target parent "${name}" throws and pollutes nothing`, () => {
      withoutPollution(() => {
        expect(() => addNode(baseDoc(), name, blank(), 0)).toThrow(/Target parent not found/);
      });
    });

    it(`[AC-ENG-010] a registry type named "${name}" is not a definition in canMove`, () => {
      const doc = baseDoc();
      doc.sections.hero.type = name;
      expect(canMove(doc, "b1", "hero", 0, registry)).toEqual({ allowed: true });
    });
  }

  // Changed (Task 13): `__proto__` is never a legitimate node id, so a document that holds such a key is not
  // navigable through it (it used to be found, moved and removed like any other id).
  it("[AC-ENG-010] an own `__proto__` section key is not a node: it is not found, moved or removed", () => {
    const sections = JSON.parse('{"__proto__": {"type":"hero","settings":{},"blocks":{},"block_order":[]}, "other": {"type":"hero","settings":{},"blocks":{},"block_order":[]}}');
    const doc: TemplateDocument = { schemaVersion: 1, layout: "classic", sections, order: ["__proto__", "other"] };
    expect(findNode(doc, "__proto__")).toBeNull();
    expect(() => moveNode(doc, "__proto__", null, 1)).toThrow(/Node not found/);
    expect(findNode(doc, "other")?.isSection).toBe(true);
  });

  it("[AC-ENG-010] addNode with the custom id `__proto__` throws as an unsafe id and changes nothing", () => {
    const doc = baseDoc();
    const before = JSON.stringify(doc);
    expect(() => addNode(doc, null, blank("hero"), undefined, "__proto__")).toThrow(/id must be/);
    expect(JSON.stringify(doc)).toBe(before);
  });

  it("[AC-ENG-010] normal ids behave exactly as before", () => {
    const doc = baseDoc();
    expect(findNode(doc, "hero")).toMatchObject({ isSection: true, depth: 0 });
    expect(findNode(doc, "b1")).toMatchObject({ isSection: false, depth: 1, parentId: "hero" });
    expect(canMove(doc, "b1", "hero", 0, registry).allowed).toBe(true);
  });
});
