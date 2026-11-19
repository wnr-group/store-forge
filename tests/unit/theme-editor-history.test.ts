import { describe, expect, it } from "vitest";
import { advanceHistory, canRedo, canUndo, COALESCE_MS, emptyHistory, HISTORY_LIMIT, redo, snapshotOf, undo, type History, type Snapshot } from "@/lib/themes/editor/history";
import { createState, markSaved, removeSection, restoreDocs, setSetting, type EditorState } from "@/lib/themes/editor/state";

const node = (type: string, settings = {}) => ({ type, settings, blocks: {}, block_order: [] });
const start = (): EditorState =>
  createState("p", [{ templateId: "p", kind: "index", name: "Home", revision: 1, document: { schemaVersion: 1, layout: "classic", sections: { a: node("hero", { heading: "A" }), b: node("rich-text") }, order: ["a", "b"] } }]);
const heading = (s: EditorState) => (s.docs.p.document as { sections: Record<string, { settings: Record<string, unknown> }> }).sections.a.settings.heading;
const snap = (s: EditorState): Snapshot => snapshotOf(s.docs, {});

type Run = { s: EditorState; h: History };

/** Applies an edit and records it, the way the editor does (it compares each committed state with the one before). */
function apply({ s, h }: Run, edit: (s: EditorState) => EditorState, now = 0): Run {
  const next = edit(s);
  return { s: next, h: advanceHistory(h, snap(s), snap(next), now) };
}

/** Undo or redo, the way the editor does: pick the step, put its documents back. */
function step(run: Run, direction: "undo" | "redo"): Run | null {
  const result = (direction === "undo" ? undo : redo)(run.h, snap(run.s));
  if (!result.snapshot) return null;
  return { s: restoreDocs(run.s, result.snapshot.docs), h: result.history };
}

const fresh = (): Run => ({ s: start(), h: emptyHistory() });
const setHeading = (value: string) => (x: EditorState) => setSetting(x, "p", "a", undefined, "heading", value);

describe("editor history", () => {
  it("undoes and redoes an edit", () => {
    const run = apply(fresh(), setHeading("B"));
    expect(canUndo(run.h)).toBe(true);
    const u = step(run, "undo")!;
    expect(heading(u.s)).toBe("A");
    expect(canRedo(u.h)).toBe(true);
    const r = step(u, "redo")!;
    expect(heading(r.s)).toBe("B");
    expect(canRedo(r.h)).toBe(false);
    expect(canUndo(r.h)).toBe(true);
  });

  it("has nothing to undo or redo at the start", () => {
    expect(step(fresh(), "undo")).toBeNull();
    expect(step(fresh(), "redo")).toBeNull();
  });

  it("folds a quick burst of edits into one step, but not a slow one", () => {
    let run = fresh();
    for (let i = 0; i < 50; i++) run = apply(run, setHeading(`v${i}`), i * 10);
    expect(run.h.past).toHaveLength(1);
    expect(heading(step(run, "undo")!.s)).toBe("A");
    run = apply(run, setHeading("slow"), 49 * 10 + COALESCE_MS + 1);
    expect(run.h.past).toHaveLength(2);
  });

  it("a new edit clears what could be redone", () => {
    const first = apply(fresh(), setHeading("B"));
    const u = step(first, "undo")!;
    const second = apply(u, setHeading("C"), 10_000);
    expect(canRedo(second.h)).toBe(false);
  });

  it("undoes a deleted section and drops a selection that no longer exists", () => {
    const selected: EditorState = { ...start(), selection: { docId: "p", sectionId: "a" } };
    const run = apply({ s: selected, h: emptyHistory() }, (x) => removeSection(x, "p", "a"));
    expect(run.s.selection).toBeNull();
    const u = step(run, "undo")!;
    expect((u.s.docs.p.document as { order: string[] }).order).toEqual(["a", "b"]);
  });

  it("keeps a selection that is still there after an undo", () => {
    const selected: EditorState = { ...start(), selection: { docId: "p", sectionId: "b" } };
    const run = apply({ s: selected, h: emptyHistory() }, setHeading("B"));
    expect(step(run, "undo")!.s.selection).toEqual({ docId: "p", sectionId: "b" });
  });

  it("keeps the saved baseline, so undoing past a save makes the document dirty again", () => {
    const run = apply(fresh(), setHeading("B"));
    const saved = markSaved(run.s, "p", 2, run.s.docs.p.document, JSON.stringify(run.s.docs.p.document));
    const u = step({ s: saved, h: run.h }, "undo")!;
    expect(u.s.docs.p.revision).toBe(2);
    expect(JSON.stringify(u.s.docs.p.document)).not.toBe(u.s.docs.p.saved);
  });

  it("caps the number of steps", () => {
    let run = fresh();
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) run = apply(run, setHeading(`v${i}`), i * (COALESCE_MS + 1));
    expect(run.h.past).toHaveLength(HISTORY_LIMIT);
  });
});
