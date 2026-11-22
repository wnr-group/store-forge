"use client";

import { type GalleryLayout, type HideableBlock, type MediaPosition } from "@/lib/templates/product-presentation";
import { availableItems, productActions, setBlockHidden, setFocalPoint, setGalleryLayout, setMediaPosition } from "@/lib/themes/editor/presentation-state";
import { setNodeDisplay } from "@/lib/themes/editor/display-state";
import { setSetting, setThemeSetting, type EditorState } from "@/lib/themes/editor/state";
import { type PreviewMode } from "@/lib/themes/preview-data";
import { cn } from "@/lib/utils";
import { productLayoutState } from "@/lib/themes/refresh";
import { STYLE_DEVICE } from "@/lib/themes/editor/shell-logic";
import { useProductPreview } from "./hooks/use-product-preview";
import { useEditorEdits } from "./hooks/use-editor-edits";
import { ProductCustomizer } from "./product-customizer";
import { type ProductStatus } from "./product-status";
import { CollectionChoicesContext } from "./setting-field";
import { SettingsPanel } from "./settings-panel";
import { type Device } from "../theme-frame";
import { type EditorInit } from "./editor-shell";
import { type ComponentProps } from "react";

/** The right column: the product customizer, or the settings of the selected section or the theme. */
export function EditorSettingsAside({ init, state, page, mobileTab, leftTab, previewMode, themeDocId, canEdit, problems, device, layoutState, currentEntry, inherited, productAct, productProblems, statusOfProduct, product, edits, editableSelection, nowMs }: {
  init: EditorInit;
  state: EditorState;
  page: EditorState["docs"][string];
  mobileTab: "sections" | "preview" | "settings";
  leftTab: "sections" | "theme" | "product";
  previewMode: PreviewMode;
  themeDocId: string | null;
  canEdit: boolean;
  problems: Record<string, Record<string, string>>;
  device: Device;
  layoutState: ReturnType<typeof productLayoutState>;
  currentEntry: ComponentProps<typeof ProductCustomizer>["entry"];
  inherited: { layout: GalleryLayout; mediaPosition: MediaPosition };
  productAct: ReturnType<typeof productActions>;
  productProblems: Record<string, string>;
  statusOfProduct: (id: string) => ProductStatus;
  product: ReturnType<typeof useProductPreview>;
  edits: ReturnType<typeof useEditorEdits>;
  editableSelection: Extract<NonNullable<EditorState["selection"]>, { sectionId: string }> | null;
  /** The preview clock (epoch ms) the "When to show" state chip is computed against. */
  nowMs: number;
}) {
  const { previewProduct, loadingProduct, presBusy, lastTarget, loadProduct, editPres, publishThisProduct, resetThisProduct } = product;
  const { edit, actions, adapter, cardContext, onStyle, onResetStyle, onSelectParent, focusSetting, clearFocus, clickedText, onText, onTextStyle } = edits;
  return (
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
            cardContext={cardContext}
            studioEnabled={Boolean(init.studioEnabled)}
            timezone={init.data.store.timezone}
            nowMs={nowMs}
            onDisplay={(docId, sectionId, blockId, display) => edit((s) => setNodeDisplay(s, docId, sectionId, blockId, display), `display:${docId}:${sectionId}:${blockId ?? ""}`)}
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
  );
}
