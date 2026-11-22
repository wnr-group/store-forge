"use client";

import { Layers, Package, Palette } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { type EditorState } from "@/lib/themes/editor/state";
import { type PreviewMode } from "@/lib/themes/preview-data";
import { cn } from "@/lib/utils";
import { PAGE_LABEL } from "@/lib/themes/editor/shell-logic";
import { RailTab } from "./editor-parts";
import { useProductPreview } from "./hooks/use-product-preview";
import { ProductPicker } from "./product-picker";
import { type ProductStatus } from "./product-status";
import { SectionsPanel, type SectionActions } from "./sections-panel";
import { type ComponentProps, type Dispatch, type SetStateAction } from "react";

/** The left column: the rail tabs and the sections, theme or product list. */
export function EditorLeftPanel({ state, page, groupIds, sectionCount, mobileTab, leftTab, setLeftTab, setMobileTab, actions, canEdit, cardContext, adapter, previewMode, setPreviewMode, product, statusOfProduct, presList, badgeNowMs }: {
  state: EditorState;
  page: EditorState["docs"][string];
  groupIds: ComponentProps<typeof SectionsPanel>["groupIds"];
  sectionCount: number;
  mobileTab: "sections" | "preview" | "settings";
  leftTab: "sections" | "theme" | "product";
  setLeftTab: Dispatch<SetStateAction<"sections" | "theme" | "product">>;
  setMobileTab: Dispatch<SetStateAction<"sections" | "preview" | "settings">>;
  actions: SectionActions;
  canEdit: boolean;
  cardContext: ComponentProps<typeof SectionsPanel>["cardContext"];
  adapter: ComponentProps<typeof SectionsPanel>["adapter"];
  previewMode: PreviewMode;
  setPreviewMode: Dispatch<SetStateAction<PreviewMode>>;
  product: ReturnType<typeof useProductPreview>;
  statusOfProduct: (id: string) => ProductStatus;
  presList: { isError: boolean };
  /** The preview clock for the display badges; null when Studio is off. */
  badgeNowMs: number | null;
}) {
  const { previewProduct, lastTarget, loadProduct, loadingProduct, presBusy, onPickProduct } = product;
  return (
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
                <SectionsPanel state={state} groupIds={groupIds} pageKind={page.kind} actions={actions} disabled={!canEdit} cardContext={cardContext} adapter={adapter} badgeNowMs={badgeNowMs} />
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
  );
}
