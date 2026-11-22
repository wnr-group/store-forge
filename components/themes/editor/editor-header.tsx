"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, ArrowLeftToLine, Eye, Globe, History as HistoryIcon, Loader2, Package, Redo2, Rocket, Undo2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { PAGE_KEYS, PAGE_LABELS } from "@/lib/storefront/pages";
import { isVirtualId, resetVirtualPage, virtualId, virtualKey } from "@/lib/themes/editor/virtual";
import { type PresentationStore } from "@/lib/themes/editor/presentation-state";
import { type EditorState } from "@/lib/themes/editor/state";
import { type PreviewData, type PreviewMode } from "@/lib/themes/preview-data";
import { cn } from "@/lib/utils";
import { refetchTemplateStatesOnOpen } from "@/lib/themes/refresh";
import { canRedo, canUndo } from "@/lib/themes/editor/history";
import { PAGE_LABEL, type SaveStatus } from "@/lib/themes/editor/shell-logic";
import { PreviewTargetSelect } from "./editor-parts";
import { useProductPreview } from "./hooks/use-product-preview";
import { useEditorNavigation } from "./hooks/use-editor-navigation";
import { usePublishFlow } from "./hooks/use-publish-flow";
import { useEditorEdits } from "./hooks/use-editor-edits";
import { useEditorHistory } from "./hooks/use-editor-history";
import { usePreviewTarget } from "./use-preview-target";
import { type Device } from "../theme-frame";
import { type EditorInit } from "./editor-shell";
import { type Dispatch, type SetStateAction } from "react";
import { DEVICES } from "./preview-controls";

/** The top bar: back, page and preview targets, device switcher, history, and Publish. */
export function EditorHeader({ init, state, target, preview, previewMode, canEdit, status, device, setDevice, currentEntry, virtualPage, themeDocId, edit, nav, product, historyApi, publishFlow, setLeftTab, setMobileTab, setPreviewing }: {
  init: EditorInit;
  state: EditorState;
  target: ReturnType<typeof usePreviewTarget>;
  preview: PreviewData;
  previewMode: PreviewMode;
  canEdit: boolean;
  status: SaveStatus;
  device: Device;
  setDevice: (d: Device) => void;
  currentEntry: { name: string } | null;
  virtualPage: string | null;
  themeDocId: string | null;
  edit: ReturnType<typeof useEditorEdits>["edit"];
  nav: ReturnType<typeof useEditorNavigation>;
  product: ReturnType<typeof useProductPreview>;
  historyApi: ReturnType<typeof useEditorHistory>;
  publishFlow: ReturnType<typeof usePublishFlow>;
  setLeftTab: Dispatch<SetStateAction<"sections" | "theme" | "product">>;
  setMobileTab: Dispatch<SetStateAction<"sections" | "preview" | "settings">>;
  setPreviewing: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { trail, loadingPage, goTo, goBack, leave } = nav;
  const { previewProduct, loadingProduct } = product;
  const { history, undoEdit, redoEdit } = historyApi;
  const { publish, publishing, setVersionsOpen, setPublishOpen } = publishFlow;
  const page = state.docs[state.pageId];
  return (
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
  );
}

/** Conflict and read-only notices under the top bar. */
export function EditorBanners({ init, status, presConflict, presStore, product, reloadAll }: {
  init: EditorInit;
  status: SaveStatus;
  presConflict: string | null;
  presStore: PresentationStore;
  product: ReturnType<typeof useProductPreview>;
  reloadAll: () => Promise<void>;
}) {
  const { reloadPresentation } = product;
  return (
    <>
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
    </>
  );
}
