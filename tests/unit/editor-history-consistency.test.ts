import { describe, expect, it } from "vitest";
import { advanceHistory, canRedo, canUndo, emptyHistory, mergeRestored, pruneHistory, redo, snapshotOf, undo, type History, type Snapshot } from "@/lib/themes/editor/history";
import {
  createPresentationStore, entryFromDetail, markEntrySaved, putEntry, replaceEntry, restoreDrafts, setBlockHidden, setFocalPoint, setGalleryLayout, setMediaPosition, mergeLoadedProduct,
  type PresentationStore,
} from "@/lib/themes/editor/presentation-state";
import { createState, restoreDocs, setSetting, type EditorState } from "@/lib/themes/editor/state";
import type { PresentationDetail } from "@/lib/themes/types";

/**
 * What the owner sees. The harness repeats, with the same pure functions, what the editor does on every committed change
 * (advanceHistory), on Undo and Redo (undo/redo, then restoreDocs and restoreDrafts) and when the server replaces something
 * (replaceEntry / mergeLoadedProduct, or pruneHistory for whole pages). "Undo is available" is canUndo, which drives the button.
 */

const detail = (productId: string, over: Partial<PresentationDetail> = {}): PresentationDetail => ({
  productId, revision: 1, publicationState: "draft", document: { schemaVersion: 1 }, publishedDocument: null, publishedAt: null, updatedAt: null, ...over,
});
const meta = (id: string) => ({ name: `Product ${id}`, slug: id });

class Editor {
  pres: PresentationStore = createPresentationStore();
  state: EditorState = createState("page", [{ templateId: "page", kind: "index", name: "Home", revision: 1, document: { sections: { s: { type: "hero", settings: { heading: "A" } } } } }]);
  history: History = emptyHistory();
  last: Snapshot | null;
  now = 1_000;

  constructor(...productIds: string[]) {
    for (const id of productIds) this.pres = putEntry(this.pres, entryFromDetail(detail(id, { revision: 3, publicationState: "published", publishedDocument: { schemaVersion: 1 } }), meta(id)));
    this.last = this.snapshot();
  }

  snapshot(): Snapshot {
    return snapshotOf(this.state.docs, this.pres.entries);
  }

  /** The effect of the editor shell: one committed change. Each call is a separate edit (a pause since the last one). */
  commit(): void {
    this.now += 10_000;
    const current = this.snapshot();
    this.history = advanceHistory(this.history, this.last, current, this.now);
    this.last = current;
  }

  edit(fn: (s: PresentationStore) => PresentationStore): void {
    this.pres = fn(this.pres);
    this.commit();
  }

  editPage(heading: string): void {
    this.state = setSetting(this.state, "page", "s", undefined, "heading", heading);
    this.commit();
  }

  serverReplaces(id: string, over: Partial<PresentationDetail>): void {
    this.pres = replaceEntry(this.pres, detail(id, over));
    this.commit();
  }

  serverReplacesPage(heading: string): void {
    // The shell: the server's copy is loaded (committed), then the replaced pages are dropped from the history.
    this.state = { ...this.state, docs: { ...this.state.docs, page: { ...this.state.docs.page, document: { sections: { s: { type: "hero", settings: { heading } } } } } } };
    this.commit();
    this.history = pruneHistory(this.history, this.last!, { forgetDocs: ["page"] });
    this.last = null; // next commit is the new baseline
    this.commit();
    this.last = this.snapshot();
  }

  /** The Undo button: returns whether something visibly changed. */
  undo(): boolean {
    const before = JSON.stringify([this.state.docs, this.pres.entries]);
    const step = undo(this.history, this.last!);
    this.history = step.history;
    if (!step.snapshot) return false;
    this.last = mergeRestored(this.last!, step.snapshot);
    this.state = restoreDocs(this.state, step.snapshot.docs);
    this.pres = restoreDrafts(this.pres, step.snapshot.pres);
    this.commit();
    return JSON.stringify([this.state.docs, this.pres.entries]) !== before;
  }

  redo(): boolean {
    const before = JSON.stringify([this.state.docs, this.pres.entries]);
    const step = redo(this.history, this.last!);
    this.history = step.history;
    if (!step.snapshot) return false;
    this.last = mergeRestored(this.last!, step.snapshot);
    this.state = restoreDocs(this.state, step.snapshot.docs);
    this.pres = restoreDrafts(this.pres, step.snapshot.pres);
    this.commit();
    return JSON.stringify([this.state.docs, this.pres.entries]) !== before;
  }

  doc = (id: string) => this.pres.entries[id].document;
  get undoable(): boolean { return canUndo(this.history); }
  get redoable(): boolean { return canRedo(this.history); }
  /** How many Undo presses really change something (the button never lies). */
  undoDepth(): number {
    let n = 0;
    while (this.undoable && this.undo()) n += 1;
    return n;
  }
}

describe("normal local edits", () => {
  it("every edit can be undone and redone, in order", () => {
    const e = new Editor("a");
    e.edit((s) => setGalleryLayout(s, "a", "stacked"));
    e.edit((s) => setFocalPoint(s, "a", { x: 5, y: 6 }));
    expect(e.undoable).toBe(true);
    expect(e.undo()).toBe(true);
    expect(e.doc("a")).toEqual({ schemaVersion: 1, gallery: { layout: "stacked" } });
    expect(e.undo()).toBe(true);
    expect(e.doc("a")).toEqual({ schemaVersion: 1 });
    expect(e.undoable).toBe(false);
    expect(e.redoable).toBe(true);
    expect(e.redo()).toBe(true);
    expect(e.redo()).toBe(true);
    expect(e.doc("a")).toEqual({ schemaVersion: 1, gallery: { layout: "stacked" }, focalPoint: { x: 5, y: 6 } });
    expect(e.redoable).toBe(false);
  });

  it("a burst of quick edits is one step", () => {
    const e = new Editor("a");
    e.now = 0;
    const burst = (fn: (s: PresentationStore) => PresentationStore) => {
      e.pres = fn(e.pres);
      e.now += 100;
      const cur = e.snapshot();
      e.history = advanceHistory(e.history, e.last, cur, e.now);
      e.last = cur;
    };
    burst((s) => setGalleryLayout(s, "a", "stacked"));
    burst((s) => setMediaPosition(s, "a", "right"));
    burst((s) => setBlockHidden(s, "a", "product-sku", true));
    expect(e.undoDepth()).toBe(1);
    expect(e.doc("a")).toEqual({ schemaVersion: 1 });
  });
});

describe("a server replacement leaves the history consistent", () => {
  it("only that product's steps go; Undo is not offered for it and nothing is consumed silently", () => {
    const e = new Editor("a");
    e.edit((s) => setGalleryLayout(s, "a", "stacked"));
    e.edit((s) => setFocalPoint(s, "a", { x: 1, y: 1 }));
    expect(e.undoable).toBe(true);
    // someone else saves; the product is picked again and the server's copy replaces ours
    e.serverReplaces("a", { revision: 9, document: { schemaVersion: 1, hiddenBlocks: ["social-share"] } });
    expect(e.undoable).toBe(false); // the button is off at once, not after a press
    expect(e.redoable).toBe(false);
    expect(e.undo()).toBe(false);
    expect(e.doc("a")).toEqual({ schemaVersion: 1, hiddenBlocks: ["social-share"] });
    expect(e.pres.entries.a.revision).toBe(9);
  });

  it("Redo is pruned too", () => {
    const e = new Editor("a");
    e.edit((s) => setGalleryLayout(s, "a", "stacked"));
    expect(e.undo()).toBe(true);
    expect(e.redoable).toBe(true);
    e.serverReplaces("a", { revision: 4, document: { schemaVersion: 1, gallery: { mediaPosition: "right" } } });
    expect(e.redoable).toBe(false);
    expect(e.redo()).toBe(false);
    expect(e.doc("a")).toEqual({ schemaVersion: 1, gallery: { mediaPosition: "right" } });
  });

  it("steps of unrelated products stay valid, in order, and still work", () => {
    const e = new Editor("a", "b");
    e.edit((s) => setGalleryLayout(s, "a", "stacked"));
    e.edit((s) => setFocalPoint(s, "b", { x: 10, y: 10 }));
    e.edit((s) => setBlockHidden(s, "a", "product-sku", true));
    e.edit((s) => setMediaPosition(s, "b", "right"));
    e.serverReplaces("a", { revision: 8, document: { schemaVersion: 1, focalPoint: { x: 99, y: 99 } } });
    // exactly B's two edits remain
    expect(e.undoDepth()).toBe(2);
    expect(e.doc("b")).toEqual({ schemaVersion: 1 });
    expect(e.doc("a")).toEqual({ schemaVersion: 1, focalPoint: { x: 99, y: 99 } }); // A untouched by undo
  });

  it("a page edit and a product edit: replacing the product leaves the page step", () => {
    const e = new Editor("a");
    e.editPage("Hello");
    e.edit((s) => setGalleryLayout(s, "a", "stacked"));
    e.serverReplaces("a", { revision: 5, document: { schemaVersion: 1 } });
    expect(e.undoDepth()).toBe(1);
    expect((e.state.docs.page.document as { sections: { s: { settings: { heading: string } } } }).sections.s.settings.heading).toBe("A");
  });

  it("a replacement that changes nothing (a publish) keeps every step", () => {
    const e = new Editor("a");
    e.edit((s) => setGalleryLayout(s, "a", "stacked"));
    // autosave stores it (revision 4), then Publish: same revision and content, only the state and live copy move
    const stacked = { schemaVersion: 1, gallery: { layout: "stacked" } };
    e.pres = markEntrySaved(e.pres, detail("a", { revision: 4, publicationState: "published_with_changes", document: stacked, publishedDocument: { schemaVersion: 1 } }), JSON.stringify(stacked));
    e.commit();
    e.pres = replaceEntry(e.pres, detail("a", { revision: 4, publicationState: "published", document: stacked, publishedDocument: stacked }));
    e.commit();
    expect(e.pres.entries.a.epoch).toBe(0);
    expect(e.undoable).toBe(true);
    expect(e.undo()).toBe(true);
  });

  it("picking the product again with newer content (mergeLoadedProduct) prunes the same way", () => {
    const e = new Editor("a", "b");
    e.edit((s) => setGalleryLayout(s, "a", "stacked"));
    e.edit((s) => setGalleryLayout(s, "b", "stacked"));
    // autosave stored A's change; then someone else changed A on the server
    e.pres = putEntry(e.pres, { ...e.pres.entries.a, saved: JSON.stringify(e.pres.entries.a.document), revision: 4 });
    e.commit();
    e.pres = mergeLoadedProduct(e.pres, { productId: "a", ...meta("a"), presentation: detail("a", { revision: 6, document: { schemaVersion: 1, hiddenBlocks: ["product-type"] } }) });
    e.commit();
    expect(e.pres.entries.a.epoch).toBe(1);
    expect(e.undoDepth()).toBe(1); // only B's edit
    expect(e.doc("b")).toEqual({ schemaVersion: 1 });
    expect(e.doc("a")).toEqual({ schemaVersion: 1, hiddenBlocks: ["product-type"] });
  });

  it("the Undo button always matches what Undo does, whatever the order of events", () => {
    const e = new Editor("a", "b");
    e.edit((s) => setGalleryLayout(s, "a", "stacked"));
    e.edit((s) => setGalleryLayout(s, "b", "stacked"));
    e.undo();
    e.serverReplaces("b", { revision: 7, document: { schemaVersion: 1, gallery: { mediaPosition: "right" } } });
    e.edit((s) => setMediaPosition(s, "a", "right"));
    e.serverReplaces("a", { revision: 8, document: { schemaVersion: 1 } });
    for (let guard = 0; guard < 10 && (e.undoable || e.redoable); guard += 1) {
      if (e.undoable) expect(e.undo()).toBe(true);
      else expect(e.redo()).toBe(true);
    }
    expect(e.undoable).toBe(false);
  });
});

describe("a stale step in the history is dropped, never consumed silently", () => {
  it("undo skips a step that can no longer change anything and applies the next real one", () => {
    const e = new Editor("a", "b");
    e.edit((s) => setGalleryLayout(s, "b", "stacked")); // real step, older
    e.edit((s) => setGalleryLayout(s, "a", "stacked")); // newest step
    // the server replaces A without the history being told (the case the old code left behind)
    e.pres = replaceEntry(e.pres, detail("a", { revision: 6, document: { schemaVersion: 1, focalPoint: { x: 1, y: 1 } } }));
    const current = e.snapshot();
    expect(canUndo(e.history)).toBe(true); // stale on the stack
    const step = undo(e.history, current);
    expect(step.snapshot).not.toBeNull();
    expect(Object.keys(step.snapshot!.pres)).toContain("b"); // B's older step, not A's stale one
    expect(step.history.past).toHaveLength(0);
  });

  it("with only stale steps, undo does nothing, reports nothing to undo, and leaves no stale step behind", () => {
    const e = new Editor("a");
    e.edit((s) => setGalleryLayout(s, "a", "stacked"));
    e.pres = replaceEntry(e.pres, detail("a", { revision: 6, document: { schemaVersion: 1, hiddenBlocks: ["product-sku"] } }));
    const step = undo(e.history, e.snapshot());
    expect(step.snapshot).toBeNull();
    expect(canUndo(step.history)).toBe(false);
    expect(canRedo(step.history)).toBe(false);
  });

  it("redo skips stale steps the same way", () => {
    const e = new Editor("a");
    e.edit((s) => setGalleryLayout(s, "a", "stacked"));
    e.undo();
    e.pres = replaceEntry(e.pres, detail("a", { revision: 6, document: { schemaVersion: 1 } }));
    const step = redo(e.history, e.snapshot());
    expect(step.snapshot).toBeNull();
    expect(canRedo(step.history)).toBe(false);
  });
});

describe("pages replaced by the server (reload after a conflict, a restored version)", () => {
  it("the page's steps go and the products' steps stay", () => {
    const e = new Editor("a");
    e.editPage("Mine");
    e.edit((s) => setGalleryLayout(s, "a", "stacked"));
    e.serverReplacesPage("Theirs");
    expect(e.undoDepth()).toBe(1); // product A only
    expect((e.state.docs.page.document as { sections: { s: { settings: { heading: string } } } }).sections.s.settings.heading).toBe("Theirs");
    expect(e.doc("a")).toEqual({ schemaVersion: 1 });
  });

  it("only the replaced page is forgotten", () => {
    const e = new Editor("a");
    e.edit((s) => setGalleryLayout(s, "a", "stacked"));
    e.editPage("Mine");
    const pruned = pruneHistory(e.history, e.snapshot(), { forgetDocs: ["page"] });
    expect(pruned.past).toHaveLength(1);
    expect(Object.keys(pruned.past[0].docs)).toHaveLength(0);
    const all = pruneHistory(e.history, e.snapshot(), { forgetDocs: "all" });
    expect(all.past).toHaveLength(1);
  });
});
