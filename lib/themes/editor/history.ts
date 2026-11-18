import type { EditorState, Selection } from "./state";

/**
 * Undo and redo for the editor: snapshots of every document the merchant has open, taken just before each edit. Documents are
 * updated immutably (every edit returns a new object), so a snapshot is a set of references and costs next to nothing.
 * Plain data and pure functions, like `state.ts`. Saving does not touch the history: undoing past a save simply makes the
 * document differ from the saved copy again, and autosave stores the result.
 */

type Snapshot = Record<string, Record<string, unknown>>;
export type History = {
  past: Snapshot[];
  future: Snapshot[];
  /** The last recorded edit, to fold a burst of the same kind (a slider drag, typing) into one step. */
  last: { key: string; at: number } | null;
};

export const HISTORY_LIMIT = 100;
/** Edits with the same key closer together than this are one undo step. */
export const COALESCE_MS = 900;

export const emptyHistory = (): History => ({ past: [], future: [], last: null });
export const canUndo = (h: History) => h.past.length > 0;
export const canRedo = (h: History) => h.future.length > 0;

const snapshot = (state: EditorState): Snapshot => Object.fromEntries(Object.entries(state.docs).map(([id, d]) => [id, d.document]));

/** Call with the state BEFORE an edit that changed it. `key` groups a burst of edits (omit it for a step of its own). */
export function record(history: History, before: EditorState, key?: string, now: number = Date.now()): History {
  if (key && history.last && history.last.key === key && now - history.last.at < COALESCE_MS && history.past.length > 0) {
    return { ...history, future: [], last: { key, at: now } };
  }
  const past = [...history.past, snapshot(before)];
  if (past.length > HISTORY_LIMIT) past.shift();
  return { past, future: [], last: key ? { key, at: now } : null };
}

function restore(state: EditorState, snap: Snapshot): EditorState {
  const docs = { ...state.docs };
  for (const [id, document] of Object.entries(snap)) if (docs[id]) docs[id] = { ...docs[id], document };
  const next: EditorState = { ...state, docs };
  return { ...next, selection: stillThere(next, state.selection) };
}

/** A selection that points at something an undo removed becomes no selection (or the section, if only the block went). */
function stillThere(state: EditorState, selection: Selection): Selection {
  if (!selection) return null;
  const doc = state.docs[selection.docId]?.document as { sections?: Record<string, { blocks?: Record<string, unknown> }> } | undefined;
  if (!doc) return null;
  if ("theme" in selection) return selection;
  const section = doc.sections?.[selection.sectionId];
  if (!section) return null;
  if (selection.blockId && !hasBlock(section, selection.blockId)) return { docId: selection.docId, sectionId: selection.sectionId };
  return selection;
}

function hasBlock(node: { blocks?: Record<string, unknown> }, id: string): boolean {
  const blocks = (node.blocks ?? {}) as Record<string, { blocks?: Record<string, unknown> }>;
  return id in blocks || Object.values(blocks).some((b) => hasBlock(b, id));
}

export function undo(history: History, current: EditorState): { state: EditorState; history: History } | null {
  const snap = history.past[history.past.length - 1];
  if (!snap) return null;
  return { state: restore(current, snap), history: { past: history.past.slice(0, -1), future: [...history.future, snapshot(current)], last: null } };
}

export function redo(history: History, current: EditorState): { state: EditorState; history: History } | null {
  const snap = history.future[history.future.length - 1];
  if (!snap) return null;
  return { state: restore(current, snap), history: { past: [...history.past, snapshot(current)], future: history.future.slice(0, -1), last: null } };
}
