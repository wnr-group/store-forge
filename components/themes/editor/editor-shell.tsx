"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Check, CircleAlert, Eye, History, Loader2, Monitor, Package, Palette, PanelLeft, Redo2, Rocket, Smartphone, Tablet, Undo2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { getPresentationAction, getTemplateAction, loadProductPreviewAction, saveDraftAction, savePresentationDraftAction } from "@/app/(dashboard)/dashboard/templates/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/native-select";
import { ROUTES } from "@/config/app";
import type { TemplateDocument } from "@/lib/templates/document";
import { validateDocument } from "@/lib/templates/engine/validate";
import { getRegistry } from "@/lib/templates/registry/index";
import { effectiveGalleryLayout, effectiveMediaPosition, presentationKey, validatePresentation, type GalleryLayout, type HideableBlock, type MediaPosition } from "@/lib/templates/product-presentation";
import {
  availableItems, createPresentationStore, dirtyEntries, entryFromDetail, hasPendingPublish, isEntryDirty, markEntrySaved, mergeLoadedProduct, previewPresentation, problemsFromFieldErrors, productActions, publishedMessage, putEntry, replaceEntry,
  restoreDrafts, splitProductFieldErrors, summarizeWaiting,
  setBlockHidden, setFocalPoint, setGalleryLayout, setMediaPosition, type PresentationStore,
} from "@/lib/themes/editor/presentation-state";
import {
  addBlock, addSection, createBlockNode, createState, dirtyDocs, duplicateSection, isDirty, markSaved, moveBlock, moveSection, removeBlock, removeSection,
  replaceDoc, restoreDocs, select, setSetting, setThemeSetting, toggleSection, type EditorDoc, type EditorState,
} from "@/lib/themes/editor/state";
import { ActionError, themeKeys, useDraftChecks, usePresentationList, usePublishPresentation, usePublishTheme, useResetPresentation, useTemplates } from "@/lib/themes/queries";
import { hasStoreProducts, previewData, type PreviewData, type PreviewMode } from "@/lib/themes/preview-data";
import type { PickerProduct, PreviewStoreData, ProductPreview, TemplateSummary, ThemeKind } from "@/lib/themes/types";
import { cn } from "@/lib/utils";
import { draftsToCheck } from "@/lib/themes/editor/draft-checks";
import { createFlusher, saveFailureMessage, type FlushResult } from "@/lib/themes/editor/flusher";
import { productLayoutState, publicationStatus, refetchTemplateStatesOnOpen, refreshTemplateStates } from "@/lib/themes/refresh";
import { advanceHistory, canRedo, canUndo, clearHistory, mergeRestored, pruneHistory, redo, snapshotOf, undo, type Snapshot } from "@/lib/themes/editor/history";
import { ProductCustomizer } from "./product-customizer";
import { ProductPicker } from "./product-picker";
import type { ProductStatus } from "./product-status";
import { useHistoryStore } from "./use-history";
import { SectionsPanel, type SectionActions } from "./sections-panel";
import { CollectionChoicesContext } from "./setting-field";
import { SettingsPanel } from "./settings-panel";
import { VersionsSheet } from "./versions-sheet";
import { PreviewModeNote, PreviewModeSwitch } from "../preview-mode-switch";
import { ThemeFrame, type Device } from "../theme-frame";

const registry = getRegistry();
const AUTOSAVE_MS = 1500;

export type EditorInit = {
  tenantId: string;
  canManage: boolean;
  storeSlug: string;
  themeName: string | null;
  pages: Pick<TemplateSummary, "id" | "kind" | "name">[];
  pageId: string;
  docs: Omit<EditorDoc, "saved">[];
  data: PreviewStoreData;
  /** The product the Product page preview starts with (a deep link, or the store's first product), loaded on the server. */
  initialProduct?: ProductPreview | null;
  /** Why that product could not be loaded, if it could not. */
  initialProductError?: string | null;
};

type SaveStatus = "saved" | "unsaved" | "saving" | "error" | "conflict" | "invalid";

const PAGE_LABEL: Partial<Record<ThemeKind, string>> = { index: "Home page", product: "Product page", collection: "Collection page" };
const DEVICES: { id: Device; label: string; icon: typeof Monitor }[] = [
  { id: "desktop", label: "Desktop", icon: Monitor },
  { id: "tablet", label: "Tablet", icon: Tablet },
  { id: "mobile", label: "Mobile", icon: Smartphone },
];

type PreviewProductState = { status: "idle" | "loading" | "ready" | "error"; productId: string | null; resource: Record<string, unknown> | null; error: string | null; presentationError: string | null };
const NO_PRODUCT: PreviewProductState = { status: "idle", productId: null, resource: null, error: null, presentationError: null };
type ProductTarget = { productId?: string; slug?: string };

/**
 * The product or collection a product or collection page shows: the store's own in "store" mode, sample content in "demo".
 * `product` is the product the owner picked (already carrying the settings being edited); without one the first product shows, as before.
 */
function resourceFor(kind: ThemeKind, data: PreviewData, product?: Record<string, unknown> | null): Record<string, unknown> | undefined {
  if (kind === "product") {
    if (product) return product;
    if (data.productPage) return data.productPage;
    const p = data.store.products[0];
    return p ? { ...p, images: p.image_path ? [p.image_path] : [], options: [], variants: [], short_description: p.short_description } : undefined;
  }
  if (kind === "collection") {
    const c = data.collections[0];
    return c ? { ...c, products: data.collectionProducts?.[c.slug] ?? [] } : undefined;
  }
  return undefined;
}

export function EditorShell({ init }: { init: EditorInit }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [state, setState] = useState<EditorState>(() => createState(init.pageId, init.docs));
  // The merchant's real catalogue by default; demo content only on request, and never saved anywhere.
  const [previewMode, setPreviewMode] = useState<PreviewMode>("store");
  const preview = useMemo(() => previewData(init.data, previewMode), [init.data, previewMode]);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  // What the server round trip is doing; the visible status below is derived from this and the document state.
  const [saveState, setSaveState] = useState<"idle" | "saving" | "error" | "conflict">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [serverProblems, setServerProblems] = useState<Record<string, Record<string, string>>>({});
  const [device, setDevice] = useState<Device>("desktop");
  const [leftTab, setLeftTab] = useState<"sections" | "theme" | "product">("sections");
  const [mobileTab, setMobileTab] = useState<"sections" | "preview" | "settings">("preview");
  const [previewing, setPreviewing] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  // True from the click on Publish until it has finished, including the time spent waiting for a save in progress.
  const [publishing, setPublishing] = useState(false);
  const [loadingPage, setLoadingPage] = useState(false);
  const saving = useRef(false);
  const retries = useRef(0);

  // ---- per-product presentation: its own state, revisions and saves, apart from the template documents ----------
  const [presStore, setPresStore] = useState<PresentationStore>(() =>
    init.initialProduct?.presentation
      ? putEntry(createPresentationStore(), entryFromDetail(init.initialProduct.presentation, { name: init.initialProduct.name, slug: init.initialProduct.slug }))
      : createPresentationStore(),
  );
  const presRef = useRef(presStore);
  useEffect(() => {
    presRef.current = presStore;
  }, [presStore]);
  const [previewProduct, setPreviewProduct] = useState<PreviewProductState>(() =>
    init.initialProduct
      ? { status: "ready", productId: init.initialProduct.productId, resource: init.initialProduct.resource, error: null, presentationError: init.initialProduct.presentationError }
      : init.initialProductError
        ? { ...NO_PRODUCT, status: "error", error: init.initialProductError }
        : NO_PRODUCT,
  );
  // The product being loaded after a pick: until it arrives nothing product-specific may act, so no action can reach the previous one.
  const [loadingProduct, setLoadingProduct] = useState<{ id: string | null; name: string | null } | null>(null);
  const [presServerProblems, setPresServerProblems] = useState<Record<string, Record<string, string>>>({});
  const [presConflict, setPresConflict] = useState<string | null>(null);
  const [presBusy, setPresBusy] = useState<"publishing" | "resetting" | null>(null);
  const loadToken = useRef(0);
  const lastTarget = useRef<ProductTarget | null>(null);
  const presList = usePresentationList();
  // Undo and redo over every draft being edited (pages, shared parts and product settings). Not part of what is saved.
  const undoStack = useHistoryStore();
  const lastSnap = useRef<Snapshot | null>(null);
  const undoRef = useRef<() => void>(() => {});
  const redoRef = useRef<() => void>(() => {});
  const publishProduct = usePublishPresentation();
  const resetProduct = useResetPresentation();

  const templates = useTemplates();
  const publish = usePublishTheme();

  const page = state.docs[state.pageId];
  const byKind = (kind: ThemeKind) => Object.values(state.docs).find((d) => d.kind === kind)?.templateId ?? null;
  const groupIds = { announcement: byKind("group_announcement"), header: byKind("group_header"), footer: byKind("group_footer") };
  const themeDocId = byKind("theme_settings");

  // ---- local validation: the engine's own rules, before anything is sent ---------------------------------------
  const localProblems = useMemo(() => {
    const out: Record<string, Record<string, string>> = {};
    for (const d of dirtyDocs(state)) {
      const result = validateDocument(d.kind, d.document, registry, { tenantId: init.tenantId });
      if (!result.ok) {
        const errors = result.issues.filter((i) => i.level === "error");
        if (errors.length) out[d.templateId] = Object.fromEntries(errors.map((i) => [i.path, i.message]));
      }
    }
    return out;
  }, [state, init.tenantId]);
  const presLocalProblems = useMemo(() => {
    const out: Record<string, Record<string, string>> = {};
    for (const e of dirtyEntries(presStore)) {
      const found = validatePresentation(e.document);
      if (Object.keys(found).length) out[e.productId] = found;
    }
    return out;
  }, [presStore]);
  const hasLocalProblems = Object.keys(localProblems).length > 0 || Object.keys(presLocalProblems).length > 0;
  const problems = useMemo(() => {
    const merged: Record<string, Record<string, string>> = { ...serverProblems };
    for (const [id, p] of Object.entries(localProblems)) merged[id] = { ...merged[id], ...p };
    return merged;
  }, [serverProblems, localProblems]);

  const dirtyCount = dirtyDocs(state).length + dirtyEntries(presStore).length;
  const status: SaveStatus =
    saveState === "conflict" ? "conflict" : saveState === "saving" ? "saving" : saveState === "error" ? "error" : hasLocalProblems ? "invalid" : dirtyCount > 0 ? "unsaved" : "saved";

  const canEdit = init.canManage && status !== "conflict";

  // ---- saving --------------------------------------------------------------------------------------------------
  // One save run. It is started through `flusher`, which allows only one at a time and lets Publish wait for it.
  const runFlush = useCallback(async (): Promise<FlushResult> => {
    saving.current = true;
    // True once any page draft was saved in this run: the list of publication states is read again once, however this run ends.
    let savedPage = false;
    setSaveState("saving");
    setSaveError(null);
    try {
      for (const doc of dirtyDocs(stateRef.current)) {
        const json = JSON.stringify(doc.document);
        const result = await saveDraftAction({ id: doc.templateId, document: doc.document, expectedRevision: doc.revision });
        if (!result.ok) {
          if (result.code === "CONFLICT") {
            setPresConflict(null);
            setSaveState("conflict");
            return { ok: false, reason: "conflict" };
          }
          if (result.fieldErrors) {
            const mapped: Record<string, string> = {};
            for (const [key, message] of Object.entries(result.fieldErrors)) mapped[key.startsWith(`${doc.kind}.`) ? key.slice(doc.kind.length + 1) : key] = message;
            setServerProblems((prev) => ({ ...prev, [doc.templateId]: mapped }));
          }
          setSaveState("error");
          setSaveError(result.error);
          return { ok: false, reason: result.fieldErrors ? "validation" : "error", message: result.error };
        }
        const saved = result.data!;
        setServerProblems((prev) => ({ ...prev, [doc.templateId]: {} }));
        setState((prev) => markSaved(prev, doc.templateId, saved.revision, saved.document, json));
        savedPage = true;
      }
      // Product settings are saved after the pages, each with its own revision. A 409 here concerns that product only.
      for (const entry of dirtyEntries(presRef.current)) {
        const key = presentationKey(entry.document);
        const result = await savePresentationDraftAction({ productId: entry.productId, document: entry.document, expectedRevision: entry.revision });
        if (!result.ok) {
          if (result.code === "CONFLICT") {
            setPresConflict(entry.productId);
            setSaveState("conflict");
            return { ok: false, reason: "conflict" };
          }
          if (result.fieldErrors) {
            const mapped = problemsFromFieldErrors(entry.productId, result.fieldErrors);
            setPresServerProblems((prev) => ({ ...prev, [entry.productId]: mapped }));
          }
          setSaveState("error");
          setSaveError(result.error);
          return { ok: false, reason: result.fieldErrors ? "validation" : "error", message: result.error };
        }
        const savedEntry = result.data!;
        setPresServerProblems((prev) => ({ ...prev, [entry.productId]: {} }));
        setPresStore((prev) => markEntrySaved(prev, savedEntry, key));
      }
      retries.current = 0;
      setSaveState("idle");
      return { ok: true };
    } catch {
      setSaveState("error");
      setSaveError("Your changes could not be saved. Check your connection.");
      return { ok: false, reason: "error", message: "Your changes could not be saved. Check your connection." };
    } finally {
      saving.current = false;
      // Saving moved the pages' publication state on the server (published -> published with changes). Product settings do not,
      // so they never trigger this. Not awaited: it must not delay the end of the save.
      if (savedPage) void refreshTemplateStates(queryClient);
    }
  }, [queryClient]);

  // Created once; it always runs the latest save run.
  const [flusher] = useState(() => createFlusher());
  useEffect(() => {
    flusher.setRun(runFlush);
  }, [flusher, runFlush]);
  /** Autosave and leaving: starts a save, or says false while one is already running (unchanged). Publishing waits instead: see flusher.settle. */
  const flush = useCallback(async (): Promise<boolean> => {
    if (flusher.isRunning()) return false;
    return (await flusher.flush()).ok;
  }, [flusher]);
  /** Everything (pages, shared parts, product settings) is saved. */
  const allSaved = () => dirtyDocs(stateRef.current).length === 0 && dirtyEntries(presRef.current).length === 0;
  /** Product settings are saved. */
  const productsSaved = () => dirtyEntries(presRef.current).length === 0;
  /** The product page is edited here and not yet saved. */
  const productPageDirty = () => {
    const id = init.pages.find((p) => p.kind === "product")?.id;
    const doc = id ? stateRef.current.docs[id] : undefined;
    return doc ? isDirty(doc) : false;
  };

  useEffect(() => {
    // Debounced autosave. A failed save retries a few times with a growing pause, then waits for the merchant.
    if (status !== "unsaved" && status !== "error") return;
    if (status === "error" && retries.current >= 3) return;
    const delay = status === "error" ? Math.min(30_000, 4000 * 2 ** retries.current) : AUTOSAVE_MS;
    const timer = setTimeout(() => {
      if (status === "error") retries.current += 1;
      void flush();
    }, delay);
    return () => clearTimeout(timer);
  }, [state, presStore, status, flush]);

  useEffect(() => {
    // Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z or Ctrl+Y redoes. Inside a text field the browser's own undo keeps working.
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        undoRef.current();
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        redoRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirtyDocs(stateRef.current).length > 0 || dirtyEntries(presRef.current).length > 0 || saving.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  // ---- edits ---------------------------------------------------------------------------------------------------
  const edit = useCallback((fn: (s: EditorState) => EditorState) => {
    setState((prev) => fn(prev));
    setSaveState((s) => (s === "error" ? "idle" : s));
  }, []);

  const actions: SectionActions = useMemo(
    () => ({
      select: (docId, sectionId, blockId) => { edit((s) => select(s, { docId, sectionId, blockId })); setLeftTab("sections"); setMobileTab("settings"); },
      toggle: (docId, sectionId) => edit((s) => toggleSection(s, docId, sectionId)),
      duplicate: (docId, sectionId) => edit((s) => duplicateSection(s, docId, sectionId)),
      remove: (docId, sectionId) => edit((s) => removeSection(s, docId, sectionId)),
      move: (docId, sectionId, toIndex) => edit((s) => moveSection(s, docId, sectionId, toIndex, registry)),
      add: (docId, type, index) => {
        const def = registry.sections[type];
        if (def) edit((s) => addSection(s, docId, def, registry, index).state);
        setMobileTab("settings");
      },
      addBlock: (docId, sectionId, type) => {
        const block = createBlockNode(type, registry);
        if (block) edit((s) => addBlock(s, docId, sectionId, block).state);
      },
      removeBlock: (docId, sectionId, blockId) => edit((s) => removeBlock(s, docId, sectionId, blockId)),
      moveBlock: (docId, sectionId, blockId, toIndex) => edit((s) => moveBlock(s, docId, sectionId, blockId, toIndex, registry)),
    }),
    [edit],
  );

  const onPreviewSelect = useCallback(
    (target: { sectionId: string; blockId?: string }) => {
      const s = stateRef.current;
      const order = [s.pageId, ...Object.keys(s.docs).filter((id) => id !== s.pageId)];
      const docId = order.find((id) => (s.docs[id].document as { sections?: Record<string, unknown> }).sections?.[target.sectionId]);
      if (docId) {
        edit((prev) => select(prev, { docId, sectionId: target.sectionId, blockId: target.blockId }));
        setLeftTab("sections");
        setMobileTab("settings");
      }
    },
    [edit],
  );

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
    setState((prev) => restoreDocs(prev, snap.docs));
    // A product draft is put back only if it still belongs to the same server epoch (see restoreDrafts).
    setPresStore((prev) => restoreDrafts(prev, snap.pres));
    setSaveState((s) => (s === "error" ? "idle" : s));
  }, []);

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

  // ---- product preview and product settings ------------------------------------------------------------------
  const editPres = useCallback((fn: (s: PresentationStore) => PresentationStore) => {
    setPresStore((prev) => fn(prev));
    setSaveState((s) => (s === "error" ? "idle" : s));
  }, []);

  /** Keeps the address in step with the chosen product, so the page can be reloaded or shared. No navigation, no refetch. */
  const syncProductParam = useCallback((id: string | null) => {
    try {
      const url = new URL(window.location.href);
      if (id) url.searchParams.set("product", id);
      else url.searchParams.delete("product");
      window.history.replaceState(window.history.state, "", url);
    } catch {
      // Not essential.
    }
  }, []);

  /** Loads one product (as the storefront renders it) and its settings. A newer pick wins over a slower earlier one. */
  const loadProduct = useCallback(
    async (target: ProductTarget, name: string | null = null) => {
      const token = ++loadToken.current;
      lastTarget.current = target;
      setPreviewProduct((p) => ({ ...p, status: "loading", error: null }));
      setLoadingProduct({ id: target.productId ?? null, name });
      const result = await loadProductPreviewAction(target);
      if (token !== loadToken.current) return;
      setLoadingProduct(null);
      if (!result.ok) {
        setPreviewProduct((p) => ({ ...p, status: "error", error: result.error }));
        toast.error(result.error);
        return;
      }
      const loaded = result.data!;
      // A copy with unsaved edits is kept as it is; otherwise the server's copy replaces whatever was here. When that copy
      // differs from the one held (someone else saved) the entry moves to a new epoch, and the history prunes that product's
      // steps by itself (advanceHistory): Undo can never bring older content back over the newer revision, and no stale step
      // stays on offer. Other products' steps are untouched.
      setPresStore((prev) => mergeLoadedProduct(prev, loaded));
      setPreviewProduct({ status: "ready", productId: loaded.productId, resource: loaded.resource, error: null, presentationError: loaded.presentationError });
      syncProductParam(loaded.productId);
    },
    [syncProductParam],
  );

  const onPickProduct = (p: PickerProduct) => {
    if (p.id === previewProduct.productId && previewProduct.status === "ready") return;
    void loadProduct({ productId: p.id }, p.name);
    setMobileTab("settings");
  };

  const firstProductSlug = init.data.store.products[0]?.slug;

  const reloadPresentation = async (productId: string) => {
    const result = await getPresentationAction(productId);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setPresStore((prev) => replaceEntry(prev, result.data!));
    setPresServerProblems((prev) => ({ ...prev, [productId]: {} }));
    setPresConflict(null);
    setSaveState("idle");
    toast.success("Loaded the latest settings for this product");
  };

  /** After a publish: bring each loaded product's state (and live copy) up to date. Unsaved edits are never overwritten. */
  const refreshEntries = async () => {
    await Promise.all(
      Object.values(presRef.current.entries)
        .filter((e) => !isEntryDirty(e))
        .map(async (e) => {
          const result = await getPresentationAction(e.productId);
          if (!result.ok) return;
          // A copy that really changed on the server moves the entry to a new epoch and prunes its steps; a plain publish does not.
          setPresStore((prev) => (prev.entries[e.productId] && !isEntryDirty(prev.entries[e.productId]) ? replaceEntry(prev, result.data!) : prev));
        }),
    );
  };

  const publishThisProduct = async () => {
    const id = previewProduct.productId;
    if (!id || !productActions({ loadStatus: previewProduct.status, canEdit, busy: presBusy !== null, entry: presRef.current.entries[id] ?? null }).publish) return;
    setPresBusy("publishing");
    try {
      // A save already running (autosave) is waited for, not mistaken for a failed one; product edits made since are saved too.
      if (hasLocalProblems && !productsSaved()) {
        toast.error("Fix the highlighted problems before publishing.");
        return;
      }
      const saved = await flusher.settle(productsSaved);
      if (!saved.ok) {
        toast.error(saveFailureMessage(saved));
        return;
      }
      const entry = presRef.current.entries[id];
      if (!entry || entry.revision < 1) {
        toast.message("There is nothing to publish for this product yet.");
        return;
      }
      const result = await publishProduct.mutateAsync({ productId: id, expectedRevision: entry.revision });
      setPresStore((prev) => replaceEntry(prev, result));
      // The shared layout is mentioned only when it is confirmed pending: read the list of pages afresh first (this joins a read
      // already running) and say nothing about the layout if that cannot be confirmed.
      await refreshTemplateStates(queryClient).catch(() => undefined);
      const layout = productLayoutState({
        templates: queryClient.getQueryData<TemplateSummary[]>(themeKeys.templates),
        fetching: queryClient.isFetching({ queryKey: themeKeys.templates }) > 0,
        failed: queryClient.getQueryState(themeKeys.templates)?.status === "error",
        pageDocDirty: productPageDirty(),
      });
      toast.success(result.published ? "Product customization published successfully" : "Product customization was already up to date", {
        description: layout === "pending" ? "The shared product page layout still has unpublished changes. Use the Publish button at the top to publish it separately." : entry.name,
        action: { label: "View product", onClick: () => window.open(`/s/${init.storeSlug}/products/${entry.slug}`, "_blank", "noopener") },
      });
    } catch (error) {
      if (error instanceof ActionError && error.code === "CONFLICT") {
        setPresConflict(id);
        setSaveState("conflict");
      } else toast.error(error instanceof ActionError ? error.message : "Could not publish this product. Please try again.");
    } finally {
      setPresBusy(null);
    }
  };

  const resetThisProduct = async () => {
    const id = previewProduct.productId;
    if (!id || !productActions({ loadStatus: previewProduct.status, canEdit, busy: presBusy !== null, entry: presRef.current.entries[id] ?? null }).reset) return;
    setPresBusy("resetting");
    try {
      const result = await resetProduct.mutateAsync(id);
      setPresStore((prev) => replaceEntry(prev, result));
      setPresServerProblems((prev) => ({ ...prev, [id]: {} }));
      if (presConflict === id) {
        setPresConflict(null);
        setSaveState("idle");
      }
      toast.success("This product is back to the store design", { description: "The live page changed straight away." });
    } catch (error) {
      toast.error(error instanceof ActionError ? error.message : "Could not reset this product. Please try again.");
    } finally {
      setPresBusy(null);
    }
  };

  // ---- pages, conflicts, restore -------------------------------------------------------------------------------
  const loadDoc = useCallback(async (id: string): Promise<boolean> => {
    const result = await getTemplateAction(id);
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    const t = result.data!;
    setState((prev) =>
      prev.docs[id]
        ? replaceDoc(prev, id, t.revision, t.document)
        : { ...prev, docs: { ...prev.docs, [id]: { templateId: id, kind: t.kind, name: t.name, revision: t.revision, document: t.document, saved: JSON.stringify(t.document) } } },
    );
    return true;
  }, []);

  const switchPage = async (id: string) => {
    if (id === state.pageId) return;
    setLoadingPage(true);
    if (!state.docs[id] && !(await loadDoc(id))) {
      setLoadingPage(false);
      return;
    }
    setState((prev) => ({ ...prev, pageId: id, selection: null }));
    if (init.pages.find((p) => p.id === id)?.kind !== "product") {
      setLeftTab((tab) => (tab === "product" ? "sections" : tab));
      syncProductParam(null);
    } else if (previewProduct.productId) syncProductParam(previewProduct.productId);
    // The Product page opens on the store's first product, as it always did; the owner can pick another.
    if (init.pages.find((p) => p.id === id)?.kind === "product" && previewProduct.status === "idle" && firstProductSlug) void loadProduct({ slug: firstProductSlug });
    setLoadingPage(false);
  };

  const reloadAll = async () => {
    setLoadingPage(true);
    await Promise.all(Object.keys(stateRef.current.docs).map(loadDoc));
    setServerProblems({});
    setPresConflict(null);
    setSaveState("idle");
    setLoadingPage(false);
    forgetDocsNow("all");
    toast.success("Loaded the latest version");
  };

  const afterRestore = async (templateId: string) => {
    await loadDoc(templateId);
    forgetDocsNow([templateId]);
    setVersionsOpen(false);
    void refreshTemplateStates(queryClient);
  };

  // ---- publish -------------------------------------------------------------------------------------------------
  const doPublish = async () => {
    setPublishing(true);
    try {
      await publishAll();
    } finally {
      setPublishing(false);
    }
  };

  const publishAll = async () => {
    // A save already running (autosave) is waited for, not mistaken for a failed one. Edits typed meanwhile are saved too, a few
    // passes at most; if they keep coming, publishing stops with a message rather than publish older text.
    const saved: FlushResult = hasLocalProblems && !allSaved() ? { ok: false, reason: "validation" } : await flusher.settle(allSaved);
    if (!saved.ok) {
      setPublishOpen(false);
      toast.error(saveFailureMessage(saved));
      return;
    }
    try {
      const result = await publish.mutateAsync(undefined);
      setPublishOpen(false);
      toast.success(publishedMessage(result.published.length, result.productPresentations?.published ?? 0), {
        action: { label: "View store", onClick: () => window.open(`/s/${result.storeSlug}`, "_blank", "noopener") },
      });
      void refreshEntries();
    } catch (error) {
      // The API checks every product draft with the pages. When it names products, say which one and open it; anything else
      // keeps the generic message.
      const { byProduct } = error instanceof ActionError ? splitProductFieldErrors(error.fieldErrors) : { byProduct: {} as Record<string, Record<string, string>> };
      const ids = Object.keys(byProduct);
      if (ids.length > 0) {
        setPresServerProblems((prev) => ({ ...prev, ...byProduct }));
        setPublishOpen(false);
        const first = ids[0];
        const name = presRef.current.entries[first]?.name ?? null;
        const message = Object.values(byProduct[first])[0];
        const productPage = init.pages.find((p) => p.kind === "product");
        toast.error(`${name ?? "A product"}: ${message}`, {
          description: ids.length > 1 ? `${ids.length} products have settings to fix.` : "Open the product to see what needs fixing.",
          action: {
            label: "Open product",
            onClick: () => {
              void (async () => {
                if (productPage && stateRef.current.pageId !== productPage.id) await switchPage(productPage.id);
                setLeftTab("product");
                setMobileTab("settings");
                void loadProduct({ productId: first }, name);
              })();
            },
          },
        });
        return;
      }
      toast.error(error instanceof ActionError ? error.message : "Could not publish. Please try again.");
    }
  };

  const leave = async () => {
    if ((dirtyDocs(stateRef.current).length > 0 || dirtyEntries(presRef.current).length > 0) && !(await flush()) && !window.confirm("Some changes could not be saved. Leave anyway?")) return;
    router.push(ROUTES.templates);
  };

  // Products waiting to go live: a loaded product by its own state, any other by the API's list of customized products.
  // A never-published row can hold an empty draft, which publishing ignores. The list cannot tell, so each such row is read once
  // (remembered by product, revision and time) in chunks. Rows not read yet or that failed are "unverified": never guessed.
  const presItems = presList.data?.items;
  const draftRows = useMemo(() => draftsToCheck(presItems ?? [], new Set(Object.keys(presStore.entries))), [presItems, presStore.entries]);
  const draftChecks = useDraftChecks(draftRows);
  const { waiting: waitingProducts, unverified: unverifiedProducts } = useMemo(() => summarizeWaiting(presItems ?? [], presStore, draftChecks.checks), [presItems, presStore, draftChecks.checks]);
  // What is known about the shared product-page layout, from the same list as the badge: never read as published while unknown.
  const productPageId = init.pages.find((p) => p.kind === "product")?.id;
  const layoutState = productLayoutState({
    templates: templates.data,
    fetching: templates.isFetching,
    failed: templates.isError,
    pageDocDirty: productPageId && state.docs[productPageId] ? isDirty(state.docs[productPageId]) : false,
  });
  const waitingPages = (templates.data ?? []).filter((t) => t.status === "active" && t.publicationState !== "published");
  // Once the checks have settled, rows still unverified may be real drafts: say there are changes rather than claim all is published.
  // True while the list of pages and their publication states is being read: what it says is not known yet.
  const checkingPages = templates.isFetching;
  const unpublished = waitingPages.length > 0 || waitingProducts.size > 0 || dirtyCount > 0 || (unverifiedProducts.size > 0 && !draftChecks.checking) || Boolean(presList.data?.truncated);
  const publication = publicationStatus(unpublished, checkingPages);
  const listStates = useMemo(() => new Map((presItems ?? []).map((r) => [r.productId, r.publicationState] as const)), [presItems]);
  const statusOfProduct = (id: string): ProductStatus => {
    const e = presStore.entries[id];
    // A product whose only stored settings are an empty never-published draft is, for the owner, not customized.
    if (e) return isEntryDirty(e) ? "unsaved" : e.publicationState === "draft" && !hasPendingPublish(e) && !e.unsupported ? "default" : e.publicationState;
    if (draftChecks.checks.get(id) === "empty") return "default";
    return listStates.get(id) ?? "default";
  };
  const selection = state.selection;
  const selectedSectionId = selection && "sectionId" in selection && selection.docId === state.pageId ? selection.sectionId : null;
  // The picked product as the storefront renders it, carrying the settings being edited (the draft), so the preview shows them at once.
  const currentEntry = previewProduct.productId ? (presStore.entries[previewProduct.productId] ?? null) : null;
  const productResource =
    previewMode === "store" && previewProduct.resource
      ? { ...previewProduct.resource, presentation: previewPresentation(presStore, previewProduct.productId, previewProduct.resource.presentation) }
      : null;
  const mainProduct = Object.values((page.document as { sections?: Record<string, { type: string; settings?: Record<string, unknown> }> }).sections ?? {}).find((s) => s.type === "main-product");
  const inherited: { layout: GalleryLayout; mediaPosition: MediaPosition } = {
    layout: effectiveGalleryLayout(mainProduct?.settings?.galleryLayout, null),
    mediaPosition: effectiveMediaPosition(mainProduct?.settings?.mediaPosition, null),
  };
  // What the Product controls may do right now (nothing while another product is loading).
  const productAct = productActions({ loadStatus: previewProduct.status, canEdit, busy: presBusy !== null, entry: currentEntry });
  const productProblems = currentEntry ? { ...(presServerProblems[currentEntry.productId] ?? {}), ...(presLocalProblems[currentEntry.productId] ?? {}) } : {};
  const frameProps = {
    data: preview,
    theme: themeDocId ? state.docs[themeDocId].document : null,
    groups: {
      header: groupIds.header ? (state.docs[groupIds.header].document as unknown as TemplateDocument) : null,
      footer: groupIds.footer ? (state.docs[groupIds.footer].document as unknown as TemplateDocument) : null,
      announcement: groupIds.announcement ? (state.docs[groupIds.announcement].document as unknown as TemplateDocument) : null,
    },
    resource: resourceFor(page.kind, preview, productResource),
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background text-foreground" role="application" aria-label="Theme editor">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-card px-2 sm:px-3">
        <Button variant="ghost" size="sm" onClick={() => void leave()} aria-label="Back to themes"><ArrowLeft aria-hidden /><span className="hidden sm:inline">Themes</span></Button>
        <div className="hidden min-w-0 items-center gap-2 border-l pl-3 sm:flex">
          <Palette className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate text-sm font-medium">{init.themeName ?? "Your storefront"}</span>
        </div>
        <NativeSelect aria-label="Page to edit" value={state.pageId} disabled={loadingPage} onChange={(e) => void switchPage(e.target.value)} className="h-8 w-36 text-xs sm:w-44">
          {init.pages.map((p) => (
            <option key={p.id} value={p.id}>{PAGE_LABEL[p.kind] ?? p.name}</option>
          ))}
        </NativeSelect>
        {page.kind === "product" && previewMode === "store" && previewProduct.productId ? (
          <Button variant="outline" size="sm" className="hidden max-w-44 sm:inline-flex" onClick={() => { setLeftTab("product"); setMobileTab("sections"); }} aria-label="Product being previewed. Open the Product tab">
            {loadingProduct ? <Loader2 className="animate-spin" aria-hidden /> : <Package aria-hidden />}
            <span className="truncate">{loadingProduct ? `Loading ${loadingProduct.name ?? "product"}…` : (currentEntry?.name ?? "Product")}</span>
          </Button>
        ) : null}
        <div className="hidden items-center md:flex" role="group" aria-label="Undo and redo">
          <Button size="icon-sm" variant="ghost" aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!canEdit || !canUndo(history)} onClick={undoEdit}><Undo2 aria-hidden /></Button>
          <Button size="icon-sm" variant="ghost" aria-label="Redo" title="Redo (Ctrl+Shift+Z)" disabled={!canEdit || !canRedo(history)} onClick={redoEdit}><Redo2 aria-hidden /></Button>
        </div>
        <SaveIndicator status={status} />
        <PreviewModeSwitch mode={previewMode} onChange={setPreviewMode} className="ml-auto hidden md:inline-flex" />
        <div className="hidden items-center rounded-md border p-0.5 md:flex" role="group" aria-label="Preview size">
          {DEVICES.map(({ id, label, icon: Icon }) => (
            <Button key={id} size="icon-sm" variant={device === id ? "secondary" : "ghost"} aria-label={label} aria-pressed={device === id} onClick={() => setDevice(id)}><Icon aria-hidden /></Button>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={() => setVersionsOpen(true)} aria-label="Version history"><History aria-hidden /><span className="hidden lg:inline">History</span></Button>
        <Button variant="outline" size="sm" onClick={() => setPreviewing(true)}><Eye aria-hidden /><span className="hidden sm:inline">Preview</span></Button>
        {init.canManage ? (
          <Button size="sm" onClick={() => { setPublishOpen(true); void refetchTemplateStatesOnOpen(queryClient); }} disabled={status === "conflict" || status === "invalid" || publish.isPending || publishing}>
            <Rocket aria-hidden /> Publish
          </Button>
        ) : null}
      </header>

      {status === "conflict" && presConflict ? (
        <Alert variant="destructive" className="rounded-none border-x-0">
          <AlertTriangle aria-hidden />
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            Someone else changed the settings of {presStore.entries[presConflict]?.name ?? "this product"} while you were editing. Your unsaved changes to this product were not saved.
            <Button size="sm" variant="outline" onClick={() => void reloadPresentation(presConflict)}>Load the latest settings</Button>
          </AlertDescription>
        </Alert>
      ) : status === "conflict" ? (
        <Alert variant="destructive" className="rounded-none border-x-0">
          <AlertTriangle aria-hidden />
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            Someone else changed this design while you were editing. Your unsaved changes were not saved.
            <Button size="sm" variant="outline" onClick={() => void reloadAll()}>Load the latest version</Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {!init.canManage ? (
        <Alert className="rounded-none border-x-0"><AlertDescription>You can look around but not change anything. Editing needs access to store settings.</AlertDescription></Alert>
      ) : null}

      <div className="flex shrink-0 gap-1 border-b p-1 lg:hidden" role="tablist" aria-label="Editor panels">
        {(["sections", "preview", "settings"] as const).map((t) => (
          <Button key={t} size="sm" variant={mobileTab === t ? "secondary" : "ghost"} className="flex-1 capitalize" role="tab" aria-selected={mobileTab === t} onClick={() => setMobileTab(t)}>{t}</Button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[300px_minmax(0,1fr)_320px]">
        <aside className={cn("min-h-0 flex-col overflow-hidden border-r bg-card lg:flex", mobileTab === "sections" ? "flex" : "hidden")} aria-label="Page structure">
          <div className="flex shrink-0 gap-1 border-b p-2" role="tablist">
            <Button size="sm" variant={leftTab === "sections" ? "secondary" : "ghost"} className="flex-1" role="tab" aria-selected={leftTab === "sections"} onClick={() => setLeftTab("sections")}><PanelLeft aria-hidden /> Sections</Button>
            <Button size="sm" variant={leftTab === "theme" ? "secondary" : "ghost"} className="flex-1" role="tab" aria-selected={leftTab === "theme"} onClick={() => { setLeftTab("theme"); setMobileTab("settings"); }}><Palette aria-hidden /> Theme</Button>
            {page.kind === "product" ? (
              <Button size="sm" variant={leftTab === "product" ? "secondary" : "ghost"} className="flex-1" role="tab" aria-selected={leftTab === "product"} onClick={() => { setLeftTab("product"); setMobileTab("settings"); }}><Package aria-hidden /> Product</Button>
            ) : null}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {leftTab === "sections" ? (
              <SectionsPanel state={state} groupIds={groupIds} pageKind={page.kind} actions={actions} disabled={!canEdit} />
            ) : leftTab === "product" ? (
              previewMode === "demo" ? (
                <div className="space-y-3 p-4">
                  <p className="text-sm text-muted-foreground">You are looking at demo products. Switch to your own store to customize a real product.</p>
                  <Button size="sm" variant="outline" onClick={() => setPreviewMode("store")}>Preview your store</Button>
                </div>
              ) : (
                <>
                  {previewProduct.status === "error" && previewProduct.error ? (
                    <Alert variant="destructive" className="m-3 w-auto">
                      <AlertDescription className="flex items-center justify-between gap-2">
                        {previewProduct.error}
                        <Button size="xs" variant="outline" onClick={() => lastTarget.current && void loadProduct(lastTarget.current)}>Try again</Button>
                      </AlertDescription>
                    </Alert>
                  ) : null}
                  <ProductPicker selectedProductId={previewProduct.productId} loadingProductId={loadingProduct?.id ?? null} disabled={presBusy !== null} onSelect={onPickProduct} statusOf={statusOfProduct} statusUnavailable={presList.isError} />
                </>
              )
            ) : (
              <p className="p-4 text-sm text-muted-foreground">Colours, fonts, spacing and buttons for the whole store are on the right. Changes show in the preview straight away.</p>
            )}
          </div>
        </aside>

        <main className={cn("min-h-0 overflow-auto bg-muted/50 p-3 lg:block sm:p-5", mobileTab === "preview" ? "block" : "hidden")} aria-label="Live preview">
          <div className="mb-2 flex flex-col items-center gap-1.5">
            <PreviewModeSwitch mode={previewMode} onChange={setPreviewMode} className="md:hidden" />
            <PreviewModeNote mode={previewMode} storeHasProducts={hasStoreProducts(init.data)} className="text-center" />
          </div>
          <div className={cn("mx-auto overflow-hidden rounded-md border bg-white shadow-sm transition-[max-width] duration-200", device === "desktop" ? "max-w-[1280px]" : device === "tablet" ? "max-w-[820px]" : "max-w-[390px]")}>
            {loadingPage ? (
              <div className="flex h-96 items-center justify-center"><Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Loading page" /></div>
            ) : (
              <ThemeFrame document={page.document as unknown as TemplateDocument} device={device} mode="editor" onSelect={onPreviewSelect} selectedSectionId={selectedSectionId} {...frameProps} />
            )}
          </div>
        </main>

        <aside className={cn("min-h-0 overflow-y-auto border-l bg-card lg:block", mobileTab === "settings" ? "block" : "hidden")} aria-label="Settings">
          {leftTab === "product" && previewMode === "store" ? (
            <ProductCustomizer
              load={{ status: previewProduct.status, error: previewProduct.error }}
              layoutState={layoutState}
              loadingName={loadingProduct ? (loadingProduct.name ?? "the product") : null}
              entry={currentEntry}
              unavailable={previewProduct.presentationError}
              primaryImagePath={typeof previewProduct.resource?.image_path === "string" ? previewProduct.resource.image_path : null}
              inherited={inherited}
              available={availableItems(page.document)}
              actions={productAct}
              problems={productProblems}
              busy={presBusy}
              status={currentEntry ? statusOfProduct(currentEntry.productId) : "default"}
              onLayout={(v) => currentEntry && productAct.edit && editPres((s) => setGalleryLayout(s, currentEntry.productId, v))}
              onPosition={(v) => currentEntry && productAct.edit && editPres((s) => setMediaPosition(s, currentEntry.productId, v))}
              onFocal={(v) => currentEntry && productAct.edit && editPres((s) => setFocalPoint(s, currentEntry.productId, v))}
              onHidden={(block: HideableBlock, hidden: boolean) => currentEntry && productAct.edit && editPres((s) => setBlockHidden(s, currentEntry.productId, block, hidden))}
              onPublish={() => void publishThisProduct()}
              onResetAll={() => void resetThisProduct()}
              onRetry={() => lastTarget.current && void loadProduct(lastTarget.current)}
            />
          ) : (
          <CollectionChoicesContext.Provider value={init.data.collections}>
          <SettingsPanel
            state={state}
            mode={leftTab === "theme" ? "theme" : "section"}
            themeDocId={themeDocId}
            disabled={!canEdit}
            problems={problems}
            onSetting={(docId, sectionId, blockId, key, value) => edit((s) => setSetting(s, docId, sectionId, blockId, key, value))}
            onThemeSetting={(docId, group, key, value) => edit((s) => setThemeSetting(s, docId, group, key, value))}
          />
          </CollectionChoicesContext.Provider>
          )}
        </aside>
      </div>

      {saveError && status === "error" ? (
        <div role="alert" className="flex items-center justify-between gap-3 border-t bg-destructive/10 px-4 py-2 text-sm text-destructive">
          <span className="flex items-center gap-2"><CircleAlert className="size-4" aria-hidden /> {saveError}</span>
          <Button size="sm" variant="outline" onClick={() => { retries.current = 0; void flush(); }}>Try again</Button>
        </div>
      ) : null}

      <Dialog open={previewing} onOpenChange={setPreviewing}>
        <DialogContent className="flex h-[calc(100dvh-2rem)] max-w-none flex-col gap-0 p-0 sm:max-w-[min(1400px,calc(100%-2rem))]">
          <DialogHeader className="flex flex-row items-center justify-between gap-3 border-b p-4 pr-12">
            <div>
              <DialogTitle>Draft preview</DialogTitle>
              <DialogDescription>How your store looks with your latest changes. Only you and your team can see this; it is not published.</DialogDescription>
            </div>
            <div className="flex rounded-md border p-0.5" role="group" aria-label="Preview size">
              {DEVICES.map(({ id, label, icon: Icon }) => (
                <Button key={id} size="icon-sm" variant={device === id ? "secondary" : "ghost"} aria-label={label} aria-pressed={device === id} onClick={() => setDevice(id)}><Icon aria-hidden /></Button>
              ))}
            </div>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto bg-muted/60 p-4">
            <div className={cn("mx-auto overflow-hidden rounded-md border bg-white shadow-sm", device === "desktop" ? "w-full" : device === "tablet" ? "w-[820px] max-w-full" : "w-[390px] max-w-full")}>
              <ThemeFrame document={page.document as unknown as TemplateDocument} device={device} mode="preview" {...frameProps} />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <VersionsSheet open={versionsOpen} onClose={() => setVersionsOpen(false)} templateId={state.pageId} pageName={PAGE_LABEL[page.kind] ?? page.name} canManage={init.canManage} hasUnsavedChanges={isDirty(page)} onRestored={(id) => void afterRestore(id)} />

      <AlertDialog open={publishOpen} onOpenChange={setPublishOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish your theme?</AlertDialogTitle>
            <AlertDialogDescription>
              Your latest changes go live on your store now: every page, the header, the footer, your theme settings and any product settings you have saved. Each page is saved as a numbered version you can restore later. Product details, customers and orders are not affected.
            </AlertDialogDescription>
            <PublishSummary
              pages={waitingPages.map((t) => PAGE_LABEL[t.kind] ?? t.name)}
              products={[...waitingProducts].map((id) => presStore.entries[id]?.name ?? null)}
              unsaved={dirtyCount}
              unverified={unverifiedProducts.size}
              checking={draftChecks.checking}
              checkingPages={checkingPages}
              skipped={draftChecks.skipped}
              truncated={Boolean(presList.data?.truncated)}
              onRetry={draftChecks.retry}
            />
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={publish.isPending || publishing}>Not yet</AlertDialogCancel>
            <AlertDialogAction disabled={publish.isPending || publishing} onClick={() => void doPublish()}>
              {publish.isPending || publishing ? <Loader2 className="animate-spin" aria-hidden /> : <Rocket aria-hidden />} Publish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <p className="sr-only" aria-live="polite">{publication === "unpublished" ? "You have changes that are not published." : publication === "checking" ? "Checking publication status." : "Everything is published."}</p>
      <span className="fixed right-3 bottom-3 hidden xl:block">
        {publication === "unpublished" ? (
          <Badge variant="secondary">Changes not published</Badge>
        ) : publication === "checking" ? (
          <Badge variant="outline"><Loader2 className="size-3 animate-spin" aria-hidden /> Checking publication status…</Badge>
        ) : (
          <Badge variant="outline"><Check className="size-3" aria-hidden /> Published</Badge>
        )}
      </span>
    </div>
  );
}

/** What is about to go live, so the owner is never surprised: pages and shared parts with unpublished changes, and customized products. */
function PublishSummary({
  pages,
  products,
  unsaved,
  unverified,
  checking,
  checkingPages,
  skipped,
  truncated,
  onRetry,
}: {
  pages: string[];
  products: (string | null)[];
  unsaved: number;
  /** Never-published product drafts not yet known to be empty or real: not counted either way. */
  unverified: number;
  checking: boolean;
  /** The list of pages and their publication states is being read again: what is pending may not be complete yet. */
  checkingPages: boolean;
  skipped: number;
  /** The list of customized products was cut off (more than the pages read). */
  truncated: boolean;
  onRetry: () => void;
}) {
  const uncertain = unverified > 0 || truncated;
  // "Nothing new" is only said once the state is known; while it is being read the answer is not yet known.
  if (pages.length === 0 && products.length === 0 && unsaved === 0 && !uncertain && !checkingPages) return <p className="text-sm text-muted-foreground">There is nothing new to publish.</p>;
  const named = products.filter((n): n is string => Boolean(n));
  const others = products.length - named.length;
  return (
    <div className="mt-2 space-y-1.5 rounded-md border bg-muted/40 p-3 text-sm" aria-label="What will be published">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Will go live</p>
      {pages.length > 0 ? <p>Pages and shared parts: {pages.join(", ")}</p> : null}
      {products.length > 0 ? (
        <p>
          {products.length} {products.length === 1 ? "product" : "products"} with their own settings
          {named.length > 0 ? `: ${named.slice(0, 5).join(", ")}${named.length > 5 ? "…" : ""}` : ""}
          {others > 0 && named.length > 0 ? ` and ${others} more` : ""}
        </p>
      ) : null}
      {pages.length === 0 && products.length === 0 && !uncertain && unsaved > 0 ? <p>Your latest edits.</p> : null}
      {checkingPages ? <p className="flex items-center gap-1.5 text-muted-foreground"><Loader2 className="size-3.5 animate-spin" aria-hidden /> Checking publication status…</p> : null}
      {unverified > 0 ? (
        <p className="text-muted-foreground">
          {checking ? `Checking ${unverified} more ${unverified === 1 ? "product" : "products"} with drafts…` : `${unverified} more ${unverified === 1 ? "product has a draft" : "products have drafts"} that could not be checked${skipped > 0 ? " (too many to check at once)" : ""}, so they may or may not go live.`}
          {!checking ? <> <button type="button" onClick={onRetry} className="underline underline-offset-2">Check again</button></> : null}
        </p>
      ) : null}
      {truncated ? <p className="text-muted-foreground">Your store has more customized products than are listed here, so others may also go live.</p> : null}
    </div>
  );
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  const map: Record<SaveStatus, { text: string; tone: string; icon: React.ReactNode }> = {
    saved: { text: "All changes saved", tone: "text-muted-foreground", icon: <Check className="size-3.5" aria-hidden /> },
    unsaved: { text: "Unsaved changes", tone: "text-muted-foreground", icon: <span className="size-1.5 rounded-full bg-amber-500" aria-hidden /> },
    saving: { text: "Saving…", tone: "text-muted-foreground", icon: <Loader2 className="size-3.5 animate-spin" aria-hidden /> },
    error: { text: "Not saved", tone: "text-destructive", icon: <CircleAlert className="size-3.5" aria-hidden /> },
    conflict: { text: "Out of date", tone: "text-destructive", icon: <AlertTriangle className="size-3.5" aria-hidden /> },
    invalid: { text: "Fix errors to save", tone: "text-destructive", icon: <CircleAlert className="size-3.5" aria-hidden /> },
  };
  const s = map[status];
  return (
    <span role="status" className={cn("hidden items-center gap-1.5 text-xs md:flex", s.tone)}>
      {s.icon}{s.text}
    </span>
  );
}

