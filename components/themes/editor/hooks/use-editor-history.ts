"use client";

import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { advanceHistory, clearHistory, mergeRestored, pruneHistory, redo, snapshotOf, undo, type Snapshot } from "@/lib/themes/editor/history";
import type { PresentationStore } from "@/lib/themes/editor/presentation-state";
import { restoreDrafts } from "@/lib/themes/editor/presentation-state";
import type { SaveState } from "@/lib/themes/editor/shell-logic";
import { restoreDocs, type EditorState } from "@/lib/themes/editor/state";
import { useHistoryStore } from "../use-history";

type Args = {
  state: EditorState;
  presStore: PresentationStore;
  commit: (fn: (s: EditorState) => EditorState) => EditorState;
  setPresStore: Dispatch<SetStateAction<PresentationStore>>;
  setSaveState: Dispatch<SetStateAction<SaveState>>;
  canEdit: boolean;
  /** "I" turns the inspector on and off. */
  toggleInspector: () => void;
};

/** Undo and redo over every draft being edited (pages, shared parts and product settings), and their keyboard shortcuts. Not part of what is saved. */
export function useEditorHistory({ state, presStore, commit, setPresStore, setSaveState, canEdit, toggleInspector }: Args) {
  const undoStack = useHistoryStore();
  const lastSnap = useRef<Snapshot | null>(null);
  const undoRef = useRef<() => void>(() => {});
  const redoRef = useRef<() => void>(() => {});
  const toggleRef = useRef(toggleInspector);
  useEffect(() => {
    toggleRef.current = toggleInspector;
  });

  useEffect(() => {
    // Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z and Ctrl+Y, unless a text field has focus (it keeps its own undo).
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(input|textarea|select)$/i.test(el.tagName))) return;
      // "I" turns the inspector on and off.
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === "i") {
        toggleRef.current();
        return;
      }
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "z") {
        e.preventDefault();
        (e.shiftKey ? redoRef : undoRef).current();
      } else if (k === "y") {
        e.preventDefault();
        redoRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ---- undo and redo -------------------------------------------------------------------------------------------
  // Every committed change to a draft is compared with the previous commit; a real edit becomes an undo step. Loading a page or
  // product only adds a baseline, and a reload, a restored version or a reset clears the steps (they no longer describe the screen).
  const { history, get: getHistory, set: setHistory } = undoStack;
  useEffect(() => {
    const current = snapshotOf(state.docs, presStore.entries);
    const before = lastSnap.current;
    // An edit becomes an undo step; a product replaced by the server prunes the steps that no longer apply (see advanceHistory).
    setHistory(advanceHistory(getHistory(), before, current, Date.now()));
    lastSnap.current = current;
  }, [state.docs, presStore.entries, getHistory, setHistory]);

  /**
   * The server just replaced whole pages or shared parts (a reload after a conflict, a restored version). Their content is
   * dropped from every undo step; steps of other pages and of products stay. The next commit becomes the new baseline.
   */
  const forgetDocsNow = useCallback(
    (ids: readonly string[] | "all") => {
      const current = lastSnap.current;
      setHistory(current ? pruneHistory(getHistory(), current, { forgetDocs: ids }) : clearHistory(getHistory()));
      lastSnap.current = null;
    },
    [getHistory, setHistory],
  );

  /** Puts the documents of a snapshot back as drafts. The baseline is set first, so applying a step is not recorded as an edit. */
  const applySnapshot = useCallback((snap: Snapshot) => {
    const now = lastSnap.current;
    if (now) {
      lastSnap.current = mergeRestored(now, snap);
    }
    commit((prev) => restoreDocs(prev, snap.docs));
    // A product draft is put back only if it still belongs to the same server epoch (see restoreDrafts).
    setPresStore((prev) => restoreDrafts(prev, snap.pres));
    setSaveState((s) => (s === "error" ? "idle" : s));
  }, [commit, setPresStore, setSaveState]);

  const undoEdit = useCallback(() => {
    if (!lastSnap.current) return;
    const step = undo(getHistory(), lastSnap.current);
    // The history is updated even when nothing could be undone: steps that cannot change anything are dropped, never shown as available.
    setHistory(step.history);
    if (step.snapshot) applySnapshot(step.snapshot);
  }, [applySnapshot, getHistory, setHistory]);

  const redoEdit = useCallback(() => {
    if (!lastSnap.current) return;
    const step = redo(getHistory(), lastSnap.current);
    setHistory(step.history);
    if (step.snapshot) applySnapshot(step.snapshot);
  }, [applySnapshot, getHistory, setHistory]);

  useEffect(() => {
    undoRef.current = canEdit ? undoEdit : () => {};
    redoRef.current = canEdit ? redoEdit : () => {};
  }, [canEdit, undoEdit, redoEdit]);

  return { history, undoEdit, redoEdit, forgetDocsNow };
}
