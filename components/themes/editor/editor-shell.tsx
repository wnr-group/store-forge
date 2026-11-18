"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, ArrowLeftToLine, Check, ChevronRight, CircleAlert, Eye, History as HistoryIcon, Link2, Loader2, Monitor, MousePointerClick, Palette, PanelLeft, Redo2, Rocket, Smartphone, Tablet, Undo2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { getTemplateAction, saveDraftAction } from "@/app/(dashboard)/dashboard/templates/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/native-select";
import { ROUTES } from "@/config/app";
import { adapterForLook, lookOf } from "@/lib/editor/adapters";
import { findSettingForClick } from "@/lib/editor/locate";
import { originalOf, readTextOverrides } from "@/lib/editor/text";
import { PAGE_KEYS, PAGE_LABELS, routeForHref, withPageContent } from "@/lib/storefront/pages";
import { foldVirtualPages, isVirtualId, openVirtualPage, rebuildVirtualPages, resetVirtualPage, virtualId, virtualKey } from "@/lib/themes/editor/virtual";
import type { PartStyleKey, StyleDevice, StyleKey as StyleKeyType } from "@/lib/editor/style";
import type { ComponentNode, TemplateDocument } from "@/lib/templates/document";
import { validateDocument } from "@/lib/templates/engine/validate";
import { getRegistry } from "@/lib/templates/registry/index";
import {
  addBlock, addSection, createBlockNode, createState, dirtyDocs, duplicateSection, isDirty, markSaved, moveBlock, moveSection, removeBlock, removeSection,
  replaceDoc, resetElementStyle, select, setElementStyle, setSetting, setTextOverride, setTextStyle, setThemeSetting, toggleSection, type EditorDoc, type EditorState,
} from "@/lib/themes/editor/state";
import { canRedo, canUndo, emptyHistory, record, redo, undo, type History } from "@/lib/themes/editor/history";
import { ActionError, themeKeys, usePublishTheme, useTemplates } from "@/lib/themes/queries";
import { hasStoreProducts, previewData, type PreviewData, type PreviewMode } from "@/lib/themes/preview-data";
import type { PreviewStoreData, TemplateSummary, ThemeKind } from "@/lib/themes/types";
import { cn } from "@/lib/utils";
import { SectionsPanel, type SectionActions } from "./sections-panel";
import { CollectionChoicesContext } from "./setting-field";
import { SettingsPanel } from "./settings-panel";
import { usePreviewTarget, type TargetKind } from "./use-preview-target";
import { VersionsSheet } from "./versions-sheet";
import { PreviewModeNote, PreviewModeSwitch } from "../preview-mode-switch";
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

export type EditorInit = {
  tenantId: string;
  canManage: boolean;
  storeSlug: string;
  themeName: string | null;
  pages: Pick<TemplateSummary, "id" | "kind" | "name">[];
  pageId: string;
  docs: Omit<EditorDoc, "saved">[];
  data: PreviewStoreData;
};

type SaveStatus = "saved" | "unsaved" | "saving" | "error" | "conflict" | "invalid";

const PAGE_LABEL: Partial<Record<ThemeKind, string>> = { index: "Home page", product: "Product page", collection: "Collection page" };
const DEVICES: { id: Device; label: string; icon: typeof Monitor }[] = [
  { id: "desktop", label: "Desktop", icon: Monitor },
  { id: "tablet", label: "Tablet", icon: Tablet },
  { id: "mobile", label: "Mobile", icon: Smartphone },
];
/** The preview device a style change is written for. */
const STYLE_DEVICE: Record<Device, StyleDevice> = { desktop: "base", tablet: "tablet", mobile: "mobile" };
const ZOOMS = [{ label: "Fit", value: 0 }, { label: "50%", value: 0.5 }, { label: "75%", value: 0.75 }, { label: "100%", value: 1 }, { label: "125%", value: 1.25 }];

export function EditorShell({ init }: { init: EditorInit }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [state, setState] = useState<EditorState>(() => createState(init.pageId, init.docs));
  // The latest state, updated synchronously by `commit`, so a burst of edits or an edit during a save never works from a stale copy.
  const stateRef = useRef(state);
  const historyRef = useRef<History>(emptyHistory());
  const [history, setHistory] = useState<History>(emptyHistory);
  const commit = useCallback((fn: (s: EditorState) => EditorState): EditorState => {
    const next = fn(stateRef.current);
    stateRef.current = next;
    setState(next);
    return next;
  }, []);
  const [zoom, setZoom] = useState(0);
  const [focusSetting, setFocusSetting] = useState<{ key: string; nonce: number } | null>(null);
  const [clickedText, setClickedText] = useState<{ text: string; nonce: number } | null>(null);
  // The merchant's real catalogue by default; demo content only on request, and never saved anywhere.
  const [previewMode, setPreviewMode] = useState<PreviewMode>("store");
  const preview = useMemo(() => previewData(init.data, previewMode), [init.data, previewMode]);
  // Browsing inside the editor: which product, collection or content page is shown, links that open pages, and a way back.
  const target = usePreviewTarget(preview);
  const [linkMode, setLinkMode] = useState<"open" | "select">("open");
  type TrailStep = { pageId: string; ref?: { kind: TargetKind; slug: string } };
  const [trail, setTrail] = useState<TrailStep[]>([]);
  // What the server round trip is doing; the visible status below is derived from this and the document state.
  const [saveState, setSaveState] = useState<"idle" | "saving" | "error" | "conflict">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [serverProblems, setServerProblems] = useState<Record<string, Record<string, string>>>({});
  const [device, setDevice] = useState<Device>("desktop");
  const [leftTab, setLeftTab] = useState<"sections" | "theme">("sections");
  const [mobileTab, setMobileTab] = useState<"sections" | "preview" | "settings">("preview");
  const [previewing, setPreviewing] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [loadingPage, setLoadingPage] = useState(false);
  const saving = useRef(false);
  const retries = useRef(0);

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
  const hasLocalProblems = Object.keys(localProblems).length > 0;
  const problems = useMemo(() => {
    const merged: Record<string, Record<string, string>> = { ...serverProblems };
    for (const [id, p] of Object.entries(localProblems)) merged[id] = { ...merged[id], ...p };
    return merged;
  }, [serverProblems, localProblems]);

  const dirtyCount = dirtyDocs(state).length;
  const status: SaveStatus =
    saveState === "conflict" ? "conflict" : saveState === "saving" ? "saving" : saveState === "error" ? "error" : hasLocalProblems ? "invalid" : dirtyCount > 0 ? "unsaved" : "saved";

  const canEdit = init.canManage && status !== "conflict";

  // ---- saving --------------------------------------------------------------------------------------------------
  const flush = useCallback(async (): Promise<boolean> => {
    if (saving.current) return false;
    saving.current = true;
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
            setSaveState("conflict");
            return false;
          }
          if (result.fieldErrors) {
            const mapped: Record<string, string> = {};
            for (const [key, message] of Object.entries(result.fieldErrors)) mapped[key.startsWith(`${doc.kind}.`) ? key.slice(doc.kind.length + 1) : key] = message;
            setServerProblems((prev) => ({ ...prev, [doc.templateId]: mapped }));
          }
          setSaveState("error");
          setSaveError(result.error);
          return false;
        }
        const saved = result.data!;
        setServerProblems((prev) => ({ ...prev, [doc.templateId]: {} }));
        commit((prev) => markSaved(prev, doc.templateId, saved.revision, saved.document, json));
      }
      retries.current = 0;
      setSaveState("idle");
      return true;
    } catch {
      setSaveState("error");
      setSaveError("Your changes could not be saved. Check your connection.");
      return false;
    } finally {
      saving.current = false;
    }
  }, [commit]);

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
  }, [state, status, flush]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirtyDocs(stateRef.current).length > 0 || saving.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  // ---- edits ---------------------------------------------------------------------------------------------------
  /** Applies an edit and records an undo step for it. Edits with the same `key` in quick succession are one step. */
  const edit = useCallback(
    (fn: (s: EditorState) => EditorState, key?: string) => {
      const before = stateRef.current;
      const after = commit(fn);
      if (after.docs !== before.docs) {
        historyRef.current = record(historyRef.current, before, key);
        setHistory(historyRef.current);
      }
      setSaveState((s) => (s === "error" ? "idle" : s));
    },
    [commit],
  );

  const stepHistory = useCallback(
    (direction: "undo" | "redo") => {
      const result = (direction === "undo" ? undo : redo)(historyRef.current, stateRef.current);
      if (!result) return;
      historyRef.current = result.history;
      setHistory(result.history);
      commit(() => result.state);
      setSaveState((s) => (s === "error" ? "idle" : s));
    },
    [commit],
  );

  useEffect(() => {
    // Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z and Ctrl+Y, unless a text field has focus (it keeps its own undo).
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(input|textarea|select)$/i.test(el.tagName))) return;
      const k = e.key.toLowerCase();
      if (k === "z") {
        e.preventDefault();
        stepHistory(e.shiftKey ? "redo" : "undo");
      } else if (k === "y") {
        e.preventDefault();
        stepHistory("redo");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stepHistory]);

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

  /** What the theme lets the merchant style, and the look it comes from. */
  const adapter = useMemo(() => {
    const themeId = Object.values(state.docs).find((d) => d.kind === "theme_settings")?.templateId;
    return adapterForLook(lookOf(themeId ? state.docs[themeId].document : null));
    // Only the theme document decides this; page edits never change the look.
  }, [state.docs]);

  const onPreviewSelect = useCallback(
    (target: ClickTarget) => {
      const s = stateRef.current;
      const order = [s.pageId, ...Object.keys(s.docs).filter((id) => id !== s.pageId)];
      const docId = order.find((id) => (s.docs[id].document as { sections?: Record<string, unknown> }).sections?.[target.sectionId]);
      if (!docId) return;
      const known = (s.docs[docId].document as { sections: Record<string, ComponentNode> }).sections[target.sectionId];
      const blockId = target.blockId && known && findNode(known, target.blockId) ? target.blockId : undefined;
      edit((prev) => select(prev, { docId, sectionId: target.sectionId, blockId }));
      setLeftTab("sections");
      setMobileTab("settings");
      // Clicked text or a picture: jump to the setting that holds it (the block first, then its section).
      const section = (s.docs[docId].document as { sections: Record<string, ComponentNode> }).sections[target.sectionId];
      const block = blockId ? findNode(section, blockId) : undefined;
      const element = block ?? section;
      const descriptors = (block ? registry.blocks[block.type] : registry.sections[section.type])?.settings ?? [];
      const key = findSettingForClick([{ descriptors, settings: element.settings }], target);
      setFocusSetting(key ? { key, nonce: Date.now() } : null);
      // Text no setting holds (the theme writes it into its own components): offer it for replacement in the panel.
      const shown = target.text ? originalOf(readTextOverrides(section.settings), target.text) : "";
      setClickedText(!key && target.text ? { text: shown, nonce: Date.now() } : null);
    },
    [edit],
  );

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
    const route = routeForHref(href);
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
    setLoadingPage(false);
  };

  const reloadAll = async () => {
    setLoadingPage(true);
    await Promise.all(Object.keys(stateRef.current.docs).filter((id) => !isVirtualId(id)).map(loadDoc));
    if (themeDocId) commit((s) => rebuildVirtualPages(s, themeDocId));
    setServerProblems({});
    setSaveState("idle");
    historyRef.current = emptyHistory();
    setHistory(historyRef.current);
    setLoadingPage(false);
    toast.success("Loaded the latest version");
  };

  const afterRestore = async (templateId: string) => {
    await loadDoc(templateId);
    if (themeDocId && templateId === themeDocId) commit((s) => rebuildVirtualPages(s, themeDocId));
    historyRef.current = emptyHistory();
    setHistory(historyRef.current);
    setVersionsOpen(false);
    void queryClient.invalidateQueries({ queryKey: themeKeys.templates });
  };

  // ---- publish -------------------------------------------------------------------------------------------------
  const doPublish = async () => {
    const ok = dirtyDocs(stateRef.current).length === 0 || (!hasLocalProblems && (await flush()));
    if (!ok) {
      setPublishOpen(false);
      toast.error("Fix the highlighted problems before publishing.");
      return;
    }
    try {
      const result = await publish.mutateAsync(undefined);
      setPublishOpen(false);
      toast.success(result.published.length ? `Published ${result.published.length} ${result.published.length === 1 ? "page" : "pages"}` : "Your store is already up to date", {
        action: { label: "View store", onClick: () => window.open(`/s/${result.storeSlug}`, "_blank", "noopener") },
      });
    } catch (error) {
      toast.error(error instanceof ActionError ? error.message : "Could not publish. Please try again.");
    }
  };

  const leave = async () => {
    if (dirtyDocs(stateRef.current).length > 0 && !(await flush()) && !window.confirm("Some changes could not be saved. Leave anyway?")) return;
    router.push(ROUTES.templates);
  };

  const unpublished = (templates.data ?? []).some((t) => t.status === "active" && t.publicationState !== "published") || dirtyCount > 0;
  const selection = state.selection;
  const selectedSectionId = selection && "sectionId" in selection && selection.docId === state.pageId ? selection.sectionId : null;
  const selectedBlockId = selection && "blockId" in selection && selection.docId === state.pageId ? (selection.blockId ?? null) : null;
  const virtualPage = isVirtualId(state.pageId) ? virtualKey(state.pageId) : null;
  // A content page is shown with the title and text of the page being previewed in its shared layout.
  const frameDocument = useMemo(
    () => (virtualPage === "content" ? withPageContent(page.document as unknown as TemplateDocument, target.contentPage) : (page.document as unknown as TemplateDocument)),
    [virtualPage, page.document, target.contentPage],
  );
  const frameProps = {
    data: preview,
    theme: themeDocId ? state.docs[themeDocId].document : null,
    groups: {
      header: groupIds.header ? (state.docs[groupIds.header].document as unknown as TemplateDocument) : null,
      footer: groupIds.footer ? (state.docs[groupIds.footer].document as unknown as TemplateDocument) : null,
      announcement: groupIds.announcement ? (state.docs[groupIds.announcement].document as unknown as TemplateDocument) : null,
    },
    resource: virtualPage ? (virtualPage === "search" ? { products: preview.store.products } : undefined) : page.kind === "product" ? target.productResource : page.kind === "collection" ? target.collectionResource : undefined,
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background text-foreground" role="application" aria-label="Theme editor">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-card px-2 sm:px-3">
        <Button variant="ghost" size="sm" onClick={() => void leave()} aria-label="Back to themes"><ArrowLeft aria-hidden /><span className="hidden sm:inline">Themes</span></Button>
        <div className="hidden min-w-0 items-center gap-2 border-l pl-3 sm:flex">
          <Palette className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate text-sm font-medium">{init.themeName ?? "Your storefront"}</span>
        </div>
        <NativeSelect aria-label="Page to edit" value={state.pageId} disabled={loadingPage} onChange={(e) => void goTo(e.target.value)} className="h-8 w-36 text-xs sm:w-44">
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
        <SaveIndicator status={status} />
        <div className="flex items-center" role="group" aria-label="History">
          <Button variant="ghost" size="icon-sm" aria-label="Undo (Ctrl+Z)" title="Undo (Ctrl+Z)" disabled={!canUndo(history) || !canEdit} onClick={() => stepHistory("undo")}><Undo2 aria-hidden /></Button>
          <Button variant="ghost" size="icon-sm" aria-label="Redo (Ctrl+Shift+Z)" title="Redo (Ctrl+Shift+Z)" disabled={!canRedo(history) || !canEdit} onClick={() => stepHistory("redo")}><Redo2 aria-hidden /></Button>
        </div>
        <PreviewModeSwitch mode={previewMode} onChange={setPreviewMode} className="ml-auto hidden md:inline-flex" />
        <div className="hidden items-center rounded-md border p-0.5 md:flex" role="group" aria-label="Preview size">
          {DEVICES.map(({ id, label, icon: Icon }) => (
            <Button key={id} size="icon-sm" variant={device === id ? "secondary" : "ghost"} aria-label={label} aria-pressed={device === id} onClick={() => setDevice(id)}><Icon aria-hidden /></Button>
          ))}
        </div>
        <Button variant={linkMode === "open" ? "secondary" : "ghost"} size="sm" aria-pressed={linkMode === "open"} title={linkMode === "open" ? "Clicking a link opens its page. Switch to select the link itself." : "Clicking a link selects it. Switch to open pages."} onClick={() => setLinkMode((m) => (m === "open" ? "select" : "open"))}>
          {linkMode === "open" ? <Link2 aria-hidden /> : <MousePointerClick aria-hidden />}<span className="hidden lg:inline">{linkMode === "open" ? "Links open pages" : "Links are selected"}</span>
        </Button>
        <NativeSelect aria-label="Zoom" value={String(zoom)} onChange={(e) => setZoom(Number(e.target.value))} className="hidden h-8 w-20 text-xs md:block">
          {ZOOMS.map((z) => (
            <option key={z.label} value={String(z.value)}>{z.label}</option>
          ))}
        </NativeSelect>
        <Button variant="ghost" size="sm" onClick={() => setVersionsOpen(true)} aria-label="Version history"><HistoryIcon aria-hidden /><span className="hidden lg:inline">History</span></Button>
        <Button variant="outline" size="sm" onClick={() => setPreviewing(true)}><Eye aria-hidden /><span className="hidden sm:inline">Preview</span></Button>
        {init.canManage ? (
          <Button size="sm" onClick={() => setPublishOpen(true)} disabled={status === "conflict" || status === "invalid" || publish.isPending}>
            <Rocket aria-hidden /> Publish
          </Button>
        ) : null}
      </header>

      {status === "conflict" ? (
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
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {leftTab === "sections" ? (
              <SectionsPanel state={state} groupIds={groupIds} pageKind={page.kind} actions={actions} disabled={!canEdit} />
            ) : (
              <p className="p-4 text-sm text-muted-foreground">Colours, fonts, spacing and buttons for the whole store are on the right. Changes show in the preview straight away.</p>
            )}
          </div>
        </aside>

        <main className={cn("min-h-0 overflow-auto bg-muted/50 p-3 lg:block sm:p-5", mobileTab === "preview" ? "block" : "hidden")} aria-label="Live preview">
          <SelectionPath state={state} onSelect={(docId, sectionId, blockId) => actions.select(docId, sectionId, blockId)} />
          <div className="mb-2 flex flex-col items-center gap-1.5">
            <PreviewModeSwitch mode={previewMode} onChange={setPreviewMode} className="md:hidden" />
            <PreviewModeNote mode={previewMode} storeHasProducts={hasStoreProducts(init.data)} className="text-center" />
          </div>
          <div className={cn("mx-auto overflow-hidden rounded-md border bg-white shadow-sm transition-[max-width] duration-200", device === "desktop" ? "max-w-[1280px]" : device === "tablet" ? "max-w-[820px]" : "max-w-[390px]")}>
            {loadingPage ? (
              <div className="flex h-96 items-center justify-center"><Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Loading page" /></div>
            ) : (
              <ThemeFrame document={frameDocument} device={device} mode="editor" onSelect={onPreviewSelect} onNavigate={navigateHref} linkMode={linkMode} selectedSectionId={selectedSectionId} selectedBlockId={selectedBlockId} zoom={zoom || null} {...frameProps} />
            )}
          </div>
        </main>

        <aside className={cn("min-h-0 overflow-y-auto border-l bg-card lg:block", mobileTab === "settings" ? "block" : "hidden")} aria-label="Settings">
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
            styleDevice={STYLE_DEVICE[device]}
            onStyle={onStyle}
            onResetStyle={onResetStyle}
            onSelectParent={onSelectParent}
            focusSetting={focusSetting}
            onFocusConsumed={clearFocus}
            clickedText={clickedText}
            onText={onText}
            onTextStyle={onTextStyle}
          />
          </CollectionChoicesContext.Provider>
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

      <VersionsSheet open={versionsOpen} onClose={() => setVersionsOpen(false)} templateId={isVirtualId(state.pageId) && themeDocId ? themeDocId : state.pageId} pageName={isVirtualId(state.pageId) ? "Theme settings and other pages" : (PAGE_LABEL[page.kind] ?? page.name)} canManage={init.canManage} hasUnsavedChanges={isDirty(page) || (themeDocId ? isDirty(state.docs[themeDocId]) : false)} onRestored={(id) => void afterRestore(id)} />

      <AlertDialog open={publishOpen} onOpenChange={setPublishOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish your theme?</AlertDialogTitle>
            <AlertDialogDescription>
              Your latest changes go live on your store now: every page, the header, the footer and your theme settings. Each page is saved as a numbered version you can restore later. Products, customers and orders are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={publish.isPending}>Not yet</AlertDialogCancel>
            <AlertDialogAction disabled={publish.isPending} onClick={() => void doPublish()}>
              {publish.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Rocket aria-hidden />} Publish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <p className="sr-only" aria-live="polite">{unpublished ? "You have changes that are not published." : "Everything is published."}</p>
      <span className="fixed right-3 bottom-3 hidden xl:block">{unpublished ? <Badge variant="secondary">Changes not published</Badge> : <Badge variant="outline"><Check className="size-3" aria-hidden /> Published</Badge>}</span>
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
