import type { DraftCheck } from "@/lib/themes/editor/draft-checks";
import type { SnapshotEntry } from "@/lib/themes/editor/history";
import {
  canonicalPresentation,
  EMPTY_PRESENTATION,
  isEmptyPresentation,
  parsePresentation,
  presentationKey,
  type GalleryLayout,
  type HideableBlock,
  type MediaPosition,
  type ProductPresentation,
  HIDEABLE_BLOCKS,
} from "@/lib/templates/product-presentation";
import type { PresentationDetail, PresentationState } from "@/lib/themes/types";

/**
 * The editor's local copy of each product's presentation, kept apart from the template documents (`EditorDoc`): they are
 * saved to a different endpoint, with their own revision, and a conflict on one never touches the other. Plain data and
 * pure functions (no React), so every edit is unit-tested. Each function returns a NEW state and never mutates its input.
 *
 * The draft is always held in its canonical form (known keys only, fixed order, empty parts omitted), so "unsaved changes"
 * compares meaning, not the key order the database happens to return.
 */

export type PresentationEntry = {
  productId: string;
  name: string;
  slug: string;
  /** The revision this copy was loaded or last saved at; sent back as `expectedRevision`. 0: the product has no row yet. */
  revision: number;
  /** What the server says about the stored row. */
  publicationState: PresentationState;
  /** The draft being edited. */
  document: ProductPresentation;
  /** Canonical JSON of the last persisted draft. */
  saved: string;
  /** What shoppers see now (null when never published). */
  published: ProductPresentation | null;
  publishedAt: string | null;
  /**
   * Counts the times the server's copy replaced this one with different content or a different revision (a reload, a
   * product loaded again, a reset). An undo step taken under an older epoch must never be restored into a newer one.
   */
  epoch: number;
  /**
   * Set when the stored settings are in a form this editor cannot read (a newer schema version). Such an entry is shown
   * but never edited, saved or published from here, so its unknown content cannot be downgraded or discarded.
   */
  unsupported: { version: number | null } | null;
};

export type PresentationStore = { entries: Record<string, PresentationEntry> };

export const createPresentationStore = (): PresentationStore => ({ entries: {} });

/** Null when the document is one this editor supports; otherwise which version it declares (null when it declares none). */
export function unsupportedVersionOf(document: unknown): { version: number | null } | null {
  if (parsePresentation(document) !== null) return null;
  const v = (document as { schemaVersion?: unknown } | null)?.schemaVersion;
  return { version: typeof v === "number" ? v : null };
}

export function entryFromDetail(detail: PresentationDetail, meta: { name: string; slug: string }): PresentationEntry {
  const unsupported = unsupportedVersionOf(detail.document);
  // An unsupported draft is displayed as "nothing set" and is read-only; the original is never rewritten from this copy.
  const document = canonicalPresentation(unsupported ? null : detail.document);
  return {
    productId: detail.productId,
    name: meta.name,
    slug: meta.slug,
    revision: detail.revision,
    publicationState: detail.publicationState,
    document,
    saved: presentationKey(document),
    published: detail.publishedDocument ? canonicalPresentation(detail.publishedDocument) : null,
    publishedAt: detail.publishedAt,
    epoch: 0,
    unsupported,
  };
}

/** Never dirty when unsupported: nothing is ever saved for it. */
export const isEntryDirty = (e: PresentationEntry): boolean => !e.unsupported && presentationKey(e.document) !== e.saved;
export const dirtyEntries = (s: PresentationStore): PresentationEntry[] => Object.values(s.entries).filter(isEntryDirty);

/**
 * True when publishing would change what shoppers see. A product that was never published and has no settings (the
 * empty "inherit everything" draft the API keeps after every setting was reverted) has nothing to publish: the API
 * ignores it too. A published product has something to publish when its draft differs from the live copy.
 */
export function hasPendingPublish(e: PresentationEntry): boolean {
  if (e.unsupported) return false;
  if (e.published === null) return !isEmptyPresentation(e.document);
  return presentationKey(e.document) !== presentationKey(e.published);
}
export const isWaitingToPublish = hasPendingPublish;

/** True when the server's copy differs from this one in a way that makes older local undo steps wrong. */
export function serverChangesEntry(e: PresentationEntry, detail: PresentationDetail): boolean {
  if (e.revision !== detail.revision) return true;
  const unsupported = unsupportedVersionOf(detail.document);
  if (Boolean(unsupported) !== Boolean(e.unsupported)) return true;
  return !unsupported && presentationKey(detail.document) !== e.saved;
}

/** Takes the server's copy for an existing entry; bumps the epoch only when it really is different. */
function takeServerCopy(current: PresentationEntry, detail: PresentationDetail): PresentationEntry {
  const next = entryFromDetail(detail, { name: current.name, slug: current.slug });
  const changed = serverChangesEntry(current, detail) || presentationKey(next.document) !== presentationKey(current.document);
  return { ...next, epoch: current.epoch + (changed ? 1 : 0) };
}

export function putEntry(s: PresentationStore, entry: PresentationEntry): PresentationStore {
  return { entries: { ...s.entries, [entry.productId]: entry } };
}

function withEntry(s: PresentationStore, productId: string, change: (doc: ProductPresentation) => ProductPresentation): PresentationStore {
  const current = s.entries[productId];
  // An entry in an unsupported (newer) version is read-only: editing it would downgrade what is stored.
  if (!current || current.unsupported) return s;
  const next = canonicalPresentation(change(structuredClone(current.document)));
  return presentationKey(next) === presentationKey(current.document) ? s : { entries: { ...s.entries, [productId]: { ...current, document: next } } };
}

/** `undefined` removes the setting, so the store design applies again. */
export function setGalleryLayout(s: PresentationStore, productId: string, layout: GalleryLayout | undefined): PresentationStore {
  return withEntry(s, productId, (doc) => setGallery(doc, "layout", layout));
}

export function setMediaPosition(s: PresentationStore, productId: string, position: MediaPosition | undefined): PresentationStore {
  return withEntry(s, productId, (doc) => setGallery(doc, "mediaPosition", position));
}

function setGallery(doc: ProductPresentation, key: "layout" | "mediaPosition", value: GalleryLayout | MediaPosition | undefined): ProductPresentation {
  const gallery: Record<string, unknown> = { ...(doc.gallery ?? {}) };
  if (value === undefined) delete gallery[key];
  else gallery[key] = value;
  const { gallery: _old, ...rest } = doc;
  void _old;
  return Object.keys(gallery).length > 0 ? ({ ...rest, gallery } as ProductPresentation) : rest;
}

/** Percentages are kept to whole numbers from 0 to 100. `undefined` clears the focal point (centre, as before). */
export function setFocalPoint(s: PresentationStore, productId: string, point: { x: number; y: number } | undefined): PresentationStore {
  return withEntry(s, productId, (doc) => {
    const { focalPoint: _old, ...rest } = doc;
    void _old;
    if (!point) return rest;
    const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(Number.isFinite(n) ? n : 50)));
    return { ...rest, focalPoint: { x: clamp(point.x), y: clamp(point.y) } };
  });
}

/** Hides or shows one supported block (or the related-products section) for this product only. */
export function setBlockHidden(s: PresentationStore, productId: string, block: HideableBlock, hidden: boolean): PresentationStore {
  return withEntry(s, productId, (doc) => {
    const set = new Set(doc.hiddenBlocks ?? []);
    if (hidden) set.add(block);
    else set.delete(block);
    const { hiddenBlocks: _old, ...rest } = doc;
    void _old;
    const list = HIDEABLE_BLOCKS.filter((b) => set.has(b));
    return list.length > 0 ? { ...rest, hiddenBlocks: list } : rest;
  });
}

/** Removes every local change back to what is stored (not a server reset). */
export function discardChanges(s: PresentationStore, productId: string): PresentationStore {
  const current = s.entries[productId];
  if (!current || current.unsupported) return s;
  return putEntry(s, { ...current, document: canonicalPresentation(JSON.parse(current.saved)) });
}

/**
 * The server accepted a save: remember the new revision and state as the baseline. Edits made while the save was in
 * flight stay dirty: only the baseline moves, not the draft being edited.
 */
export function markEntrySaved(s: PresentationStore, detail: PresentationDetail, savedAtEdit: string): PresentationStore {
  const current = s.entries[detail.productId];
  if (!current) return s;
  const savedDoc = canonicalPresentation(detail.document);
  const stillSame = savedAtEdit === presentationKey(current.document);
  return putEntry(s, {
    ...current,
    revision: detail.revision,
    publicationState: detail.publicationState,
    saved: presentationKey(savedDoc),
    document: stillSame ? savedDoc : current.document,
    published: detail.publishedDocument ? canonicalPresentation(detail.publishedDocument) : null,
    publishedAt: detail.publishedAt,
  });
}

/**
 * Replaces the entry with the server's copy (after a conflict reload, a publish or a reset). When the copy is really
 * different (revision or content) the entry's epoch moves on, so no undo step from before can be restored into it.
 */
export function replaceEntry(s: PresentationStore, detail: PresentationDetail): PresentationStore {
  const current = s.entries[detail.productId];
  if (!current) return s;
  return putEntry(s, takeServerCopy(current, detail));
}

/** The draft as the preview renders it: the entry's own draft, or `fallback` (the published one) for a product not loaded. */
export function previewPresentation(s: PresentationStore, productId: string | null, fallback: unknown): ProductPresentation | null {
  const entry = productId ? s.entries[productId] : undefined;
  if (entry) return entry.document;
  return fallback ? canonicalPresentation(fallback) : null;
}

export const defaultDocument = (): ProductPresentation => ({ ...EMPTY_PRESENTATION });

/** Which of the six supported items this page template can show at all (an item the page does not have has nothing to hide). */
export function availableItems(pageDocument: unknown): Record<HideableBlock, boolean> {
  const out = Object.fromEntries(HIDEABLE_BLOCKS.map((b) => [b, false])) as Record<HideableBlock, boolean>;
  const sections = ((pageDocument as { sections?: Record<string, { type?: string; blocks?: Record<string, { type?: string }> }> } | null)?.sections ?? {}) as Record<string, { type?: string; blocks?: Record<string, { type?: string }> }>;
  for (const section of Object.values(sections)) {
    if (section?.type === "related-products") out["related-products"] = true;
    if (section?.type === "main-product") {
      for (const block of Object.values(section.blocks ?? {})) {
        if (block?.type && (HIDEABLE_BLOCKS as readonly string[]).includes(block.type) && block.type !== "related-products") out[block.type as HideableBlock] = true;
      }
    }
  }
  return out;
}

// ---- logic the editor shell uses, kept pure so it is unit-tested ----------------------------------------------------

/**
 * A product was loaded (picked, or a deep link). A copy with unsaved edits is kept exactly as it is, so switching away and
 * back never loses work; otherwise the server's copy is used. Other products are never touched.
 */
export function mergeLoadedProduct(s: PresentationStore, loaded: { productId: string; name: string; slug: string; presentation: PresentationDetail | null }): PresentationStore {
  const existing = s.entries[loaded.productId];
  if ((existing && isEntryDirty(existing)) || !loaded.presentation) return s;
  if (existing) return putEntry(s, takeServerCopy({ ...existing, name: loaded.name, slug: loaded.slug }, loaded.presentation));
  return putEntry(s, entryFromDetail(loaded.presentation, { name: loaded.name, slug: loaded.slug }));
}

/** The API names fields `productPresentation.<productId>.gallery.layout`; the editor wants the path inside the document. */
export function problemsFromFieldErrors(productId: string, fieldErrors: Record<string, string>): Record<string, string> {
  const prefix = `productPresentation.${productId}.`;
  const out: Record<string, string> = {};
  for (const [field, message] of Object.entries(fieldErrors)) {
    // The document itself (no path) is the empty key, as in `validatePresentation`.
    if (field === `productPresentation.${productId}`) out[""] = message;
    else out[field.startsWith(prefix) ? field.slice(prefix.length) : field] = message;
  }
  return out;
}

/** Products that will go live with the next publish: a loaded product by its own state, any other by the API's list. */
export function summarizeWaiting(
  list: { productId: string; publicationState: PresentationState }[],
  s: PresentationStore,
  checks: ReadonlyMap<string, DraftCheck> = new Map(),
): { waiting: Set<string>; unverified: Set<string> } {
  const waiting = new Set<string>();
  const unverified = new Set<string>();
  for (const row of list) {
    if (row.publicationState === "published_with_changes") waiting.add(row.productId);
    else if (row.publicationState === "draft") {
      // A never-published row may be an empty draft, which publishing ignores. Only a read can tell; until it has, the row is
      // neither counted as waiting nor as empty.
      const check = checks.get(row.productId);
      if (check === "real") waiting.add(row.productId);
      else if (check === undefined) unverified.add(row.productId);
    }
  }
  // A product loaded in the editor is judged from its own document, which is always up to date.
  for (const e of Object.values(s.entries)) {
    unverified.delete(e.productId);
    if (hasPendingPublish(e)) waiting.add(e.productId);
    else waiting.delete(e.productId);
  }
  return { waiting, unverified };
}

/** The toast after a publish-all, from the API's counts. */
export function publishedMessage(pages: number, products: number): string {
  const parts = [pages ? `${pages} ${pages === 1 ? "page" : "pages"}` : null, products ? `${products} ${products === 1 ? "product" : "products"}` : null].filter(Boolean);
  return parts.length ? `Published ${parts.join(" and ")}` : "Your store is already up to date";
}

/**
 * Puts the product drafts of an undo or redo step back. An entry is restored only when the step was taken under the same
 * server epoch: after the server's copy replaced it (a reload, a product loaded again, a reset) older content is never
 * written into it, so undo can never turn a newer revision into older content and have autosave overwrite someone else's save.
 */
export function restoreDrafts(s: PresentationStore, step: Record<string, SnapshotEntry>): PresentationStore {
  let entries = s.entries;
  for (const [id, saved] of Object.entries(step)) {
    const e = entries[id];
    if (!e || e.unsupported || (saved.epoch ?? 0) !== e.epoch) continue;
    const restored = canonicalPresentation(JSON.parse(saved.raw));
    if (presentationKey(restored) === presentationKey(e.document)) continue;
    entries = { ...entries, [id]: { ...e, document: restored } };
  }
  return entries === s.entries ? s : { entries };
}

export type ProductActionState = { edit: boolean; publish: boolean; reset: boolean };

/**
 * What the Product controls may do right now. While another product is loading nothing may act (the controls would still
 * belong to the previous product), and an unsupported-version entry can be neither edited nor published.
 */
export function productActions(v: { loadStatus: "idle" | "loading" | "ready" | "error"; canEdit: boolean; busy: boolean; entry: PresentationEntry | null }): ProductActionState {
  const open = v.canEdit && !v.busy && v.loadStatus !== "loading" && v.entry !== null;
  const entry = v.entry;
  return {
    edit: open && !entry!.unsupported,
    publish: open && hasPendingPublish(entry!),
    reset: open && (entry!.publicationState !== "default" || isEntryDirty(entry!)),
  };
}

/**
 * Splits the field errors of a failed publish-all: those about one product (`productPresentation.<id>.<path>`), by product,
 * and everything else, untouched, for the generic handling.
 */
export function splitProductFieldErrors(fieldErrors: Record<string, string> | undefined): { byProduct: Record<string, Record<string, string>>; other: Record<string, string> } {
  const byProduct: Record<string, Record<string, string>> = {};
  const other: Record<string, string> = {};
  for (const [field, message] of Object.entries(fieldErrors ?? {})) {
    const m = /^productPresentation\.([0-9a-fA-F-]{36})(?:\.(.+))?$/.exec(field);
    if (m) (byProduct[m[1]] ??= {})[m[2] ?? ""] = message;
    else other[field] = message;
  }
  return { byProduct, other };
}
