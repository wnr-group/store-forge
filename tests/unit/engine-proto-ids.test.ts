import { describe, expect, it } from "vitest";
import { TEMPLATE_KINDS, type ComponentNode, type TemplateDocument, type TemplateKind } from "../../lib/templates/document";
import { validateDocument, type Issue } from "../../lib/templates/engine/validate";
import { SAFE_NODE_ID_REGEX, collectUsedIds } from "../../lib/templates/engine/tree-ids";
import { addNode, canMove, depthOf, duplicateNode, findNode, moveNode, removeNode } from "../../lib/templates/engine/tree";
import { getRegistry } from "../../lib/templates/registry/index";

// Task 13, gap A: an own `__proto__` key is NEVER a legitimate component id. It is rejected by validateDocument
// (SCHEMA_ERROR at the exact path) and refused by the tree operations, while `constructor`, `toString`,
// `hasOwnProperty` and `valueOf` stay ordinary ids. Every input is built with JSON.parse (the way a stored
// document would be: an object literal cannot create an own `__proto__` key).
const registry = getRegistry();
const T = "tenant-a";
const PAGE_KINDS: TemplateKind[] = ["index", "product", "collection"];
const GOOD = '{"type":"hero","settings":{},"blocks":{},"block_order":[]}';
const parse = (text: string): unknown => JSON.parse(text);

const rootOf = (kind: TemplateKind, body: string): string => {
  const layout = PAGE_KINDS.includes(kind) ? ',"layout":"classic"' : "";
  return `{"schemaVersion":1${layout},${body}}`;
};
const hasErr = (issues: Issue[], path: string) => issues.some((i) => i.code === "SCHEMA_ERROR" && i.path === path && i.level === "error");

const PLACES: { label: string; body: string; path: string }[] = [
  { label: "section", body: `"sections":{"__proto__":${GOOD}},"order":["__proto__"]`, path: "sections.__proto__" },
  { label: "section missing from order", body: `"sections":{"__proto__":${GOOD}},"order":[]`, path: "sections.__proto__" },
  {
    label: "block",
    body: `"sections":{"s":{"type":"hero","settings":{},"blocks":{"__proto__":${GOOD}},"block_order":["__proto__"]}},"order":["s"]`,
    path: "sections.s.blocks.__proto__",
  },
  {
    label: "nested block",
    body: `"sections":{"s":{"type":"hero","settings":{},"blocks":{"b":{"type":"card","settings":{},"blocks":{"__proto__":${GOOD}},"block_order":["__proto__"]}},"block_order":["b"]}},"order":["s"]`,
    path: "sections.s.blocks.b.blocks.__proto__",
  },
];

describe("a well-formed node under an own `__proto__` id is rejected [AC-ENG-006]", () => {
  for (const kind of TEMPLATE_KINDS) {
    for (const place of PLACES) {
      it(`[AC-ENG-006] ${kind}: ${place.label}, with and without a tenant, names the exact path and never throws`, () => {
        const input = parse(rootOf(kind, place.body));
        for (const context of [undefined, { tenantId: T }]) {
          const res = validateDocument(kind, input, registry, context);
          expect(res.ok).toBe(false);
          expect(hasErr(res.issues, place.path)).toBe(true);
          const issue = res.issues.find((i) => i.path === place.path && i.code === "SCHEMA_ERROR");
          expect(issue?.message).toMatch(/__proto__/);
        }
      });
    }
  }

  it("[AC-ENG-006] the message says ids named __proto__ are not allowed", () => {
    const res = validateDocument("index", parse(rootOf("index", PLACES[0].body)), registry);
    expect(res.issues.find((i) => i.path === "sections.__proto__")?.message).toMatch(/ids named __proto__ are not allowed/i);
  });

  it("[AC-ENG-006] the rejection is reported once per id and alongside the other problems (order list, image scan)", () => {
    const text = rootOf("index", `"sections":{"__proto__":{"type":"hero","settings":{"image":{"path":"tenant-b/store/x.png"}},"blocks":{},"block_order":[]}},"order":["__proto__"]`);
    const res = validateDocument("index", parse(text), registry, { tenantId: T });
    expect(res.ok).toBe(false);
    expect(res.issues.filter((i) => i.path === "sections.__proto__" && i.code === "SCHEMA_ERROR")).toHaveLength(1);
    expect(res.issues.some((i) => i.code === "CROSS_TENANT_PATH" && i.path === "sections.__proto__.settings.image")).toBe(true);
  });

  it("[AC-ENG-006] a `__proto__` id is rejected even when the rest of the document fails the schema", () => {
    const text = rootOf("index", `"sections":{"__proto__":${GOOD},"s":{"type":7,"settings":{},"blocks":{},"block_order":[]}},"order":["s"]`);
    const res = validateDocument("index", parse(text), registry);
    expect(res.ok).toBe(false);
    expect(hasErr(res.issues, "sections.__proto__")).toBe(true);
  });

  it("[AC-ENG-006] a `__proto__` entry in an order list alone is only an ORDER_MISMATCH, and `constructor` ids stay valid", () => {
    const listed = validateDocument("index", parse(rootOf("index", `"sections":{"s":${GOOD}},"order":["__proto__"]`)), registry);
    expect(listed.ok).toBe(false);
    expect(listed.issues.some((i) => i.code === "ORDER_MISMATCH")).toBe(true);
    for (const id of ["constructor", "toString", "hasOwnProperty", "valueOf"]) {
      const res = validateDocument("index", parse(rootOf("index", `"sections":{"${id}":${GOOD}},"order":["${id}"]`)), registry, { tenantId: T });
      expect(res.ok, id).toBe(true);
    }
  });
});

describe("tree operations never use a `__proto__` id [AC-ENG-009] [AC-ENG-010]", () => {
  const blank = (type = "text"): ComponentNode => ({ type, settings: {}, blocks: {}, block_order: [] });
  const baseDoc = (): TemplateDocument => ({
    schemaVersion: 1,
    layout: "classic",
    sections: { hero: { ...blank("hero"), blocks: { b1: blank() }, block_order: ["b1"] } },
    order: ["hero"],
  });
  /** A document that somehow holds `__proto__` ids (JSON.parse creates the own keys). */
  const poisoned = (): TemplateDocument =>
    parse(
      `{"schemaVersion":1,"layout":"classic","sections":{"__proto__":{"type":"hero","settings":{},"blocks":{"deep":${GOOD}},"block_order":["deep"]},` +
        `"s":{"type":"hero","settings":{},"blocks":{"__proto__":{"type":"card","settings":{},"blocks":{"under":${GOOD}},"block_order":["under"]},"ok":${GOOD}},"block_order":["__proto__","ok"]}},"order":["__proto__","s"]}`,
    ) as TemplateDocument;

  it("[AC-ENG-010] the safe-id rule refuses `__proto__` and still allows the other prototype names", () => {
    expect(SAFE_NODE_ID_REGEX.test("__proto__")).toBe(false);
    for (const id of ["constructor", "toString", "hasOwnProperty", "valueOf", "__proto", "proto__", "_x__proto__"]) {
      expect(SAFE_NODE_ID_REGEX.test(id), id).toBe(true);
    }
  });

  it("[AC-ENG-010] addNode with customId `__proto__` throws as an unsafe id, for a section and a block, changing nothing", () => {
    const doc = baseDoc();
    const before = JSON.stringify(doc);
    expect(() => addNode(doc, null, blank("hero"), undefined, "__proto__")).toThrow(/id must be/);
    expect(() => addNode(doc, "hero", blank(), 0, "__proto__")).toThrow(/id must be/);
    expect(JSON.stringify(doc)).toBe(before);
    expect(Object.getPrototypeOf(doc.sections)).toBe(Object.prototype);
  });

  it("[AC-ENG-010] a document holding `__proto__` ids is not navigable through them", () => {
    const doc = poisoned();
    expect(findNode(doc, "__proto__")).toBeNull();
    expect(depthOf(doc, "__proto__")).toBe(-1);
    // Nothing below a `__proto__` id can be reached either.
    expect(findNode(doc, "deep")).toBeNull();
    expect(findNode(doc, "under")).toBeNull();
    // The rest of the document still works.
    expect(findNode(doc, "ok")).toMatchObject({ parentId: "s", depth: 1 });
    expect(canMove(doc, "__proto__", "s", 0)).toEqual({ allowed: false, reason: "Node not found" });
    expect(canMove(doc, "ok", "__proto__", 0)).toEqual({ allowed: false, reason: "Target parent not found" });
    expect(() => moveNode(doc, "__proto__", null, 0)).toThrow(/Node not found/);
    expect(() => addNode(doc, "__proto__", blank(), 0)).toThrow(/Target parent not found/);
    expect(() => duplicateNode(doc, "__proto__")).toThrow(/not found/);
    expect(JSON.stringify(removeNode(doc, "__proto__"))).toBe(JSON.stringify(doc));
  });

  it("[AC-ENG-010] a generator that returns `__proto__` is never trusted: the id is treated as taken", () => {
    expect(collectUsedIds(baseDoc()).has("__proto__")).toBe(true);
    expect(() => duplicateNode(baseDoc(), "b1", () => "__proto__")).toThrow(/unique id/);
    let calls = 0;
    const gen = (prefix = "blk") => (calls++ === 0 ? "__proto__" : `${prefix}_ok${calls}`);
    const { doc, newId } = duplicateNode(baseDoc(), "b1", gen);
    expect(newId).not.toBe("__proto__");
    expect(Object.hasOwn(doc.sections.hero.blocks, "__proto__")).toBe(false);
  });

  it("[AC-ENG-010] `constructor`, `toString`, `hasOwnProperty` and `valueOf` custom ids are still accepted as own keys", () => {
    for (const id of ["constructor", "toString", "hasOwnProperty", "valueOf"]) {
      const { doc } = addNode(baseDoc(), null, blank("hero"), undefined, id);
      expect(Object.hasOwn(doc.sections, id)).toBe(true);
      expect(Object.getPrototypeOf(doc.sections)).toBe(Object.prototype);
    }
  });
});
