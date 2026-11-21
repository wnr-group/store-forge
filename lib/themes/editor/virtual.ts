import { withPageBackground } from "@/lib/storefront/documents";
import { defaultPageDocument, PAGE_LABELS, PAGES_GROUP, storedPageDocument, type PageKey } from "@/lib/storefront/pages";
import { isDirty, type EditorDoc, type EditorState } from "./state";

/**
 * Generated storefront pages (all products, collections, search, cart, wishlist) in the editor. They have no template of their
 * own: the page is held as an editable document next to the real ones, under the id `virtual:<key>`, and folded into the theme
 * document (`settings.pages[key]`) when it has changed, so the ordinary save, publish and versions carry it. Pure functions.
 */

export const VIRTUAL_PREFIX = "virtual:";
export const virtualId = (key: PageKey) => `${VIRTUAL_PREFIX}${key}`;
export const isVirtualId = (id: string) => id.startsWith(VIRTUAL_PREFIX);
export const virtualKey = (id: string): PageKey => id.slice(VIRTUAL_PREFIX.length) as PageKey;

const themeDocument = (state: EditorState, themeDocId: string) => state.docs[themeDocId]?.document;

function virtualDoc(state: EditorState, themeDocId: string, key: PageKey): EditorDoc {
  const document = structuredClone(storedPageDocument(themeDocument(state, themeDocId), key) ?? withPageBackground(defaultPageDocument(key), themeDocument(state, themeDocId))) as unknown as Record<string, unknown>;
  return { templateId: virtualId(key), kind: "index", name: PAGE_LABELS[key], revision: 0, document, saved: JSON.stringify(document) };
}

/** Adds the page to the state (from the theme's saved version, else the default) unless it is already open. */
export function openVirtualPage(state: EditorState, themeDocId: string, key: PageKey): EditorState {
  if (state.docs[virtualId(key)] || !state.docs[themeDocId]) return state;
  return { ...state, docs: { ...state.docs, [virtualId(key)]: virtualDoc(state, themeDocId, key) } };
}

function withPages(theme: Record<string, unknown>, change: (pages: Record<string, unknown>) => Record<string, unknown>): Record<string, unknown> {
  const settings = { ...((theme.settings as Record<string, unknown> | undefined) ?? {}) };
  const pages = change({ ...((settings[PAGES_GROUP] as Record<string, unknown> | undefined) ?? {}) });
  if (Object.keys(pages).length) settings[PAGES_GROUP] = pages;
  else delete settings[PAGES_GROUP];
  return { ...theme, settings };
}

/** Writes every changed generated page into the theme document, which then carries it to the server. */
export function foldVirtualPages(state: EditorState, themeDocId: string): EditorState {
  const theme = state.docs[themeDocId];
  const changed = Object.values(state.docs).filter((d) => isVirtualId(d.templateId) && isDirty(d));
  if (!theme || changed.length === 0) return state;
  let document = theme.document;
  const docs = { ...state.docs };
  for (const d of changed) {
    document = withPages(document, (pages) => ({ ...pages, [virtualKey(d.templateId)]: d.document }));
    docs[d.templateId] = { ...d, saved: JSON.stringify(d.document) };
  }
  docs[themeDocId] = { ...theme, document };
  return { ...state, docs };
}

/** Puts a page back to its generated default and removes the merchant's saved version from the theme. */
export function resetVirtualPage(state: EditorState, themeDocId: string, key: PageKey): EditorState {
  const theme = state.docs[themeDocId];
  if (!theme) return state;
  const fresh = virtualDoc({ ...state, docs: { ...state.docs, [themeDocId]: { ...theme, document: withPages(theme.document, (p) => { delete p[key]; return p; }) } } }, themeDocId, key);
  return {
    ...state,
    selection: null,
    docs: { ...state.docs, [themeDocId]: { ...theme, document: withPages(theme.document, (p) => { delete p[key]; return p; }) }, [virtualId(key)]: fresh },
  };
}

/** After the theme document was replaced by the server's copy (conflict reload, restored version): re-read every open page from it. */
export function rebuildVirtualPages(state: EditorState, themeDocId: string): EditorState {
  const docs = { ...state.docs };
  for (const id of Object.keys(docs)) if (isVirtualId(id)) docs[id] = virtualDoc({ ...state, docs }, themeDocId, virtualKey(id));
  return { ...state, docs };
}

/** Is the page saved in the theme (edited by the merchant)? */
export const hasStoredPage = (state: EditorState, themeDocId: string, key: PageKey) => storedPageDocument(themeDocument(state, themeDocId), key) !== null;
