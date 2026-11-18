import { describe, expect, it } from "vitest";
import { canRedo, canUndo, COALESCE_MS, emptyHistory, HISTORY_LIMIT, record, redo, undo, type History } from "@/lib/themes/editor/history";
import { createState, markSaved, removeSection, setSetting, type EditorState } from "@/lib/themes/editor/state";

const node = (type: string, settings = {}) => ({ type, settings, blocks: {}, block_order: [] });
const start = (): EditorState =>
  createState("p", [{ templateId: "p", kind: "index", name: "Home", revision: 1, document: { schemaVersion: 1, layout: "classic", sections: { a: node("hero", { heading: "A" }), b: node("rich-text") }, order: ["a", "b"] } }]);
const heading = (s: EditorState) => (s.docs.p.document as { sections: Record<string, { settings: Record<string, unknown> }> }).sections.a.settings.heading;

/** Applies an edit and records it, the way the editor does. */
function apply(s: EditorState, h: History, edit: (s: EditorState) => EditorState, key?: string, now = 0) {
  const next = edit(s);
  return { s: next, h: record(h, s, key, now) };
}

describe("editor history", () => {
  it("undoes and redoes an edit", () => {
    const { s, h } = apply(start(), emptyHistory(), (x) => setSetting(x, "p", "a", undefined, "heading", "B"));
    expect(canUndo(h)).toBe(true);
    const u = undo(h, s)!;
    expect(heading(u.state)).toBe("A");
    expect(canRedo(u.history)).toBe(true);
    const r = redo(u.history, u.state)!;
    expect(heading(r.state)).toBe("B");
    expect(canRedo(r.history)).toBe(false);
    expect(canUndo(r.history)).toBe(true);
  });

  it("has nothing to undo or redo at the start", () => {
    expect(undo(emptyHistory(), start())).toBeNull();
    expect(redo(emptyHistory(), start())).toBeNull();
  });

  it("folds a burst of the same edit into one step, but not a slow or different one", () => {
    let s = start();
    let h = emptyHistory();
    for (let i = 0; i < 50; i++) ({ s, h } = apply(s, h, (x) => setSetting(x, "p", "a", undefined, "heading", `v${i}`), "a.heading", i * 10));
    expect(h.past).toHaveLength(1);
    expect(heading(undo(h, s)!.state)).toBe("A");
    ({ s, h } = apply(s, h, (x) => setSetting(x, "p", "a", undefined, "heading", "slow"), "a.heading", 49 * 10 + COALESCE_MS + 1));
    expect(h.past).toHaveLength(2);
    ({ s, h } = apply(s, h, (x) => setSetting(x, "p", "a", undefined, "other", 1), "a.other", 49 * 10 + COALESCE_MS + 2));
    expect(h.past).toHaveLength(3);
  });

  it("a new edit clears what could be redone", () => {
    const first = apply(start(), emptyHistory(), (x) => setSetting(x, "p", "a", undefined, "heading", "B"));
    const u = undo(first.h, first.s)!;
    const second = apply(u.state, u.history, (x) => setSetting(x, "p", "a", undefined, "heading", "C"));
    expect(canRedo(second.h)).toBe(false);
  });

  it("undoes a deleted section and drops a selection that no longer exists", () => {
    const selected: EditorState = { ...start(), selection: { docId: "p", sectionId: "a" } };
    const { s, h } = apply(selected, emptyHistory(), (x) => removeSection(x, "p", "a"));
    expect(s.selection).toBeNull();
    const u = undo(h, s)!;
    expect((u.state.docs.p.document as { order: string[] }).order).toEqual(["a", "b"]);
  });

  it("keeps the saved baseline, so undoing past a save makes the document dirty again", () => {
    const { s, h } = apply(start(), emptyHistory(), (x) => setSetting(x, "p", "a", undefined, "heading", "B"));
    const saved = markSaved(s, "p", 2, s.docs.p.document, JSON.stringify(s.docs.p.document));
    const u = undo(h, saved)!;
    expect(u.state.docs.p.revision).toBe(2);
    expect(JSON.stringify(u.state.docs.p.document)).not.toBe(u.state.docs.p.saved);
  });

  it("caps the number of steps", () => {
    let s = start();
    let h = emptyHistory();
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) ({ s, h } = apply(s, h, (x) => setSetting(x, "p", "a", undefined, "heading", `v${i}`)));
    expect(h.past).toHaveLength(HISTORY_LIMIT);
  });
});
