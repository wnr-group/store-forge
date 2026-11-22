"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { toast } from "sonner";
import { getPresentationAction, loadProductPreviewAction } from "@/app/(dashboard)/dashboard/templates/actions";
import { ActionError, themeKeys, usePublishPresentation, useResetPresentation } from "@/lib/themes/queries";
import { productLayoutState, refreshTemplateStates } from "@/lib/themes/refresh";
import { createFlusher, saveFailureMessage } from "@/lib/themes/editor/flusher";
import { isEntryDirty, mergeLoadedProduct, productActions, replaceEntry, type PresentationStore } from "@/lib/themes/editor/presentation-state";
import type { SaveState } from "@/lib/themes/editor/shell-logic";
import { isDirty, type EditorState } from "@/lib/themes/editor/state";
import type { PickerProduct, TemplateSummary } from "@/lib/themes/types";
import type { EditorInit } from "../editor-shell";

export type PreviewProductState = { status: "idle" | "loading" | "ready" | "error"; productId: string | null; resource: Record<string, unknown> | null; error: string | null; presentationError: string | null };
export const NO_PRODUCT: PreviewProductState = { status: "idle", productId: null, resource: null, error: null, presentationError: null };
export type ProductTarget = { productId?: string; slug?: string };

type Args = {
  init: EditorInit;
  stateRef: MutableRefObject<EditorState>;
  presRef: MutableRefObject<PresentationStore>;
  setPresStore: Dispatch<SetStateAction<PresentationStore>>;
  setPresServerProblems: Dispatch<SetStateAction<Record<string, Record<string, string>>>>;
  presConflict: string | null;
  setPresConflict: Dispatch<SetStateAction<string | null>>;
  setSaveState: Dispatch<SetStateAction<SaveState>>;
  setMobileTab: (tab: "sections" | "preview" | "settings") => void;
  canEdit: boolean;
  flusher: ReturnType<typeof createFlusher>;
  hasLocalProblems: boolean;
  productsSaved: () => boolean;
};

/** The product shown on the Product page: loading it, its settings (editing, publishing, resetting) and keeping the address in step. */
export function useProductPreview({ init, stateRef, presRef, setPresStore, setPresServerProblems, presConflict, setPresConflict, setSaveState, setMobileTab, canEdit, flusher, hasLocalProblems, productsSaved }: Args) {
  const queryClient = useQueryClient();
  const [previewProduct, setPreviewProduct] = useState<PreviewProductState>(() =>
    init.initialProduct
      ? { status: "ready", productId: init.initialProduct.productId, resource: init.initialProduct.resource, error: null, presentationError: init.initialProduct.presentationError }
      : init.initialProductError
        ? { ...NO_PRODUCT, status: "error", error: init.initialProductError }
        : NO_PRODUCT,
  );
  // The product being loaded after a pick: until it arrives nothing product-specific may act, so no action can reach the previous one.
  const [loadingProduct, setLoadingProduct] = useState<{ id: string | null; name: string | null } | null>(null);
  const [presBusy, setPresBusy] = useState<"publishing" | "resetting" | null>(null);
  const loadToken = useRef(0);
  const lastTarget = useRef<ProductTarget | null>(null);
  const publishProduct = usePublishPresentation();
  const resetProduct = useResetPresentation();

  /** The product page is edited here and not yet saved. */
  const productPageDirty = () => {
    const id = init.pages.find((p) => p.kind === "product")?.id;
    const doc = id ? stateRef.current.docs[id] : undefined;
    return doc ? isDirty(doc) : false;
  };

  const editPres = useCallback((fn: (s: PresentationStore) => PresentationStore) => {
    setPresStore((prev) => fn(prev));
    setSaveState((s) => (s === "error" ? "idle" : s));
  }, [setPresStore, setSaveState]);

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
    [syncProductParam, setPresStore],
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

  return { previewProduct, loadingProduct, presBusy, lastTarget, loadProduct, syncProductParam, editPres, onPickProduct, firstProductSlug, reloadPresentation, refreshEntries, publishThisProduct, resetThisProduct };
}
