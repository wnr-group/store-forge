"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { CircleAlert } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { deploymentFromTemplates } from "@/lib/themes/editor/deployment";
import { withAddedProducts, withCollectionEdits, withProductEdits, type AddedProduct, type CardCollectionEdit, type CardProductEdit } from "@/lib/themes/editor/product-edits";
import { CARD_PARTS, COLLECTION_CARD_PARTS, availableCardParts, cardKindOf, countOnByDefault, readCardParts, readCollectionCardParts, type CardPartKey } from "@/lib/templates/card-parts";
import { withPageContent } from "@/lib/storefront/pages";
import { isVirtualId, virtualKey } from "@/lib/themes/editor/virtual";
import { type ComponentNode, type TemplateDocument } from "@/lib/templates/document";
import { effectiveGalleryLayout, effectiveMediaPosition, type GalleryLayout, type MediaPosition } from "@/lib/templates/product-presentation";
import { createPresentationStore, entryFromDetail, hasPendingPublish, isEntryDirty, previewPresentation, productActions, putEntry, summarizeWaiting, type PresentationStore } from "@/lib/themes/editor/presentation-state";
import { createState, isDirty, type EditorDoc, type EditorState } from "@/lib/themes/editor/state";
import { useDraftChecks, usePresentationList, useTemplates } from "@/lib/themes/queries";
import { previewData, type PreviewMode } from "@/lib/themes/preview-data";
import { type PreviewStoreData, type ProductPreview, type TemplateSummary, type ThemeKind } from "@/lib/themes/types";
import { draftsToCheck } from "@/lib/themes/editor/draft-checks";
import { productLayoutState, publicationStatus, refetchTemplateStatesOnOpen } from "@/lib/themes/refresh";
import { PAGE_LABEL, type SaveState } from "@/lib/themes/editor/shell-logic";
import { useProductPreview } from "./hooks/use-product-preview";
import { useEditorNavigation } from "./hooks/use-editor-navigation";
import { usePublishFlow } from "./hooks/use-publish-flow";
import { useEditorEdits } from "./hooks/use-editor-edits";
import { useEditorHistory } from "./hooks/use-editor-history";
import { useEditorSave } from "./hooks/use-editor-save";
import { type ProductStatus } from "./product-status";
import { usePreviewTarget } from "./use-preview-target";
import { CollectionQuickEdit, type CardCollectionRef, type CollectionEditField } from "./collection-quick-edit";
import { ProductQuickEdit, type CardProductRef, type QuickEditField } from "./product-quick-edit";
import { DeploymentDialog } from "./deployment-dialog";
import { QuickCreate, type CreateKind } from "./quick-create";
import { VersionsSheet } from "./versions-sheet";
import { type CardTools } from "../selection-overlay";
import { ThemeFrame, type Device } from "../theme-frame";
import { EditorHeader, EditorBanners } from "./editor-header";
import { EditorLeftPanel } from "./editor-left-panel";
import { EditorPreviewPane } from "./editor-preview-pane";
import { StudioCapsProvider } from "./studio-context";
import { NO_FEATURES, type StudioFeatures } from "@/lib/templates/studio-features";
import { EditorSettingsAside } from "./editor-settings-aside";
import { usePreviewClock } from "./hooks/use-preview-clock";
import { DraftPreviewDialog } from "./preview-controls";
import { PublishDialog, EditorStatusBar } from "./editor-footer";

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
  /** Store Forge Studio is on for this store (from GET store/studio/status; false on any failure). Gates the display rules panel, badges and Preview as of. */
  studioEnabled?: boolean;
  /** Which gated Studio features are available for this store (from the same status answer). Absent means none. */
  studioFeatures?: StudioFeatures;
  /** The member holds the attest capability (needed to upload a badge image). */
  canAttest?: boolean;
};




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
  // The product being edited from its card (a dialog), and products already saved from a card, shown at once in the preview.
  const [editingProduct, setEditingProduct] = useState<{ product: CardProductRef; field: QuickEditField } | null>(null);
  const [productEdits, setProductEdits] = useState<Record<string, CardProductEdit>>({});
  // The same for a collection card: the collection being edited (a dialog) and collections already saved from a card.
  const [editingCollection, setEditingCollection] = useState<{ collection: CardCollectionRef; field: CollectionEditField } | null>(null);
  const [collectionEdits, setCollectionEdits] = useState<Record<string, CardCollectionEdit>>({});
  // Adding a product, a category or a collection from the editor (a dialog), and products added so far, listed at once in the preview.
  const [creating, setCreating] = useState<CreateKind | null>(null);
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
  // What the server round trip is doing; the visible status below is derived from this and the document state.
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [device, setDevice] = useState<Device>("desktop");
  const [leftTab, setLeftTab] = useState<"sections" | "theme" | "product">("sections");
  const [mobileTab, setMobileTab] = useState<"sections" | "preview" | "settings">("preview");
  const [previewing, setPreviewing] = useState(false);
  // "Preview as of": the instant the editor preview shows scheduled content at (editor only; Studio stores only).
  const { previewNow, setPreviewNow, nowMs } = usePreviewClock();

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
  const [presServerProblems, setPresServerProblems] = useState<Record<string, Record<string, string>>>({});
  const [presConflict, setPresConflict] = useState<string | null>(null);
  const presList = usePresentationList();
  // Undo and redo over every draft being edited (pages, shared parts and product settings). Not part of what is saved.

  const templates = useTemplates();

  const page = state.docs[state.pageId];
  const byKind = (kind: ThemeKind) => Object.values(state.docs).find((d) => d.kind === kind)?.templateId ?? null;
  const groupIds = { announcement: byKind("group_announcement"), header: byKind("group_header"), footer: byKind("group_footer") };
  const themeDocId = byKind("theme_settings");

  const { saveError, setServerProblems, retrySave, flush, flusher, allSaved, productsSaved, problems, presLocalProblems, hasLocalProblems, dirtyCount, status } = useEditorSave({
    tenantId: init.tenantId, state, stateRef, commit, presStore, presRef, setPresStore, setPresServerProblems, setPresConflict, saveState, setSaveState,
  });

  const canEdit = init.canManage && status !== "conflict";

  // ---- edits ---------------------------------------------------------------------------------------------------
  const edits = useEditorEdits({ state, stateRef, commit, setSaveState, setLeftTab, setMobileTab });
  const { edit, actions, adapter, cardContext, pickedCard } = edits;

  const toggleInspector = useCallback(() => setInspector((v) => !v), []);
  const historyApi = useEditorHistory({ state, presStore, commit, setPresStore, setSaveState, canEdit, toggleInspector });

  // ---- product preview and product settings ------------------------------------------------------------------
  const product = useProductPreview({
    init, stateRef, presRef, setPresStore, setPresServerProblems, presConflict, setPresConflict, setSaveState, setMobileTab, canEdit, flusher, hasLocalProblems, productsSaved,
  });
  const { previewProduct, presBusy, loadProduct, syncProductParam, firstProductSlug, refreshEntries } = product;

  // ---- pages, conflicts, restore -------------------------------------------------------------------------------
  const nav = useEditorNavigation({
    init, state, stateRef, presRef, commit, target, themeDocId, setLeftTab, previewProduct, loadProduct, firstProductSlug, syncProductParam, setServerProblems, setPresConflict, setSaveState, forgetDocsNow: historyApi.forgetDocsNow, flush,
  });
  const publishFlow = usePublishFlow({
    init, stateRef, presRef, commit, themeDocId, hasLocalProblems, allSaved, flusher, refreshEntries, setPresServerProblems, switchPage: nav.switchPage, setLeftTab, setMobileTab, loadProduct, loadDoc: nav.loadDoc, forgetDocsNow: historyApi.forgetDocsNow,
  });
  const { versionsOpen, setVersionsOpen, setPublishOpen, deploymentOpen, setDeploymentOpen, lastPublish, afterRestore } = publishFlow;

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
    previewNow: init.studioEnabled ? (previewNow ?? undefined) : undefined,
    resource: virtualPage ? (virtualPage === "search" ? { products: preview.store.products } : undefined) : page.kind === "product" ? (productResource ?? target.productResource) : page.kind === "collection" ? target.collectionResource : undefined,
  };

  return (
    <StudioCapsProvider value={{ features: init.studioFeatures ?? NO_FEATURES, canAttest: Boolean(init.canAttest) }}>
    <div className="sf-editor fixed inset-0 z-50 flex flex-col bg-background text-foreground" role="application" aria-label="Theme editor">
      <EditorHeader
        init={init} state={state} target={target} preview={preview} previewMode={previewMode} canEdit={canEdit} status={status} device={device} setDevice={setDevice}
        currentEntry={currentEntry} virtualPage={virtualPage} themeDocId={themeDocId} edit={edit} nav={nav} product={product} historyApi={historyApi} publishFlow={publishFlow}
        setLeftTab={setLeftTab} setMobileTab={setMobileTab} setPreviewing={setPreviewing}
      />

      <EditorBanners init={init} status={status} presConflict={presConflict} presStore={presStore} product={product} reloadAll={nav.reloadAll} />

      <div className="grid min-h-0 flex-1 lg:grid-cols-[320px_minmax(0,1fr)_320px] xl:grid-cols-[336px_minmax(0,1fr)_352px]">
        <EditorLeftPanel
          state={state} page={page} groupIds={groupIds} sectionCount={sectionCount} mobileTab={mobileTab} leftTab={leftTab} setLeftTab={setLeftTab} setMobileTab={setMobileTab}
          actions={actions} canEdit={canEdit} cardContext={cardContext} adapter={adapter} previewMode={previewMode} setPreviewMode={setPreviewMode}
          product={product} statusOfProduct={statusOfProduct} presList={presList} badgeNowMs={init.studioEnabled ? nowMs : null}
        />

        <EditorPreviewPane
          init={init} state={state} mobileTab={mobileTab} previewMode={previewMode} setPreviewMode={setPreviewMode} setCreating={setCreating} zoom={zoom} setZoom={setZoom}
          inspector={inspector} setInspector={setInspector} actions={actions} device={device} loadingPage={nav.loadingPage} frameDocument={frameDocument} frameProps={frameProps}
          onPreviewSelect={edits.onPreviewSelect} navigateHref={nav.navigateHref} onEditText={edits.onEditText} onEditBlocked={edits.onEditBlocked} labelFor={edits.labelFor}
          selectedSectionId={selectedSectionId} selectedBlockId={selectedBlockId} cardTools={cardTools} previewNow={previewNow} setPreviewNow={setPreviewNow}
        />
        <EditorSettingsAside
          init={init} state={state} page={page} mobileTab={mobileTab} leftTab={leftTab} previewMode={previewMode} themeDocId={themeDocId} canEdit={canEdit} problems={problems}
          device={device} layoutState={layoutState} currentEntry={currentEntry} inherited={inherited} productAct={productAct} productProblems={productProblems}
          statusOfProduct={statusOfProduct} product={product} edits={edits} editableSelection={editableSelection} nowMs={nowMs}
        />
      </div>

      {saveError && status === "error" ? (
        <div role="alert" className="flex items-center justify-between gap-3 border-t bg-destructive/10 px-4 py-2 text-sm text-destructive">
          <span className="flex items-center gap-2"><CircleAlert className="size-4" aria-hidden /> {saveError}</span>
          <Button size="sm" variant="outline" onClick={retrySave}>Try again</Button>
        </div>
      ) : null}

      <DraftPreviewDialog previewing={previewing} setPreviewing={setPreviewing} device={device} setDevice={setDevice} frameDocument={frameDocument} frameProps={frameProps} />

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

      <PublishDialog
        publishFlow={publishFlow}
        waitingPages={waitingPages} waitingProducts={waitingProducts} presStore={presStore} dirtyCount={dirtyCount} unverifiedProducts={unverifiedProducts} checkingPages={checkingPages}
        draftChecks={draftChecks} presList={presList}
      />

      <EditorStatusBar
        publication={publication} status={status} dirtyCount={dirtyCount} liveSince={liveSince} themeName={init.themeName} mobileTab={mobileTab} setMobileTab={setMobileTab}
        setDeploymentOpen={publishFlow.setDeploymentOpen}
      />
    </div>
    </StudioCapsProvider>
  );
}
