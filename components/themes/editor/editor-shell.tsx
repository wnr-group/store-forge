"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, ArrowLeftToLine, ChevronRight, CircleAlert, Eye, FolderTree, Globe, History as HistoryIcon, Layers, LayoutGrid, Loader2, Monitor, Package, Palette, Plus, Redo2, Rocket, Smartphone, SlidersHorizontal, SquareDashedMousePointer, Tablet, Undo2, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { getPresentationAction, getTemplateAction, loadProductPreviewAction, saveDraftAction, savePresentationDraftAction } from "@/app/(dashboard)/dashboard/templates/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/native-select";
import { ROUTES } from "@/config/app";
import { adapterForLook, lookOf } from "@/lib/editor/adapters";
import { formatMoney } from "@/lib/money";
import { deploymentFromResult, deploymentFromTemplates, timeAgo, type Deployment } from "@/lib/themes/editor/deployment";
import { withAddedProducts, withCollectionEdits, withProductEdits, type AddedProduct, type CardCollectionEdit, type CardProductEdit } from "@/lib/themes/editor/product-edits";
import { CARD_PARTS, COLLECTION_CARD_PARTS, availableCardParts, cardKindOf, countOnByDefault, descriptionOnByDefault, readCardParts, readCollectionCardParts, type CardPartKey } from "@/lib/templates/card-parts";
import { isHomeTheme } from "@/lib/templates/engine/theme-style";
import { applyInlineEdit, locateInlineEdit } from "@/lib/editor/inline";
import { findSettingForClick } from "@/lib/editor/locate";
import { themeFieldId, type ThemeTarget } from "@/lib/editor/theme-target";
import { WORDING_GROUP } from "@/lib/storefront/wording";
import type { CardContext } from "./card-elements";
import { originalOf, readTextOverrides } from "@/lib/editor/text";
import { PAGE_KEYS, PAGE_LABELS, routeForHref, withPageContent } from "@/lib/storefront/pages";
import { foldVirtualPages, isVirtualId, openVirtualPage, rebuildVirtualPages, resetVirtualPage, virtualId, virtualKey } from "@/lib/themes/editor/virtual";
import type { PartStyleKey, StyleDevice, StyleKey as StyleKeyType } from "@/lib/editor/style";
import type { ComponentNode, TemplateDocument } from "@/lib/templates/document";
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
  replaceDoc, restoreDocs, resetElementStyle, select, setElementStyle, setSetting, setTextOverride, setTextStyle, setThemeSetting, toggleSection, type EditorDoc, type EditorState,
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
import { usePreviewTarget, type TargetKind } from "./use-preview-target";
import { PREVIEW_OPEN_EVENT } from "@/components/storefront/cart/use-quick-add";
import { CollectionQuickEdit, type CardCollectionRef, type CollectionEditField } from "./collection-quick-edit";
import { ProductQuickEdit, type CardProductRef, type QuickEditField } from "./product-quick-edit";
import { DeploymentDialog } from "./deployment-dialog";
import { QuickCreate, type CreateKind } from "./quick-create";
import { VersionsSheet } from "./versions-sheet";
import { PreviewModeNote, PreviewModeSwitch } from "../preview-mode-switch";
import type { CardTools } from "../selection-overlay";
import { ThemeFrame, type ClickTarget, type Device } from "../theme-frame";

const registry = getRegistry();

function findNode(node: ComponentNode, id: string): ComponentNode | undefined {
  if (node.blocks?.[id]) return node.blocks[id];
  for (const child of Object.values(node.blocks ?? {})) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return undefined;
}
const AUTOSAVE_MS = 1500;
/** The field of the product a card element edits; the badge and the quick add buttons are only shown or hidden. */
const COLLECTION_EDIT_FIELD: Partial<Record<"image" | "title" | "count", CollectionEditField>> = { image: "image", title: "name" };
const EDIT_FIELD: Partial<Record<CardPartKey, QuickEditField>> = { image: "image", title: "name", description: "shortDescription", price: "price", comparePrice: "price" };

export type EditorInit = {
  tenantId: string;
  canManage: boolean;
  storeSlug: string;
  /** The store's public address for display, e.g. "urban-nest-zqkod2.store-forge.com". */
  storeHost: string;
  /** The address that opens the live store (https://...), or null where no root domain is configured. */
  storeUrl: string | null;
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
const DEVICES: { id: Device; label: string; icon: typeof Monitor; width: number }[] = [
  { id: "desktop", label: "Desktop", icon: Monitor, width: 1280 },
  { id: "tablet", label: "Tablet", icon: Tablet, width: 820 },
  { id: "mobile", label: "Mobile", icon: Smartphone, width: 390 },
];
/** The preview device a style change is written for. */
const STYLE_DEVICE: Record<Device, StyleDevice> = { desktop: "base", tablet: "tablet", mobile: "mobile" };
const ZOOMS = [{ label: "Fit", value: 0 }, { label: "50%", value: 0.5 }, { label: "75%", value: 0.75 }, { label: "100%", value: 1 }, { label: "125%", value: 1.25 }];

type PreviewProductState = { status: "idle" | "loading" | "ready" | "error"; productId: string | null; resource: Record<string, unknown> | null; error: string | null; presentationError: string | null };
const NO_PRODUCT: PreviewProductState = { status: "idle", productId: null, resource: null, error: null, presentationError: null };
type ProductTarget = { productId?: string; slug?: string };


export function EditorShell({ init }: { init: EditorInit }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [state, setState] = useState<EditorState>(() => createState(init.pageId, init.docs));
  // The latest state, updated synchronously by `commit`, so a burst of edits or an edit during a save never works from a stale copy.
  const stateRef = useRef(state);
  const commit = useCallback((fn: (s: EditorState) => EditorState): EditorState => {
    const next = fn(stateRef.current);
    stateRef.current = next;
    setState(next);
    return next;
  }, []);
  const [zoom, setZoom] = useState(0);
  const [focusSetting, setFocusSetting] = useState<{ key: string; nonce: number } | null>(null);
  const [clickedText, setClickedText] = useState<{ text: string; nonce: number } | null>(null);
  // The product card picked on the page (its section and its position among that section's cards). Not part of the saved design.
  const [pickedCard, setPickedCard] = useState<{ sectionId: string; index: number; product?: string; collection?: string } | null>(null);
  // The product being edited from its card (a dialog), and products already saved from a card, shown at once in the preview.
  const [editingProduct, setEditingProduct] = useState<{ product: CardProductRef; field: QuickEditField } | null>(null);
  const [productEdits, setProductEdits] = useState<Record<string, CardProductEdit>>({});
  // The same for a collection card: the collection being edited (a dialog) and collections already saved from a card.
  const [editingCollection, setEditingCollection] = useState<{ collection: CardCollectionRef; field: CollectionEditField } | null>(null);
  const [collectionEdits, setCollectionEdits] = useState<Record<string, CardCollectionEdit>>({});
  // Adding a product, a category or a collection from the editor (a dialog), and products added so far, listed at once in the preview.
  const [creating, setCreating] = useState<CreateKind | null>(null);
  // The deployment dialog: opened by a finished publish ("publish", showing what just went live) or from the status bar ("live").
  const [deploymentOpen, setDeploymentOpen] = useState<"publish" | "live" | null>(null);
  const [lastPublish, setLastPublish] = useState<Deployment | null>(null);
  const [addedProducts, setAddedProducts] = useState<AddedProduct[]>([]);
  // The merchant's real catalogue by default; demo content only on request, and never saved anywhere.
  const [previewMode, setPreviewMode] = useState<PreviewMode>("store");
  const preview = useMemo(() => {
    const data = previewData(init.data, previewMode);
    return previewMode === "store" ? withCollectionEdits(withAddedProducts(withProductEdits(data, productEdits), addedProducts), collectionEdits) : data;
  }, [init.data, previewMode, productEdits, addedProducts, collectionEdits]);
  // Browsing inside the editor: which product, collection or content page is shown, links that open pages, and a way back.
  const target = usePreviewTarget(preview);
  // Inspector on: clicking selects and edits. Off: the preview works like the live store (links open pages, buttons work).
  const [inspector, setInspector] = useState(true);
  type TrailStep = { pageId: string; ref?: { kind: TargetKind; slug: string } };
  const [trail, setTrail] = useState<TrailStep[]>([]);
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
      // Generated pages (all products, cart ...) live inside the theme document: fold their changes into it first.
      const themeId = Object.values(stateRef.current.docs).find((d) => d.kind === "theme_settings")?.templateId;
      if (themeId) commit((s) => foldVirtualPages(s, themeId));
      for (const doc of dirtyDocs(stateRef.current).filter((d) => !isVirtualId(d.templateId))) {
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
        commit((prev) => markSaved(prev, doc.templateId, saved.revision, saved.document, json));
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
  }, [commit, queryClient]);

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
    const warn = (e: BeforeUnloadEvent) => {
      if (dirtyDocs(stateRef.current).length > 0 || dirtyEntries(presRef.current).length > 0 || saving.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  // ---- edits ---------------------------------------------------------------------------------------------------
  /** Applies an edit. The undo history watches the committed drafts (see "undo and redo" below), so it records the step itself. */
  const edit = useCallback(
    // `_key` is kept so callers can still name a burst of edits; the history now joins bursts by time (COALESCE_MS).
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (fn: (s: EditorState) => EditorState, _key?: string) => {
      commit(fn);
      setSaveState((s) => (s === "error" ? "idle" : s));
    },
    [commit],
  );

  useEffect(() => {
    // Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z and Ctrl+Y, unless a text field has focus (it keeps its own undo).
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(input|textarea|select)$/i.test(el.tagName))) return;
      // "I" turns the inspector on and off.
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === "i") {
        setInspector((v) => !v);
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

  const actions: SectionActions = useMemo(
    () => ({
      select: (docId, sectionId, blockId) => { edit((s) => select(s, { docId, sectionId, blockId })); setPickedCard(null); setLeftTab("sections"); setMobileTab("settings"); },
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
      setSetting: (docId, sectionId, key, value) => edit((s) => setSetting(s, docId, sectionId, undefined, key, value), `set:${docId}:${sectionId}::${key}`),
    }),
    [edit],
  );

  /** What the theme lets the merchant style, and the look it comes from. */
  const adapter = useMemo(() => {
    const themeId = Object.values(state.docs).find((d) => d.kind === "theme_settings")?.templateId;
    return adapterForLook(lookOf(themeId ? state.docs[themeId].document : null));
    // Only the theme document decides this; page edits never change the look.
  }, [state.docs]);

  /** What the theme means for product cards: which elements the cards of its look can show, and what they do without a choice. */
  const cardContext = useMemo(() => {
    const themeId = Object.values(state.docs).find((d) => d.kind === "theme_settings")?.templateId;
    const themeDoc = themeId ? state.docs[themeId].document : null;
    const look = lookOf(themeDoc);
    return { look, descriptionDefault: descriptionOnByDefault(look, isHomeTheme(themeDoc)) };
  }, [state.docs]);

  /** The same, plus the store-wide Add to bag label the card's Elements edit (Theme > Shopping wording): the theme's own setting, which the product page uses too. */
  const cardElementsContext = useMemo<CardContext>(() => {
    const themeId = Object.values(state.docs).find((d) => d.kind === "theme_settings")?.templateId;
    const themeDoc = themeId ? state.docs[themeId].document : null;
    const stored = (themeDoc as { settings?: Record<string, Record<string, unknown> | undefined> } | null)?.settings?.[WORDING_GROUP]?.addToBagLabel;
    return {
      ...cardContext,
      addToBagLabel: themeId ? { value: stored, onChange: (value: string) => edit((s) => setThemeSetting(s, themeId, WORDING_GROUP, "addToBagLabel", value), `theme:${themeId}:${WORDING_GROUP}.addToBagLabel`) } : undefined,
    };
  }, [state.docs, cardContext, edit]);

  const onPreviewSelect = useCallback(
    (target: ClickTarget) => {
      const s = stateRef.current;
      const order = [s.pageId, ...Object.keys(s.docs).filter((id) => id !== s.pageId)];
      const docId = order.find((id) => (s.docs[id].document as { sections?: Record<string, unknown> }).sections?.[target.sectionId]);
      if (!docId) return;
      const known = (s.docs[docId].document as { sections: Record<string, ComponentNode> }).sections[target.sectionId];
      const blockId = target.blockId && known && findNode(known, target.blockId) ? target.blockId : undefined;
      edit((prev) => select(prev, { docId, sectionId: target.sectionId, blockId }));
      setPickedCard(target.card !== undefined && !blockId && cardKindOf(known?.type) ? { sectionId: target.sectionId, index: target.card, product: target.product, collection: target.collection } : null);
      setLeftTab("sections");
      setMobileTab("settings");
      // Clicked text or a picture: jump to the setting that holds it (the block first, then its section).
      const section = (s.docs[docId].document as { sections: Record<string, ComponentNode> }).sections[target.sectionId];
      const block = blockId ? findNode(section, blockId) : undefined;
      const element = block ?? section;
      const descriptors = (block ? registry.blocks[block.type] : registry.sections[section.type])?.settings ?? [];
      const key = findSettingForClick([{ descriptors, settings: element.settings }], target);
      setFocusSetting(key ? { key, nonce: Date.now() } : null);
      // A product card's name and price come from the product, not from a setting: nothing to replace here.
      if (target.card !== undefined && cardKindOf(known?.type)) return void setClickedText(null);
      // Text no setting holds (the theme writes it into its own components): offer it for replacement in the panel.
      const shown = target.text ? originalOf(readTextOverrides(section.settings), target.text) : "";
      setClickedText(!key && target.text ? { text: shown, nonce: Date.now() } : null);
    },
    [edit],
  );

  /** The bag drawer or a card's Add to bag button clicked: open that theme-wide setting (Theme tab) and put the cursor in its field. */
  const onThemeTarget = useCallback((target: ThemeTarget) => {
    setPickedCard(null);
    setLeftTab("theme");
    setMobileTab("settings");
    setFocusSetting({ key: themeFieldId(target), nonce: Date.now() });
    setClickedText(null);
  }, []);

  /** Text edited directly on the page: saved where the text lives (see lib/editor/inline.ts). */
  const onEditText = useCallback(
    (e: { sectionId: string; blockId?: string; original: string; value: string }) => {
      const s = stateRef.current;
      const docId = [s.pageId, ...Object.keys(s.docs).filter((id) => id !== s.pageId)].find((id) => (s.docs[id].document as { sections?: Record<string, unknown> }).sections?.[e.sectionId]);
      if (!docId) return;
      const section = (s.docs[docId].document as { sections: Record<string, ComponentNode> }).sections[e.sectionId];
      const blockId = e.blockId && findNode(section, e.blockId) ? e.blockId : undefined;
      const target = locateInlineEdit(section, blockId, registry, e.original);
      edit((st) => applyInlineEdit(st, docId, e.sectionId, target, e.value), `inline:${docId}:${e.sectionId}:${blockId ?? ""}:${target.from}`);
    },
    [edit],
  );
  const onEditBlocked = useCallback(() => toast.message("This text is made of several parts. Select it and change it in the sidebar."), []);

  /** The name on a selected or hovered element's tag: the block's name, else the section's. */
  const labelFor = useCallback((pick: { sectionId: string; blockId?: string }) => {
    const s = stateRef.current;
    for (const id of [s.pageId, ...Object.keys(s.docs).filter((d) => d !== s.pageId)]) {
      const section = (s.docs[id].document as { sections?: Record<string, ComponentNode> }).sections?.[pick.sectionId];
      if (!section) continue;
      const block = pick.blockId ? findNode(section, pick.blockId) : undefined;
      return block ? (registry.blocks[block.type]?.name ?? block.type) : (registry.sections[section.type]?.name ?? section.type);
    }
    return "";
  }, []);

  const onStyle = useCallback(
    (docId: string, sectionId: string, blockId: string | undefined, device: StyleDevice, key: StyleKeyType, value: unknown) =>
      edit((s) => setElementStyle(s, docId, sectionId, blockId, device, key, value), `style:${docId}:${sectionId}:${blockId ?? ""}:${device}:${key}`),
    [edit],
  );
  const onResetStyle = useCallback((docId: string, sectionId: string, blockId: string | undefined) => edit((s) => resetElementStyle(s, docId, sectionId, blockId)), [edit]);
  const onText = useCallback(
    (docId: string, sectionId: string, from: string, to: string | undefined) => edit((s) => setTextOverride(s, docId, sectionId, from, to), `text:${docId}:${sectionId}:${from}`),
    [edit],
  );
  const onTextStyle = useCallback(
    (docId: string, sectionId: string, from: string, key: PartStyleKey, value: unknown) => edit((s) => setTextStyle(s, docId, sectionId, from, key, value), `textstyle:${docId}:${sectionId}:${from}:${key}`),
    [edit],
  );
  const clearFocus = useCallback(() => setFocusSetting(null), []);
  const onSelectParent = useCallback((docId: string, sectionId: string) => edit((s) => select(s, { docId, sectionId })), [edit]);
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
  }, [commit]);

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
    commit((prev) =>
      prev.docs[id]
        ? replaceDoc(prev, id, t.revision, t.document)
        : { ...prev, docs: { ...prev.docs, [id]: { templateId: id, kind: t.kind, name: t.name, revision: t.revision, document: t.document, saved: JSON.stringify(t.document) } } },
    );
    return true;
  }, [commit]);

  const switchPage = async (id: string) => {
    if (id === state.pageId) return;
    setLoadingPage(true);
    if (isVirtualId(id)) {
      if (themeDocId) commit((s) => openVirtualPage(s, themeDocId, virtualKey(id)));
    } else if (!state.docs[id] && !(await loadDoc(id))) {
      setLoadingPage(false);
      return;
    }
    commit((prev) => ({ ...prev, pageId: id, selection: null }));
    if (init.pages.find((p) => p.id === id)?.kind !== "product") {
      setLeftTab((tab) => (tab === "product" ? "sections" : tab));
      syncProductParam(null);
    } else if (previewProduct.productId) syncProductParam(previewProduct.productId);
    // The Product page opens on the store's first product, as it always did; the owner can pick another.
    if (init.pages.find((p) => p.id === id)?.kind === "product" && previewProduct.status === "idle" && firstProductSlug) void loadProduct({ slug: firstProductSlug });
    setLoadingPage(false);
  };

  /** The product, collection or content page being shown, so Back can return to it. */
  const currentRef = (): TrailStep["ref"] => {
    const kind = state.docs[state.pageId]?.kind;
    if (isVirtualId(state.pageId)) return virtualKey(state.pageId) === "content" && target.contentPage ? { kind: "content", slug: target.contentPage.slug } : undefined;
    if (kind === "product" && target.productSlug) return { kind: "product", slug: target.productSlug };
    if (kind === "collection" && target.collectionSlug) return { kind: "collection", slug: target.collectionSlug };
    return undefined;
  };

  /** Opens a page in the editor, like following a link on the storefront. */
  const goTo = async (pageId: string, ref?: TrailStep["ref"], record = true) => {
    if (record && (pageId !== state.pageId || ref)) setTrail((t) => [...t.slice(-19), { pageId: state.pageId, ref: currentRef() }]);
    if (ref) target.choose(ref.kind, ref.slug);
    await switchPage(pageId);
  };
  const goBack = () => {
    const last = trail[trail.length - 1];
    if (!last) return;
    setTrail((t) => t.slice(0, -1));
    void goTo(last.pageId, last.ref, false);
  };

  /** Following a link in the preview: opens the page it leads to, as the live store would. */
  const navigateHref = (href: string) => {
    if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
    const found = routeForHref(href);
    // A page the store wrote under Pages (named about or contact) is what the live store shows at that address, so it wins here too.
    const route = found && (found.page === "about" || found.page === "contact") && target.contentPages.some((p) => p.slug === found.page) ? ({ page: "content", slug: found.page } as const) : found;
    if (!route) {
      toast.message(/^https?:/i.test(href) ? "That link leaves your store." : "Sign-in and account pages have no design to edit here.");
      return;
    }
    const pageIdFor = (kind: ThemeKind) => init.pages.find((p) => p.kind === kind)?.id;
    if (route.page === "home") return void goTo(pageIdFor("index") ?? state.pageId);
    if (route.page === "product" || route.page === "collection") {
      const id = pageIdFor(route.page);
      if (!id) return void toast.message("This theme has no " + route.page + " page to edit.");
      return void goTo(id, { kind: route.page, slug: route.slug });
    }
    if (route.page === "content") {
      if (!themeDocId) return;
      if (!target.contentPages.some((p) => p.slug === route.slug)) toast.message("There is no page at /" + route.slug + " yet. Showing the layout all content pages share; add the page under Pages.");
      return void goTo(virtualId("content"), target.contentPages.some((p) => p.slug === route.slug) ? { kind: "content", slug: route.slug } : undefined);
    }
    if (themeDocId) void goTo(virtualId(route.page));
  };

  // A card's "Add to bag" on a product that needs options opens that product, as it would for a shopper.
  const navigateRef = useRef(navigateHref);
  useEffect(() => {
    navigateRef.current = navigateHref;
  });
  useEffect(() => {
    const open = (e: Event) => {
      const href = (e as CustomEvent<{ href?: string }>).detail?.href;
      if (href) navigateRef.current(href);
    };
    window.addEventListener(PREVIEW_OPEN_EVENT, open);
    return () => window.removeEventListener(PREVIEW_OPEN_EVENT, open);
  }, []);

  const reloadAll = async () => {
    setLoadingPage(true);
    await Promise.all(Object.keys(stateRef.current.docs).filter((id) => !isVirtualId(id)).map(loadDoc));
    if (themeDocId) commit((s) => rebuildVirtualPages(s, themeDocId));
    setServerProblems({});
    setPresConflict(null);
    setSaveState("idle");
    setLoadingPage(false);
    forgetDocsNow("all");
    toast.success("Loaded the latest version");
  };

  const afterRestore = async (templateId: string) => {
    await loadDoc(templateId);
    if (themeDocId && templateId === themeDocId) commit((s) => rebuildVirtualPages(s, themeDocId));
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
      if (result.published.length > 0 || (result.productPresentations?.published ?? 0) > 0) {
        // Something went live: show it, with the store's address and a preview, instead of a toast that disappears.
        setLastPublish(deploymentFromResult(result));
        setDeploymentOpen("publish");
      } else {
        toast.success(publishedMessage(0, 0), {
          action: { label: "View store", onClick: () => window.open(init.storeUrl ?? `/s/${result.storeSlug}`, "_blank", "noopener") },
        });
      }
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
  const liveDeployment = useMemo(() => deploymentFromTemplates(templates.data ?? []), [templates.data]);
  const liveSince = liveDeployment?.publishedAt ?? null;
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
  const selectedBlockId = selection && "blockId" in selection && selection.docId === state.pageId ? (selection.blockId ?? null) : null;
  const virtualPage = isVirtualId(state.pageId) ? virtualKey(state.pageId) : null;
  // The + bar over a picked product card: only while that card's section is still the selection, and never for a block inside it.
  const pickedSection = pickedCard && pickedCard.sectionId === selectedSectionId && !selectedBlockId ? (page.document as { sections?: Record<string, ComponentNode> }).sections?.[pickedCard.sectionId] : undefined;
  const pickedProduct = pickedCard?.product
    ? ([...preview.store.products, ...Object.values(preview.collectionProducts ?? {}).flat()].find((p) => p.slug === pickedCard.product) ?? null)
    : null;
  const pickedCollection = pickedCard?.collection ? (preview.collections.find((c) => c.id === pickedCard.collection) ?? null) : null;
  const cardKind = pickedSection ? cardKindOf(pickedSection.type) : null;
  const cardTools: CardTools | null =
    pickedCard && pickedSection && cardKind === "product"
      ? {
          sectionId: pickedCard.sectionId,
          index: pickedCard.index,
          disabled: !canEdit,
          title: "Product card",
          menuTitle: "Edit product",
          items: availableCardParts(cardContext.look).map((key) => {
            const part = CARD_PARTS.find((p) => p.key === key)!;
            const shown = pickedProduct;
            const value =
              key === "title" ? shown?.name
              : key === "description" ? (shown?.short_description ?? "")
              : key === "price" ? (shown ? formatMoney(shown.price_minor, preview.store.currency) : undefined)
              : key === "comparePrice" ? (shown?.compare_at_price_minor ? formatMoney(shown.compare_at_price_minor, preview.store.currency) : "")
              : key === "image" ? (shown?.image_path ? "Change the picture" : "Add a picture")
              : undefined;
            // Only a real product can be edited; demo products are samples.
            const edit = pickedProduct && previewMode === "store" ? EDIT_FIELD[key] : undefined;
            return { key: part.setting, label: part.label, help: part.help, on: readCardParts(pickedSection.settings, cardContext.descriptionDefault)[key], value, edit };
          }),
          addLabel: "Add a new product",
          onAdd: previewMode === "store" && init.canManage ? () => setCreating("product") : undefined,
          onEdit: (field) => pickedProduct && setEditingProduct({ product: { slug: pickedProduct.slug, name: pickedProduct.name }, field: field as QuickEditField }),
          onToggle: (setting, on) => actions.setSetting(state.pageId, pickedCard.sectionId, setting, on),
        }
      : pickedCard && pickedSection && cardKind === "collection"
      ? {
          sectionId: pickedCard.sectionId,
          index: pickedCard.index,
          disabled: !canEdit,
          title: "Collection card",
          menuTitle: "Edit collection",
          items: COLLECTION_CARD_PARTS.map((part) => {
            const shown = pickedCollection;
            const value =
              part.key === "title" ? shown?.name
              : part.key === "image" ? (shown?.image_path ? "Change the picture" : "Add a picture")
              : part.key === "count" ? (typeof shown?.product_count === "number" ? `${shown.product_count} ${shown.product_count === 1 ? "product" : "products"}` : undefined)
              : undefined;
            // Only a real collection can be edited; demo collections are samples. The count is only shown or hidden.
            const edit = pickedCollection && previewMode === "store" ? COLLECTION_EDIT_FIELD[part.key] : undefined;
            return { key: part.setting, label: part.label, help: part.help, on: readCollectionCardParts(pickedSection.settings, countOnByDefault(cardContext.look))[part.key], value, edit };
          }),
          addLabel: "Add a new collection",
          onAdd: previewMode === "store" && init.canManage ? () => setCreating("collection") : undefined,
          onEdit: (field) => pickedCollection && setEditingCollection({ collection: { id: pickedCollection.id, name: pickedCollection.name }, field: field as CollectionEditField }),
          onToggle: (setting, on) => actions.setSetting(state.pageId, pickedCard.sectionId, setting, on),
        }
      : null;
  const sectionCount = (page.document as { order?: string[] }).order?.length ?? 0;
  // Duplicate and delete for the selected element, shown in the inspector header (only on the page being edited, never shared parts).
  const editableSelection = selection && "sectionId" in selection && selection.docId === state.pageId ? selection : null;
  // A content page is shown with the title and text of the page being previewed in its shared layout.
  const frameDocument = useMemo(
    () => (virtualPage === "content" ? withPageContent(page.document as unknown as TemplateDocument, target.contentPage) : (page.document as unknown as TemplateDocument)),
    [virtualPage, page.document, target.contentPage],
  );
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
    resource: virtualPage ? (virtualPage === "search" ? { products: preview.store.products } : undefined) : page.kind === "product" ? (productResource ?? target.productResource) : page.kind === "collection" ? target.collectionResource : undefined,
  };

  return (
    <div className="sf-editor fixed inset-0 z-50 flex flex-col bg-background text-foreground" role="application" aria-label="Theme editor">
      <header className="flex h-14 shrink-0 items-center gap-1.5 border-b bg-card px-2 sm:gap-2 sm:px-4">
        <Button variant="ghost" size="icon" onClick={() => void leave()} aria-label="Back to themes" title="Back to themes"><ArrowLeft aria-hidden /></Button>
        <div className="hidden min-w-0 items-center gap-2.5 sm:flex">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground" aria-hidden>{(init.themeName ?? "S").charAt(0).toUpperCase()}</span>
          <span className="max-w-40 truncate text-sm font-semibold tracking-tight">{init.themeName ?? "Your storefront"}</span>
          <span className="text-muted-foreground/50" aria-hidden>/</span>
        </div>
        <NativeSelect aria-label="Page to edit" value={state.pageId} disabled={loadingPage} onChange={(e) => void goTo(e.target.value)} className="h-8 w-32 border-transparent bg-muted/70 text-xs font-medium hover:bg-muted sm:w-40">
          <optgroup label="Pages">
            {init.pages.map((p) => (
              <option key={p.id} value={p.id}>{PAGE_LABEL[p.kind] ?? p.name}</option>
            ))}
          </optgroup>
          {themeDocId ? (
            <optgroup label="Other pages">
              {PAGE_KEYS.map((k) => (
                <option key={k} value={virtualId(k)}>{PAGE_LABELS[k]}</option>
              ))}
            </optgroup>
          ) : null}
        </NativeSelect>
        <Button variant="ghost" size="icon-sm" aria-label="Back to the previous page" title="Back" disabled={trail.length === 0 || loadingPage} onClick={goBack}><ArrowLeftToLine aria-hidden /></Button>
        <PreviewTargetSelect page={state.docs[state.pageId]} virtualPage={virtualPage} preview={preview} target={target} disabled={loadingPage} onChoose={(kind, slug) => void goTo(state.pageId, { kind, slug })} />
        {isVirtualId(state.pageId) && init.canManage ? (
          <Button variant="ghost" size="sm" disabled={!canEdit} title="Remove your changes to this page and use the original layout" onClick={() => { if (themeDocId && window.confirm(`Put the ${PAGE_LABELS[virtualKey(state.pageId)]} page back to its original layout?`)) edit((s) => resetVirtualPage(s, themeDocId, virtualKey(state.pageId))); }}>Reset page</Button>
        ) : null}
        {page.kind === "product" && previewMode === "store" && previewProduct.productId ? (
          <Button variant="outline" size="sm" className="hidden max-w-44 sm:inline-flex" onClick={() => { setLeftTab("product"); setMobileTab("sections"); }} aria-label="Product being previewed. Open the Product tab">
            {loadingProduct ? <Loader2 className="animate-spin" aria-hidden /> : <Package aria-hidden />}
            <span className="truncate">{loadingProduct ? `Loading ${loadingProduct.name ?? "product"}…` : (currentEntry?.name ?? "Product")}</span>
          </Button>
        ) : null}
        <div className="hidden min-w-0 flex-1 items-center justify-center gap-3 md:flex">
          <div className="hidden min-w-0 items-center gap-1.5 rounded-full border bg-background px-3 py-1 font-mono text-[11px] text-muted-foreground xl:flex" title={init.storeHost}>
            <Globe className="size-3 shrink-0" aria-hidden />
            <span className="max-w-[22rem] truncate">{init.storeHost}</span>
          </div>
          <div className="flex shrink-0 items-center rounded-lg border bg-background p-0.5" role="group" aria-label="Preview size">
            {DEVICES.map(({ id, label, icon: Icon, width }) => (
              <button key={id} type="button" aria-label={label} title={`${label} (${width}px)`} aria-pressed={device === id} onClick={() => setDevice(id)} className={cn("flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring", device === id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                <Icon className="size-3.5" aria-hidden />
                <span className="hidden font-mono lg:inline">{width}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2 md:ml-0">
          <div className="flex items-center rounded-lg border bg-background p-0.5" role="group" aria-label="History">
            <Button variant="ghost" size="icon-sm" aria-label="Undo (Ctrl+Z)" title="Undo (Ctrl+Z)" disabled={!canUndo(history) || !canEdit} onClick={undoEdit}><Undo2 aria-hidden /></Button>
            <Button variant="ghost" size="icon-sm" aria-label="Redo (Ctrl+Shift+Z)" title="Redo (Ctrl+Shift+Z)" disabled={!canRedo(history) || !canEdit} onClick={redoEdit}><Redo2 aria-hidden /></Button>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setVersionsOpen(true)} aria-label="Version history"><HistoryIcon aria-hidden /><span className="hidden lg:inline">History</span></Button>
          <Button variant="outline" size="sm" onClick={() => setPreviewing(true)}><Eye aria-hidden /><span className="hidden sm:inline">Preview</span></Button>
          {init.canManage ? (
            <Button size="sm" className="px-3.5 shadow-sm" onClick={() => { setPublishOpen(true); void refetchTemplateStatesOnOpen(queryClient); }} disabled={status === "conflict" || status === "invalid" || publish.isPending || publishing}>
              <Rocket aria-hidden /> Publish
            </Button>
          ) : null}
        </div>
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

      <div className="grid min-h-0 flex-1 lg:grid-cols-[320px_minmax(0,1fr)_320px] xl:grid-cols-[336px_minmax(0,1fr)_352px]">
        <aside className={cn("min-h-0 flex-col overflow-hidden border-r bg-card lg:flex lg:flex-row", mobileTab === "sections" ? "flex" : "hidden")} aria-label="Page structure">
          <div className="flex shrink-0 gap-1 border-b bg-muted/40 p-1.5 lg:w-[68px] lg:flex-col lg:border-r lg:border-b-0 lg:p-2" role="tablist" aria-label="Editor tools">
            <RailTab active={leftTab === "sections"} icon={Layers} label="Sections" onClick={() => setLeftTab("sections")} />
            <RailTab active={leftTab === "theme"} icon={Palette} label="Theme" onClick={() => { setLeftTab("theme"); setMobileTab("settings"); }} />
            {page.kind === "product" ? <RailTab active={leftTab === "product"} icon={Package} label="Product" onClick={() => { setLeftTab("product"); setMobileTab("settings"); }} /> : null}
          </div>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="shrink-0 border-b px-4 py-3">
              <h2 className="text-sm font-semibold tracking-tight">{leftTab === "sections" ? PAGE_LABEL[page.kind] ?? page.name : leftTab === "theme" ? "Theme" : "Products"}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {leftTab === "sections" ? `${sectionCount} ${sectionCount === 1 ? "section" : "sections"} · drag to reorder` : leftTab === "theme" ? "Store-wide colours, fonts and buttons" : "Pick a product to customise"}
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {leftTab === "sections" ? (
                <SectionsPanel state={state} groupIds={groupIds} pageKind={page.kind} actions={actions} disabled={!canEdit} cardContext={cardElementsContext} />
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
          </div>
        </aside>

        <main className={cn("min-h-0 min-w-0 flex-col bg-muted/50 lg:flex", mobileTab === "preview" ? "flex" : "hidden")} aria-label="Live preview">
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-card/80 px-3 py-2 backdrop-blur">
            <div className="ml-auto flex items-center gap-2">
              {init.canManage ? (
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="outline" size="sm" aria-label="Add a product, category or collection" />}>
                    <Plus aria-hidden /><span className="hidden sm:inline">Add</span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-60">
                    <DropdownMenuItem onClick={() => setCreating("product")}><Package aria-hidden /> Product</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setCreating("category")}><FolderTree aria-hidden /> Category</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setCreating("collection")}><LayoutGrid aria-hidden /> Collection</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
              <PreviewModeSwitch mode={previewMode} onChange={setPreviewMode} className="hidden bg-background md:inline-flex" />
              <NativeSelect aria-label="Zoom" value={String(zoom)} onChange={(e) => setZoom(Number(e.target.value))} className="hidden h-8 w-20 rounded-lg bg-background text-xs md:block">
                {ZOOMS.map((z) => (
                  <option key={z.label} value={String(z.value)}>{z.label}</option>
                ))}
              </NativeSelect>
              <Button
                variant={inspector ? "default" : "outline"}
                size="icon-sm"
                aria-label="Inspector"
                aria-pressed={inspector}
                aria-keyshortcuts="I"
                title={inspector ? "Inspector on: click anything to select and edit it. Turn off to browse like your store (press I)." : "Inspector off: links open pages and buttons work. Turn on to select and edit (press I)."}
                className={inspector ? undefined : "text-muted-foreground"}
                onClick={() => setInspector((v) => !v)}
              >
                <SquareDashedMousePointer aria-hidden />
              </Button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto bg-[radial-gradient(color-mix(in_oklch,var(--foreground)_14%,transparent)_1px,transparent_1px)] [background-size:20px_20px] p-3 sm:p-6">
            {inspector ? <p className="mb-2 text-center text-xs text-muted-foreground">Double-click any text to edit it right here. Enter saves, Esc cancels.</p> : null}
            <SelectionPath state={state} onSelect={(docId, sectionId, blockId) => actions.select(docId, sectionId, blockId)} />
            <div className="mb-3 flex flex-col items-center gap-1.5">
              <PreviewModeSwitch mode={previewMode} onChange={setPreviewMode} className="bg-background md:hidden" />
              <PreviewModeNote mode={previewMode} storeHasProducts={hasStoreProducts(init.data)} className="text-center" />
            </div>
            <div className={cn("mx-auto overflow-hidden rounded-xl border bg-white shadow-[0_1px_2px_rgb(0_0_0/0.05),0_18px_48px_-16px_rgb(0_0_0/0.22)] ring-1 ring-black/5 transition-[max-width] duration-300 ease-out", device === "desktop" ? "max-w-[1280px]" : device === "tablet" ? "max-w-[820px]" : "max-w-[390px]")}>
              {loadingPage ? (
                <div className="flex h-96 items-center justify-center"><Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Loading page" /></div>
              ) : (
                <ThemeFrame document={frameDocument} device={device} mode="editor" onSelect={onPreviewSelect} onThemeTarget={onThemeTarget} onNavigate={navigateHref} onEditText={onEditText} onEditBlocked={onEditBlocked} inspector={inspector} selectedSectionId={selectedSectionId} selectedBlockId={selectedBlockId} labelFor={labelFor} zoom={zoom || null} cardTools={cardTools} {...frameProps} />
              )}
            </div>
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
            onSetting={(docId, sectionId, blockId, key, value) => edit((s) => setSetting(s, docId, sectionId, blockId, key, value), `set:${docId}:${sectionId}:${blockId ?? ""}:${key}`)}
            onThemeSetting={(docId, group, key, value) => edit((s) => setThemeSetting(s, docId, group, key, value), `theme:${docId}:${group}.${key}`)}
            adapter={adapter}
            cardContext={cardElementsContext}
            styleDevice={STYLE_DEVICE[device]}
            onStyle={onStyle}
            onResetStyle={onResetStyle}
            onSelectParent={onSelectParent}
            focusSetting={focusSetting}
            onFocusConsumed={clearFocus}
            clickedText={clickedText}
            onText={onText}
            onTextStyle={onTextStyle}
            onDuplicate={editableSelection && !editableSelection.blockId ? () => actions.duplicate(editableSelection.docId, editableSelection.sectionId) : undefined}
            onRemove={editableSelection ? () => (editableSelection.blockId ? actions.removeBlock(editableSelection.docId, editableSelection.sectionId, editableSelection.blockId) : actions.remove(editableSelection.docId, editableSelection.sectionId)) : undefined}
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
              <ThemeFrame document={frameDocument} device={device} mode="preview" {...frameProps} />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DeploymentDialog
        open={deploymentOpen !== null}
        onClose={() => setDeploymentOpen(null)}
        deployment={deploymentOpen === "publish" ? lastPublish : liveDeployment}
        host={init.storeHost}
        url={init.storeUrl ?? `/s/${init.storeSlug}`}
        preview={deploymentOpen ? <ThemeFrame document={frameDocument} device="desktop" mode="preview" cropHeight={288} {...frameProps} /> : null}
        pendingChanges={deploymentOpen === "publish" ? dirtyCount > 0 : publication === "unpublished"}
        canPublish={init.canManage && status !== "conflict" && status !== "invalid"}
        onPublish={() => {
          setDeploymentOpen(null);
          setPublishOpen(true);
          void refetchTemplateStatesOnOpen(queryClient);
        }}
        onHistory={() => {
          setDeploymentOpen(null);
          setVersionsOpen(true);
        }}
      />

      <QuickCreate
        kind={creating}
        canEdit={init.canManage}
        currency={init.data.store.currency}
        collections={init.data.collections.map((c) => ({ id: c.id, name: c.name }))}
        onClose={() => setCreating(null)}
        onCreated={(created) => {
          // A new product that shoppers can see is listed in the preview straight away; everything else shows once the page's data is read again.
          if (created.kind === "product" && created.active) {
            const p = created.product;
            setAddedProducts((prev) => [{ slug: p.slug, name: p.name, shortDescription: p.shortDescription, priceMinor: p.priceMinor, compareAtPriceMinor: p.compareAtPriceMinor, imagePath: p.imagePath }, ...prev.filter((x) => x.slug !== p.slug)]);
          }
          router.refresh();
        }}
      />

      <CollectionQuickEdit
        target={editingCollection?.collection ?? null}
        field={editingCollection?.field ?? "name"}
        canEdit={init.canManage}
        onClose={() => setEditingCollection(null)}
        onSaved={(saved) => {
          setCollectionEdits((prev) => ({ ...prev, [saved.id]: { id: saved.id, name: saved.name, description: saved.description, imagePath: saved.imagePath } }));
          router.refresh();
        }}
      />

      <ProductQuickEdit
        target={editingProduct?.product ?? null}
        field={editingProduct?.field ?? "name"}
        canEdit={init.canManage}
        onClose={() => setEditingProduct(null)}
        onSaved={(saved) => {
          setProductEdits((prev) => ({ ...prev, [saved.slug]: { slug: saved.slug, name: saved.name, shortDescription: saved.shortDescription, priceMinor: saved.priceMinor, compareAtPriceMinor: saved.compareAtPriceMinor, imagePath: saved.imagePath } }));
          // The page's own data (the product lists the preview is built from) is read again in the background.
          router.refresh();
        }}
      />

      <VersionsSheet open={versionsOpen} onClose={() => setVersionsOpen(false)} templateId={isVirtualId(state.pageId) && themeDocId ? themeDocId : state.pageId} pageName={isVirtualId(state.pageId) ? "Theme settings and other pages" : (PAGE_LABEL[page.kind] ?? page.name)} canManage={init.canManage} hasUnsavedChanges={isDirty(page) || (themeDocId ? isDirty(state.docs[themeDocId]) : false)} onRestored={(id) => void afterRestore(id)} />

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
      <footer className="flex h-8 shrink-0 items-center justify-between gap-3 border-t bg-card px-3 text-xs text-muted-foreground sm:px-4">
        <SaveIndicator status={status} dirty={dirtyCount} />
        <span className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setDeploymentOpen("live");
              void refetchTemplateStatesOnOpen(queryClient);
            }}
            title="See what is live on your store"
            className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {publication === "unpublished" ? (
              <Badge variant="secondary" className="cursor-pointer gap-1.5"><span className="size-1.5 rounded-full bg-amber-500" aria-hidden /> Changes not published</Badge>
            ) : publication === "checking" ? (
              <Badge variant="outline" className="cursor-pointer"><Loader2 className="size-3 animate-spin" aria-hidden /> Checking publication status…</Badge>
            ) : (
              <Badge variant="outline" className="cursor-pointer gap-1.5"><span className="size-1.5 rounded-full bg-emerald-500" aria-hidden /> Live{liveSince ? ` · ${timeAgo(liveSince)}` : ""}</Badge>
            )}
          </button>
          <span className="hidden font-mono text-[11px] xl:inline">{init.themeName ?? "Your storefront"}</span>
        </span>
      </footer>
      <nav className="grid shrink-0 grid-cols-3 gap-1 border-t bg-card p-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] lg:hidden" role="tablist" aria-label="Editor panels">
        {([["sections", "Sections", Layers], ["preview", "Preview", Eye], ["settings", "Settings", SlidersHorizontal]] as const).map(([t, label, Icon]) => (
          <button key={t} type="button" role="tab" aria-selected={mobileTab === t} onClick={() => setMobileTab(t)} className={cn("flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-[11px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring", mobileTab === t ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}>
            <Icon className="size-[18px]" aria-hidden />
            {label}
          </button>
        ))}
      </nav>
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

function RailTab({ active, icon: Icon, label, onClick }: { active: boolean; icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex flex-1 flex-col items-center gap-1 rounded-lg px-1 py-2 text-[10px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring lg:flex-none",
        active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="size-[18px]" aria-hidden />
      {label}
    </button>
  );
}

function SaveIndicator({ status, dirty = 0 }: { status: SaveStatus; dirty?: number }) {
  const map: Record<SaveStatus, { text: string; tone: string; icon: React.ReactNode }> = {
    saved: { text: "All changes saved", tone: "text-muted-foreground", icon: <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden /> },
    unsaved: { text: dirty > 0 ? `Saving soon · ${dirty} unsaved` : "Unsaved changes", tone: "text-muted-foreground", icon: <span className="size-1.5 rounded-full bg-amber-500" aria-hidden /> },
    saving: { text: "Saving…", tone: "text-muted-foreground", icon: <Loader2 className="size-3.5 animate-spin" aria-hidden /> },
    error: { text: "Not saved", tone: "text-destructive", icon: <CircleAlert className="size-3.5" aria-hidden /> },
    conflict: { text: "Out of date", tone: "text-destructive", icon: <AlertTriangle className="size-3.5" aria-hidden /> },
    invalid: { text: "Fix errors to save", tone: "text-destructive", icon: <CircleAlert className="size-3.5" aria-hidden /> },
  };
  const s = map[status];
  return (
    <span role="status" className={cn("flex items-center gap-1.5 text-xs", s.tone)}>
      {s.icon}{s.text}
    </span>
  );
}


/** Where the selection sits in the page (Section > Block), each part clickable, so a nested element can be left for its parent. */
function SelectionPath({ state, onSelect }: { state: EditorState; onSelect: (docId: string, sectionId: string, blockId?: string) => void }) {
  const sel = state.selection;
  if (!sel || !("sectionId" in sel)) return null;
  const section = (state.docs[sel.docId]?.document as { sections?: Record<string, ComponentNode> } | undefined)?.sections?.[sel.sectionId];
  if (!section) return null;
  const block = sel.blockId ? findNode(section, sel.blockId) : undefined;
  const sectionName = registry.sections[section.type]?.name ?? section.type;
  return (
    <nav aria-label="Selected element" className="mb-2 flex items-center justify-center gap-1 text-xs">
      <Button type="button" size="xs" variant={block ? "ghost" : "secondary"} aria-current={block ? undefined : "true"} onClick={() => onSelect(sel.docId, sel.sectionId)}>{sectionName}</Button>
      {block ? (
        <>
          <ChevronRight className="size-3 text-muted-foreground" aria-hidden />
          <Button type="button" size="xs" variant="secondary" aria-current="true">{registry.blocks[block.type]?.name ?? block.type}</Button>
        </>
      ) : null}
    </nav>
  );
}

/** Which product, collection or content page is shown on a page that shows one of them. */
function PreviewTargetSelect({ page, virtualPage, preview, target, disabled, onChoose }: {
  page: EditorState["docs"][string] | undefined;
  virtualPage: string | null;
  preview: PreviewData;
  target: ReturnType<typeof usePreviewTarget>;
  disabled: boolean;
  onChoose: (kind: TargetKind, slug: string) => void;
}) {
  const kind: TargetKind | null = virtualPage === "content" ? "content" : virtualPage ? null : page?.kind === "product" ? "product" : page?.kind === "collection" ? "collection" : null;
  if (!kind) return null;
  const options =
    kind === "product" ? preview.store.products.map((p) => ({ slug: p.slug, label: p.name }))
    : kind === "collection" ? preview.collections.map((c) => ({ slug: c.slug, label: c.name }))
    : target.contentPages.map((p) => ({ slug: p.slug, label: p.title }));
  const value = kind === "product" ? target.productSlug : kind === "collection" ? target.collectionSlug : target.contentPage?.slug;
  if (options.length === 0) return null;
  return (
    <NativeSelect aria-label={kind === "product" ? "Product to preview" : kind === "collection" ? "Collection to preview" : "Content page to preview"} value={value ?? ""} disabled={disabled} onChange={(e) => onChoose(kind, e.target.value)} className="hidden h-8 w-36 text-xs md:block lg:w-44">
      {options.map((o) => (
        <option key={o.slug} value={o.slug}>{o.label}</option>
      ))}
    </NativeSelect>
  );
}
