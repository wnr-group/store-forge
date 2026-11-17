import { describe, expect, it } from "vitest";
import {
  COALESCE_MS, HISTORY_LIMIT, canRedo, canUndo, changedBetween, clearHistory, emptyHistory, recordChange, redo, snapshotOf, stableStringify, undo,
} from "@/lib/themes/editor/history";

const snap = (docs: Record<string, unknown> = {}, pres: Record<string, unknown> = {}) =>
  snapshotOf(Object.fromEntries(Object.entries(docs).map(([k, v]) => [k, { document: v }])), Object.fromEntries(Object.entries(pres).map(([k, v]) => [k, { document: v }])));

describe("comparing content", () => {
  it("key order is not a change; array order is", () => {
    expect(stableStringify({ b: 1, a: { d: 1, c: 2 } })).toBe(stableStringify({ a: { c: 2, d: 1 }, b: 1 }));
    expect(stableStringify({ order: ["a", "b"] })).not.toBe(stableStringify({ order: ["b", "a"] }));
  });

  it("an edit in a document, or in a product's settings, is a change", () => {
    expect(changedBetween(snap({ p: { h: "A" } }), snap({ p: { h: "B" } }))).toBe(true);
    expect(changedBetween(snap({}, { x: { schemaVersion: 1 } }), snap({}, { x: { schemaVersion: 1, focalPoint: { x: 1, y: 1 } } }))).toBe(true);
  });

  it("the same content in another key order (a server copy) is not a change", () => {
    expect(changedBetween(snap({ p: { a: 1, b: { c: 1, d: 2 } } }), snap({ p: { b: { d: 2, c: 1 }, a: 1 } }))).toBe(false);
  });

  it("loading a page or product that was not there before is not an edit", () => {
    expect(changedBetween(snap({ p: { a: 1 } }), snap({ p: { a: 1 }, q: { z: 9 } }, { x: { schemaVersion: 1 } }))).toBe(false);
  });
});

describe("undo and redo", () => {
  const A = snap({ p: { v: "A" } });
  const B = snap({ p: { v: "B" } });
  const C = snap({ p: { v: "C" } });

  it("starts with nothing to undo or redo", () => {
    const h = emptyHistory();
    expect(canUndo(h)).toBe(false);
    expect(canRedo(h)).toBe(false);
    expect(undo(h, A).snapshot).toBeNull();
    expect(redo(h, A).snapshot).toBeNull();
  });

  it("undo returns the state before the edit and makes redo possible; redo goes forward again", () => {
    let h = recordChange(emptyHistory(), A, 0); // edited A -> B
    h = recordChange(h, B, COALESCE_MS + 1); // edited B -> C
    const u1 = undo(h, C);
    expect(u1.snapshot).toBe(B);
    expect(canRedo(u1.history)).toBe(true);
    const u2 = undo(u1.history, B);
    expect(u2.snapshot).toBe(A);
    expect(canUndo(u2.history)).toBe(false);
    const r1 = redo(u2.history, A);
    expect(r1.snapshot).toBe(B);
    const r2 = redo(r1.history, B);
    expect(r2.snapshot).toBe(C);
    expect(canRedo(r2.history)).toBe(false);
    expect(canUndo(r2.history)).toBe(true);
  });

  it("a new edit after an undo discards what could have been redone", () => {
    let h = recordChange(emptyHistory(), A, 0);
    h = undo(h, B).history;
    expect(canRedo(h)).toBe(true);
    h = recordChange(h, A, 10_000);
    expect(canRedo(h)).toBe(false);
  });

  it("a burst of edits (typing) is one step that returns to before the burst", () => {
    let h = recordChange(emptyHistory(), A, 0);
    h = recordChange(h, snap({ p: { v: "AB" } }), 200);
    h = recordChange(h, snap({ p: { v: "ABC" } }), 400);
    expect(h.past).toHaveLength(1);
    expect(undo(h, C).snapshot).toBe(A);
    // a pause starts a new step
    h = recordChange(h, snap({ p: { v: "ABC" } }), 400 + COALESCE_MS + 1);
    expect(h.past).toHaveLength(2);
  });

  it("keeps at most the limit of steps, dropping the oldest", () => {
    let h = emptyHistory(3);
    for (let i = 0; i < 6; i += 1) h = recordChange(h, snap({ p: { i } }), i * (COALESCE_MS + 1) + 1);
    expect(h.past).toHaveLength(3);
    expect(h.past[0].docs.p.key).toBe(stableStringify({ i: 3 }));
    expect(HISTORY_LIMIT).toBeGreaterThan(10);
  });

  it("clearing forgets everything but keeps the limit", () => {
    const h = clearHistory(recordChange(emptyHistory(7), A, 1));
    expect(canUndo(h) || canRedo(h)).toBe(false);
    expect(h.max).toBe(7);
  });

  it("a snapshot restores the exact document that was saved in it", () => {
    const doc = { sections: { a: { settings: { heading: "Hello" } } }, order: ["a"] };
    expect(JSON.parse(snap({ p: doc }).docs.p.raw)).toEqual(doc);
  });
});
