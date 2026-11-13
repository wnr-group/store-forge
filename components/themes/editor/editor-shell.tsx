"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Check, CircleAlert, Eye, History, Loader2, Monitor, Palette, PanelLeft, Rocket, Smartphone, Tablet } from "lucide-react";
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
import type { TemplateDocument } from "@/lib/templates/document";
import { validateDocument } from "@/lib/templates/engine/validate";
import { getRegistry } from "@/lib/templates/registry/index";
import {
  addBlock, addSection, createBlockNode, createState, dirtyDocs, duplicateSection, isDirty, markSaved, moveBlock, moveSection, removeBlock, removeSection,
  replaceDoc, select, setSetting, setThemeSetting, toggleSection, type EditorDoc, type EditorState,
} from "@/lib/themes/editor/state";
import { ActionError, themeKeys, usePublishTheme, useTemplates } from "@/lib/themes/queries";
import type { PreviewStoreData, TemplateSummary, ThemeKind } from "@/lib/themes/types";
import { cn } from "@/lib/utils";
import { SectionsPanel, type SectionActions } from "./sections-panel";
import { SettingsPanel } from "./settings-panel";
import { VersionsSheet } from "./versions-sheet";
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
  data: PreviewStoreData & { usesSamples: boolean };
};

type SaveStatus = "saved" | "unsaved" | "saving" | "error" | "conflict" | "invalid";

const PAGE_LABEL: Partial<Record<ThemeKind, string>> = { index: "Home page", product: "Product page", collection: "Collection page" };
const DEVICES: { id: Device; label: string; icon: typeof Monitor }[] = [
  { id: "desktop", label: "Desktop", icon: Monitor },
  { id: "tablet", label: "Tablet", icon: Tablet },
  { id: "mobile", label: "Mobile", icon: Smartphone },
];

/** Sample or real resource the product and collection pages need to show something. */
function resourceFor(kind: ThemeKind, data: PreviewStoreData): Record<string, unknown> | undefined {
  if (kind === "product") {
    const p = data.store.products[0];
    return p ? { ...p, images: p.image_path ? [p.image_path] : [], options: [], variants: [], description_html: p.short_description } : undefined;
  }
  if (kind === "collection") {
    const c = data.collections[0];
    return c ? { ...c, products: data.store.products } : undefined;
  }
  return undefined;
}

export function EditorShell({ init }: { init: EditorInit }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [state, setState] = useState<EditorState>(() => createState(init.pageId, init.docs));
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
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
      for (const doc of dirtyDocs(stateRef.current)) {
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
        setState((prev) => markSaved(prev, doc.templateId, saved.revision, saved.document, json));
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
  }, []);

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
    setLoadingPage(false);
  };

  const reloadAll = async () => {
    setLoadingPage(true);
    await Promise.all(Object.keys(stateRef.current.docs).map(loadDoc));
    setServerProblems({});
    setSaveState("idle");
    setLoadingPage(false);
    toast.success("Loaded the latest version");
  };

  const afterRestore = async (templateId: string) => {
    await loadDoc(templateId);
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
  const frameProps = {
    data: init.data,
    theme: themeDocId ? state.docs[themeDocId].document : null,
    groups: {
      header: groupIds.header ? (state.docs[groupIds.header].document as unknown as TemplateDocument) : null,
      footer: groupIds.footer ? (state.docs[groupIds.footer].document as unknown as TemplateDocument) : null,
      announcement: groupIds.announcement ? (state.docs[groupIds.announcement].document as unknown as TemplateDocument) : null,
    },
    resource: resourceFor(page.kind, init.data),
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
        <SaveIndicator status={status} />
        <div className="ml-auto hidden items-center rounded-md border p-0.5 md:flex" role="group" aria-label="Preview size">
          {DEVICES.map(({ id, label, icon: Icon }) => (
            <Button key={id} size="icon-sm" variant={device === id ? "secondary" : "ghost"} aria-label={label} aria-pressed={device === id} onClick={() => setDevice(id)}><Icon aria-hidden /></Button>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={() => setVersionsOpen(true)} aria-label="Version history"><History aria-hidden /><span className="hidden lg:inline">History</span></Button>
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
          {init.data.usesSamples ? <p className="mb-2 text-center text-xs text-muted-foreground">Sample products are shown where your store has none yet.</p> : null}
          <div className={cn("mx-auto overflow-hidden rounded-md border bg-white shadow-sm transition-[max-width] duration-200", device === "desktop" ? "max-w-[1280px]" : device === "tablet" ? "max-w-[820px]" : "max-w-[390px]")}>
            {loadingPage ? (
              <div className="flex h-96 items-center justify-center"><Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Loading page" /></div>
            ) : (
              <ThemeFrame document={page.document as unknown as TemplateDocument} device={device} mode="editor" onSelect={onPreviewSelect} selectedSectionId={selectedSectionId} {...frameProps} />
            )}
          </div>
        </main>

        <aside className={cn("min-h-0 overflow-y-auto border-l bg-card lg:block", mobileTab === "settings" ? "block" : "hidden")} aria-label="Settings">
          <SettingsPanel
            state={state}
            mode={leftTab === "theme" ? "theme" : "section"}
            themeDocId={themeDocId}
            disabled={!canEdit}
            problems={problems}
            onSetting={(docId, sectionId, blockId, key, value) => edit((s) => setSetting(s, docId, sectionId, blockId, key, value))}
            onThemeSetting={(docId, group, key, value) => edit((s) => setThemeSetting(s, docId, group, key, value))}
          />
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

