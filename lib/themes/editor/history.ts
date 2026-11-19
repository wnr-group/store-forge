/**
 * Undo and redo for the editor. Plain data and pure functions (no React), so the rules are unit-tested.
 *
 * A snapshot holds the JSON of every document being edited: the pages and shared parts, and each loaded product's
 * presentation. Revisions, saved baselines and selections are NOT part of it: undoing changes the draft only, and the
 * normal autosave then saves the result like any other edit, so history never fights the revision checks.
 *
 * Content is compared by a key-sorted form, so a server copy that merely lists the same keys in another order is not an edit.
 */

export type SnapshotEntry = {
  /** The document as it was, for restoring. */
  raw: string;
  /** Key-sorted JSON, for comparing. */
  key: string;
  /** Product settings only: the server epoch of the copy this was taken from. Never restored across a different epoch. */
  epoch?: number;
};
export type Snapshot = { docs: Record<string, SnapshotEntry>; pres: Record<string, SnapshotEntry> };

export type History = {
  past: Snapshot[];
  future: Snapshot[];
  /** When the last edit was recorded, to join a burst of typing into one step. */
  at: number;
  /** An undo step is never kept for more than this many edits. */
  max: number;
};

export const HISTORY_LIMIT = 100;
/** Edits closer together than this (typing, dragging a slider) are one undo step. */
export const COALESCE_MS = 800;

export const emptyHistory = (max = HISTORY_LIMIT): History => ({ past: [], future: [], at: 0, max });
export const canUndo = (h: History) => h.past.length > 0;
export const canRedo = (h: History) => h.future.length > 0;

/** JSON with object keys sorted at every level; arrays keep their order (order is meaning there). */
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
    }
    return v;
  });
}

const entryOf = (document: unknown, epoch?: number): SnapshotEntry => ({ raw: JSON.stringify(document), key: stableStringify(document), ...(epoch === undefined ? {} : { epoch }) });

export function snapshotOf(docs: Record<string, { document: unknown }>, pres: Record<string, { document: unknown; epoch?: number }>): Snapshot {
  return {
    docs: Object.fromEntries(Object.entries(docs).map(([id, d]) => [id, entryOf(d.document)])),
    pres: Object.fromEntries(Object.entries(pres).map(([id, d]) => [id, entryOf(d.document, d.epoch ?? 0)])),
  };
}

/** Same document in both, under the same epoch, with different content. A new epoch is the server's copy arriving, not an edit. */
const differs = (a: Record<string, SnapshotEntry>, b: Record<string, SnapshotEntry>) =>
  Object.keys(b).some((id) => id in a && (a[id].epoch ?? 0) === (b[id].epoch ?? 0) && a[id].key !== b[id].key);

/**
 * True when a document that exists in both snapshots has different content. A document that only appears in one (a page
 * or product loaded later) is not an edit, so loading never creates an undo step.
 */
export const changedBetween = (before: Snapshot, after: Snapshot): boolean => differs(before.docs, after.docs) || differs(before.pres, after.pres);

/** An edit happened: keep the state before it as an undo step (joined with the previous step when it came right after) and forget redo. */
export function recordChange(h: History, before: Snapshot, now: number): History {
  const joins = h.past.length > 0 && now - h.at < COALESCE_MS;
  const past = joins ? h.past : [...h.past, before].slice(-h.max);
  return { ...h, past, future: [], at: now };
}

/**
 * True when applying `step` to `state` would change something that can be seen. A step whose documents are all gone, in
 * another server epoch, or already equal to the state does nothing, and must never be offered or consumed.
 */
export const isEffective = (step: Snapshot, state: Snapshot): boolean => changedBetween(state, mergeRestored(state, step));

/**
 * Undo: the newest step that really changes something. Steps that no longer can (their product was replaced by the server,
 * say) are dropped on the way, never applied. With nothing left the history comes back without them and `snapshot` is null.
 */
export function undo(h: History, current: Snapshot): { history: History; snapshot: Snapshot | null } {
  let past = h.past;
  while (past.length > 0) {
    const step = past[past.length - 1];
    past = past.slice(0, -1);
    if (isEffective(step, current)) return { snapshot: step, history: { ...h, past, future: [...h.future, current], at: 0 } };
  }
  return { snapshot: null, history: past.length === h.past.length ? h : { ...h, past, at: 0 } };
}

export function redo(h: History, current: Snapshot): { history: History; snapshot: Snapshot | null } {
  let future = h.future;
  while (future.length > 0) {
    const step = future[future.length - 1];
    future = future.slice(0, -1);
    if (isEffective(step, current)) return { snapshot: step, history: { ...h, past: [...h.past, current], future, at: 0 } };
  }
  return { snapshot: null, history: future.length === h.future.length ? h : { ...h, future, at: 0 } };
}

/**
 * The snapshot the editor will show once a step is applied: `now` with the step's documents put back. Product settings from
 * another epoch stay as they are (they are not restored), so applying a step is not mistaken for an edit.
 */
export function mergeRestored(now: Snapshot, step: Snapshot): Snapshot {
  return {
    docs: { ...now.docs, ...Object.fromEntries(Object.entries(step.docs).filter(([id]) => id in now.docs)) },
    pres: { ...now.pres, ...Object.fromEntries(Object.entries(step.pres).filter(([id, e]) => id in now.pres && (now.pres[id].epoch ?? 0) === (e.epoch ?? 0))) },
  };
}

export type PruneOptions = {
  /** Pages or shared parts the server just replaced: their content is dropped from every step. "all" for every one. */
  forgetDocs?: readonly string[] | "all";
};

/** True when a product present in both snapshots is now in a different server epoch. */
export const epochChanged = (before: Snapshot, after: Snapshot): boolean => Object.keys(after.pres).some((id) => id in before.pres && (before.pres[id].epoch ?? 0) !== (after.pres[id].epoch ?? 0));

function strip(step: Snapshot, current: Snapshot, options: PruneOptions): Snapshot {
  const forget = options.forgetDocs;
  return {
    docs: forget === "all" ? {} : Object.fromEntries(Object.entries(step.docs).filter(([id]) => !(forget ?? []).includes(id))),
    // A product is kept only while it is still in the epoch the step was taken in.
    pres: Object.fromEntries(Object.entries(step.pres).filter(([id, e]) => id in current.pres && (current.pres[id].epoch ?? 0) === (e.epoch ?? 0))),
  };
}

/**
 * Makes the history match the screen after the server replaced something: stale parts are removed from every step, and a
 * step that can no longer change anything is dropped. Steps are replayed in the order Undo (or Redo) would take them, each
 * on the state the one before leaves, so what remains is exactly what can still be done, for every product, and nothing else.
 * Steps that belong to other products or documents are kept.
 */
export function pruneHistory(h: History, current: Snapshot, options: PruneOptions = {}): History {
  const replay = (stack: Snapshot[]): Snapshot[] => {
    const kept: Snapshot[] = [];
    let state = current;
    for (let i = stack.length - 1; i >= 0; i -= 1) {
      const step = strip(stack[i], current, options);
      if (!isEffective(step, state)) continue;
      kept.unshift(step);
      state = mergeRestored(state, step);
    }
    return kept;
  };
  return { ...h, past: replay(h.past), future: replay(h.future), at: 0 };
}

/**
 * One committed change of the editor: `before` is the previous committed state, `current` the new one. An edit becomes an
 * undo step; a server replacement (a product moving to a new epoch) prunes the history. Both can happen in one commit.
 */
export function advanceHistory(h: History, before: Snapshot | null, current: Snapshot, now: number): History {
  if (!before) return h;
  let next = h;
  if (changedBetween(before, current)) next = recordChange(next, before, now);
  if (epochChanged(before, current)) next = pruneHistory(next, current);
  return next;
}

/** Forget everything (after a reload, a restored version or a reset): older steps no longer describe what is on screen. */
export const clearHistory = (h: History): History => emptyHistory(h.max);
