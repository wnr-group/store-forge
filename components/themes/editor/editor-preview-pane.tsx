"use client";

import { FolderTree, LayoutGrid, Loader2, Package, Plus, SquareDashedMousePointer } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { type EditorState } from "@/lib/themes/editor/state";
import { hasStoreProducts, type PreviewMode } from "@/lib/themes/preview-data";
import { cn } from "@/lib/utils";
import { SelectionPath } from "./editor-parts";
import { type SectionActions } from "./sections-panel";
import { type CreateKind } from "./quick-create";
import { PreviewModeNote, PreviewModeSwitch } from "../preview-mode-switch";
import { type CardTools } from "../selection-overlay";
import { ThemeFrame, type Device } from "../theme-frame";
import { type EditorInit } from "./editor-shell";
import { type ComponentProps, type Dispatch, type SetStateAction } from "react";
import { PreviewAsOf, ZOOMS } from "./preview-controls";

type FrameProps = Pick<ComponentProps<typeof ThemeFrame>, "data" | "theme" | "groups" | "resource" | "previewNow">;

/** The middle column: add menu, preview mode, zoom, inspector toggle, and the live preview of the page. */
export function EditorPreviewPane({ init, state, mobileTab, previewMode, setPreviewMode, setCreating, zoom, setZoom, inspector, setInspector, actions, device, loadingPage, frameDocument, frameProps, onPreviewSelect, navigateHref, onEditText, onEditBlocked, labelFor, selectedSectionId, selectedBlockId, cardTools, previewNow, setPreviewNow }: {
  init: EditorInit;
  state: EditorState;
  mobileTab: "sections" | "preview" | "settings";
  previewMode: PreviewMode;
  setPreviewMode: Dispatch<SetStateAction<PreviewMode>>;
  setCreating: Dispatch<SetStateAction<CreateKind | null>>;
  zoom: number;
  setZoom: Dispatch<SetStateAction<number>>;
  inspector: boolean;
  setInspector: Dispatch<SetStateAction<boolean>>;
  actions: SectionActions;
  device: Device;
  loadingPage: boolean;
  frameDocument: ComponentProps<typeof ThemeFrame>["document"];
  frameProps: FrameProps;
  onPreviewSelect: ComponentProps<typeof ThemeFrame>["onSelect"];
  navigateHref: ComponentProps<typeof ThemeFrame>["onNavigate"];
  onEditText: ComponentProps<typeof ThemeFrame>["onEditText"];
  onEditBlocked: ComponentProps<typeof ThemeFrame>["onEditBlocked"];
  labelFor: ComponentProps<typeof ThemeFrame>["labelFor"];
  selectedSectionId: string | null;
  selectedBlockId: string | null;
  cardTools: CardTools | null;
  /** The "Preview as of" instant (UTC ISO) and its setter. The control is shown only where Studio is on. */
  previewNow: string | null;
  setPreviewNow: (utcIso: string | null) => void;
}) {
  return (
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
              {init.studioEnabled ? <PreviewAsOf value={previewNow} timezone={init.data.store.timezone} onChange={setPreviewNow} /> : null}
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
                <ThemeFrame document={frameDocument} device={device} mode="editor" onSelect={onPreviewSelect} onNavigate={navigateHref} onEditText={onEditText} onEditBlocked={onEditBlocked} inspector={inspector} selectedSectionId={selectedSectionId} selectedBlockId={selectedBlockId} labelFor={labelFor} zoom={zoom || null} cardTools={cardTools} {...frameProps} />
              )}
            </div>
          </div>
        </main>
  );
}
