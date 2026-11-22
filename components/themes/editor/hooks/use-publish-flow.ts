"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { toast } from "sonner";
import { unavailableIssuesOf } from "@/lib/templates/component-checks";
import { t } from "@/lib/i18n/messages";
import { ActionError, usePublishTheme } from "@/lib/themes/queries";
import { deploymentFromResult, type Deployment } from "@/lib/themes/editor/deployment";
import { saveFailureMessage, type FlushResult, type createFlusher } from "@/lib/themes/editor/flusher";
import { publishedMessage, splitProductFieldErrors, type PresentationStore } from "@/lib/themes/editor/presentation-state";
import type { EditorState } from "@/lib/themes/editor/state";
import { rebuildVirtualPages } from "@/lib/themes/editor/virtual";
import { refreshTemplateStates } from "@/lib/themes/refresh";
import type { EditorInit } from "../editor-shell";
import type { ProductTarget } from "./use-product-preview";

type Args = {
  init: EditorInit;
  stateRef: MutableRefObject<EditorState>;
  presRef: MutableRefObject<PresentationStore>;
  commit: (fn: (s: EditorState) => EditorState) => EditorState;
  themeDocId: string | null;
  hasLocalProblems: boolean;
  allSaved: () => boolean;
  flusher: ReturnType<typeof createFlusher>;
  refreshEntries: () => Promise<void>;
  setPresServerProblems: Dispatch<SetStateAction<Record<string, Record<string, string>>>>;
  switchPage: (id: string) => Promise<void>;
  setLeftTab: Dispatch<SetStateAction<"sections" | "theme" | "product">>;
  setMobileTab: Dispatch<SetStateAction<"sections" | "preview" | "settings">>;
  loadProduct: (target: ProductTarget, name?: string | null) => Promise<void>;
  loadDoc: (id: string) => Promise<boolean>;
  forgetDocsNow: (ids: readonly string[] | "all") => void;
};

/** Publishing the whole theme (with its dialogs) and the version history that restores pages. */
export function usePublishFlow({ init, stateRef, presRef, commit, themeDocId, hasLocalProblems, allSaved, flusher, refreshEntries, setPresServerProblems, switchPage, setLeftTab, setMobileTab, loadProduct, loadDoc, forgetDocsNow }: Args) {
  const queryClient = useQueryClient();
  const publish = usePublishTheme();
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  // True from the click on Publish until it has finished, including the time spent waiting for a save in progress.
  const [publishing, setPublishing] = useState(false);
  // The deployment dialog: opened by a finished publish ("publish", showing what just went live) or from the status bar ("live").
  const [deploymentOpen, setDeploymentOpen] = useState<"publish" | "live" | null>(null);
  const [lastPublish, setLastPublish] = useState<Deployment | null>(null);

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
    // A component that is not available for this store cannot be published (the `component.unavailable` rule; the API checks it too).
    const blocked = Object.values(stateRef.current.docs).flatMap((d) => unavailableIssuesOf(d.document, init.studioFeatures));
    if (blocked.length > 0) {
      setPublishOpen(false);
      const names = [...new Set(blocked.map((b) => b.componentType))].join(", ");
      toast.error(t("readiness.component.unavailable", { name: names }));
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

  return { publish, versionsOpen, setVersionsOpen, publishOpen, setPublishOpen, publishing, deploymentOpen, setDeploymentOpen, lastPublish, afterRestore, doPublish };
}
