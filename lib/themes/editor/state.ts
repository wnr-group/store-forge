import type { ComponentNode, TemplateDocument } from "@/lib/templates/document";
import type { SectionDefinition, SettingDescriptor, ComponentRegistry } from "@/lib/templates/engine/descriptors";
import { addNode, duplicateNode, generateId, moveNode, removeNode } from "@/lib/templates/engine/tree";
import type { ThemeKind } from "@/lib/themes/types";

/**
 * The editor's local state, kept apart from what the server holds: every document being edited with the revision it
 * started from, plus the current selection. Plain data and pure functions (no React), so every edit is unit-tested.
 * Each function returns a NEW state and never mutates its input; `dirty` compares with the last saved copy.
 */

export type EditorDoc = {
  templateId: string;
  kind: ThemeKind;
  name: string;
  /** The revision this copy was loaded or last saved at; sent back as `expectedRevision`. */
  revision: number;
  document: Record<string, unknown>;
  /** JSON of the last persisted document. */
  saved: string;
};

export type Selection = { docId: string; sectionId: string; blockId?: string } | { docId: string; theme: true } | null;

export type EditorState = {
  docs: Record<string, EditorDoc>;
  /** The page being edited (a `templates.id`). */
  pageId: string;
  selection: Selection;
};

export const isDirty = (d: EditorDoc) => JSON.stringify(d.document) !== d.saved;
export const dirtyDocs = (s: EditorState) => Object.values(s.docs).filter(isDirty);

export function createState(pageId: string, docs: Omit<EditorDoc, "saved">[]): EditorState {
  return {
    pageId,
    selection: null,
    docs: Object.fromEntries(docs.map((d) => [d.templateId, { ...d, saved: JSON.stringify(d.document) }])),
  };
}

const asPage = (d: EditorDoc) => d.document as unknown as TemplateDocument;

function withDoc(state: EditorState, docId: string, change: (doc: TemplateDocument) => TemplateDocument): EditorState {
  const current = state.docs[docId];
  if (!current) return state;
  return { ...state, docs: { ...state.docs, [docId]: { ...current, document: change(asPage(current)) as unknown as Record<string, unknown> } } };
}

export function select(state: EditorState, selection: Selection): EditorState {
  return { ...state, selection };
}

/** Sets one setting of a section or block. Pass `undefined` to remove it (the default applies again). */
export function setSetting(state: EditorState, docId: string, sectionId: string, blockId: string | undefined, key: string, value: unknown): EditorState {
  return withDoc(state, docId, (doc) => {
    const next = structuredClone(doc);
    const node = blockId ? findBlock(next.sections[sectionId], blockId) : next.sections[sectionId];
    if (!node) return doc;
    const settings = { ...(node.settings ?? {}) };
    if (value === undefined) delete settings[key];
    else settings[key] = value;
    node.settings = settings;
    return next;
  });
}

function findBlock(node: ComponentNode | undefined, blockId: string): ComponentNode | undefined {
  if (!node) return undefined;
  if (node.blocks[blockId]) return node.blocks[blockId];
  for (const child of Object.values(node.blocks)) {
    const found = findBlock(child, blockId);
    if (found) return found;
  }
  return undefined;
}

/** Settings a new component starts with: every descriptor default that is set (null and empty text are left out). */
export function defaultSettings(descriptors: SettingDescriptor[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const d of descriptors) {
    if (d.default === null || d.default === undefined || d.default === "") continue;
    out[d.id] = structuredClone(d.default);
  }
  return out;
}

export function createSectionNode(def: SectionDefinition, registry: ComponentRegistry): ComponentNode {
  const node: ComponentNode = { type: def.type, settings: defaultSettings(def.settings), blocks: {}, block_order: [] };
  for (const b of def.defaultBlocks ?? []) {
    const blockDef = registry.blocks[b.type];
    const id = generateId("blk");
    node.blocks[id] = { type: b.type, settings: { ...defaultSettings(blockDef?.settings ?? []), ...(b.settings ?? {}) }, blocks: {}, block_order: [] };
    node.block_order.push(id);
  }
  return node;
}

export function createBlockNode(type: string, registry: ComponentRegistry): ComponentNode | null {
  const def = registry.blocks[type];
  return def ? { type, settings: defaultSettings(def.settings), blocks: {}, block_order: [] } : null;
}

/** Adds a section at `index` (default: the end). Returns the new state and the new section's id. */
export function addSection(state: EditorState, docId: string, def: SectionDefinition, registry: ComponentRegistry, index?: number): { state: EditorState; id: string | null } {
  const current = state.docs[docId];
  if (!current) return { state, id: null };
  try {
    const added = addNode(asPage(current), null, createSectionNode(def, registry), index);
    return {
      id: added.id,
      state: select({ ...state, docs: { ...state.docs, [docId]: { ...current, document: added.doc as unknown as Record<string, unknown> } } }, { docId, sectionId: added.id }),
    };
  } catch {
    return { state, id: null };
  }
}

export function removeSection(state: EditorState, docId: string, sectionId: string): EditorState {
  const next = withDoc(state, docId, (doc) => removeNode(doc, sectionId));
  const sel = next.selection;
  return sel && "sectionId" in sel && sel.sectionId === sectionId ? { ...next, selection: null } : next;
}

export function duplicateSection(state: EditorState, docId: string, sectionId: string): EditorState {
  const current = state.docs[docId];
  if (!current) return state;
  try {
    const { doc, newId } = duplicateNode(asPage(current), sectionId);
    return select({ ...state, docs: { ...state.docs, [docId]: { ...current, document: doc as unknown as Record<string, unknown> } } }, { docId, sectionId: newId });
  } catch {
    return state;
  }
}

/** Moves a section to a new position in the page order. */
export function moveSection(state: EditorState, docId: string, sectionId: string, toIndex: number, registry?: ComponentRegistry): EditorState {
  const current = state.docs[docId];
  if (!current) return state;
  try {
    return withDoc(state, docId, (doc) => moveNode(doc, sectionId, null, toIndex, registry));
  } catch {
    return state;
  }
}

/** Hides or shows a section on the live page (`disabled` is left out when false). */
export function toggleSection(state: EditorState, docId: string, sectionId: string): EditorState {
  return withDoc(state, docId, (doc) => {
    const next = structuredClone(doc);
    const section = next.sections[sectionId];
    if (!section) return doc;
    if (section.disabled) delete section.disabled;
    else section.disabled = true;
    return next;
  });
}

export function addBlock(state: EditorState, docId: string, sectionId: string, block: ComponentNode): { state: EditorState; id: string | null } {
  const current = state.docs[docId];
  if (!current) return { state, id: null };
  try {
    const added = addNode(asPage(current), sectionId, block);
    return {
      id: added.id,
      state: select({ ...state, docs: { ...state.docs, [docId]: { ...current, document: added.doc as unknown as Record<string, unknown> } } }, { docId, sectionId, blockId: added.id }),
    };
  } catch {
    return { state, id: null };
  }
}

export function removeBlock(state: EditorState, docId: string, sectionId: string, blockId: string): EditorState {
  const next = withDoc(state, docId, (doc) => removeNode(doc, blockId));
  const sel = next.selection;
  return sel && "blockId" in sel && sel.blockId === blockId ? { ...next, selection: { docId, sectionId } } : next;
}

export function moveBlock(state: EditorState, docId: string, sectionId: string, blockId: string, toIndex: number, registry?: ComponentRegistry): EditorState {
  try {
    return withDoc(state, docId, (doc) => moveNode(doc, blockId, sectionId, toIndex, registry));
  } catch {
    return state;
  }
}

/** Sets one global theme setting, e.g. `("colors", "primary", "#1a5aaa")`. */
export function setThemeSetting(state: EditorState, docId: string, group: string, key: string, value: unknown): EditorState {
  const current = state.docs[docId];
  if (!current) return state;
  const doc = structuredClone(current.document) as { settings?: Record<string, Record<string, unknown>> };
  const settings = { ...(doc.settings ?? {}) };
  const values = { ...(settings[group] ?? {}) };
  if (value === undefined) delete values[key];
  else values[key] = value;
  settings[group] = values;
  return { ...state, docs: { ...state.docs, [docId]: { ...current, document: { ...doc, settings } } } };
}

/** The server accepted a save: remember the new revision and document as the baseline. */
export function markSaved(state: EditorState, docId: string, revision: number, savedDocument: Record<string, unknown>, savedAtEdit?: string): EditorState {
  const current = state.docs[docId];
  if (!current) return state;
  // Edits made while the save was in flight stay dirty: only the baseline moves, not the document.
  const stillSame = savedAtEdit === undefined || savedAtEdit === JSON.stringify(current.document);
  return {
    ...state,
    docs: { ...state.docs, [docId]: { ...current, revision, saved: JSON.stringify(savedDocument), document: stillSame ? savedDocument : current.document } },
  };
}

/** Replaces a document with the server's copy (after a conflict reload or a restored version). */
export function replaceDoc(state: EditorState, docId: string, revision: number, document: Record<string, unknown>): EditorState {
  const current = state.docs[docId];
  if (!current) return state;
  return { ...state, docs: { ...state.docs, [docId]: { ...current, revision, document, saved: JSON.stringify(document) } } };
}

export function sectionOrder(state: EditorState, docId: string): string[] {
  const d = state.docs[docId]?.document as { order?: string[] } | undefined;
  return d?.order ?? [];
}
