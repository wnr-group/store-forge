"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { toast } from "sonner";
import { getTemplateAction } from "@/app/(dashboard)/dashboard/templates/actions";
import { PREVIEW_OPEN_EVENT } from "@/components/storefront/cart/use-quick-add";
import { ROUTES } from "@/config/app";
import { routeForHref } from "@/lib/storefront/pages";
import { dirtyEntries, type PresentationStore } from "@/lib/themes/editor/presentation-state";
import type { SaveState } from "@/lib/themes/editor/shell-logic";
import { dirtyDocs, replaceDoc, type EditorState } from "@/lib/themes/editor/state";
import { isVirtualId, openVirtualPage, rebuildVirtualPages, virtualId, virtualKey } from "@/lib/themes/editor/virtual";
import type { ThemeKind } from "@/lib/themes/types";
import type { EditorInit } from "../editor-shell";
import type { TargetKind, usePreviewTarget } from "../use-preview-target";
import type { ProductTarget, PreviewProductState } from "./use-product-preview";

export type TrailStep = { pageId: string; ref?: { kind: TargetKind; slug: string } };

type Args = {
  init: EditorInit;
  state: EditorState;
  stateRef: MutableRefObject<EditorState>;
  presRef: MutableRefObject<PresentationStore>;
  commit: (fn: (s: EditorState) => EditorState) => EditorState;
  target: ReturnType<typeof usePreviewTarget>;
  themeDocId: string | null;
  setLeftTab: Dispatch<SetStateAction<"sections" | "theme" | "product">>;
  previewProduct: PreviewProductState;
  loadProduct: (target: ProductTarget, name?: string | null) => Promise<void>;
  firstProductSlug: string | undefined;
  syncProductParam: (id: string | null) => void;
  setServerProblems: Dispatch<SetStateAction<Record<string, Record<string, string>>>>;
  setPresConflict: Dispatch<SetStateAction<string | null>>;
  setSaveState: Dispatch<SetStateAction<SaveState>>;
  forgetDocsNow: (ids: readonly string[] | "all") => void;
  flush: () => Promise<boolean>;
};

/** Moving around the editor: switching pages, following links in the preview, Back, reloading after a conflict, and leaving. */
export function useEditorNavigation({ init, state, stateRef, presRef, commit, target, themeDocId, setLeftTab, previewProduct, loadProduct, firstProductSlug, syncProductParam, setServerProblems, setPresConflict, setSaveState, forgetDocsNow, flush }: Args) {
  const router = useRouter();
  const [trail, setTrail] = useState<TrailStep[]>([]);
  const [loadingPage, setLoadingPage] = useState(false);

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

  const leave = async () => {
    if ((dirtyDocs(stateRef.current).length > 0 || dirtyEntries(presRef.current).length > 0) && !(await flush()) && !window.confirm("Some changes could not be saved. Leave anyway?")) return;
    router.push(ROUTES.templates);
  };

  return { trail, loadingPage, loadDoc, switchPage, goTo, goBack, navigateHref, reloadAll, leave };
}
