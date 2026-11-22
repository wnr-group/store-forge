"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Eye, Layers, Loader2, Rocket, SlidersHorizontal } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { timeAgo } from "@/lib/themes/editor/deployment";
import { summarizeWaiting, type PresentationStore } from "@/lib/themes/editor/presentation-state";
import { useDraftChecks, usePresentationList } from "@/lib/themes/queries";
import { type ThemeKind } from "@/lib/themes/types";
import { cn } from "@/lib/utils";
import { publicationStatus, refetchTemplateStatesOnOpen } from "@/lib/themes/refresh";
import { PAGE_LABEL, type SaveStatus } from "@/lib/themes/editor/shell-logic";
import { PublishSummary, SaveIndicator } from "./editor-parts";
import { usePublishFlow } from "./hooks/use-publish-flow";
import { type Dispatch, type SetStateAction, useEffect, useState } from "react";
import { ReadinessPanel } from "./readiness-panel";
import { getReadinessReportAction } from "@/app/(dashboard)/dashboard/templates/actions";
import type { ReadinessReportApi } from "@/lib/api/endpoints/studio-api";

/** The "Publish your theme?" confirmation, with what is about to go live. */
export function PublishDialog({ publishFlow, waitingPages, waitingProducts, presStore, dirtyCount, unverifiedProducts, checkingPages, draftChecks, presList }: {
  publishFlow: ReturnType<typeof usePublishFlow>;
  waitingPages: { kind: ThemeKind; name: string }[];
  waitingProducts: ReturnType<typeof summarizeWaiting>["waiting"];
  presStore: PresentationStore;
  dirtyCount: number;
  unverifiedProducts: ReturnType<typeof summarizeWaiting>["unverified"];
  checkingPages: boolean;
  draftChecks: ReturnType<typeof useDraftChecks>;
  presList: ReturnType<typeof usePresentationList>;
}) {
  const { publishOpen, setPublishOpen, publish, publishing, doPublish } = publishFlow;
  const [readiness, setReadiness] = useState<ReadinessReportApi | null>(null);
  const [loadingReadiness, setLoadingReadiness] = useState(false);
  const [acknowledgedWarningKeys, setAcknowledgedWarningKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!publishOpen) return;
    let active = true;
    setLoadingReadiness(true);
    getReadinessReportAction()
      .then((res) => {
        if (active && res && "data" in res && res.data) {
          setReadiness(res.data);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingReadiness(false);
      });
    return () => {
      active = false;
    };
  }, [publishOpen]);

  const toggleAcknowledgeWarning = (key: string) => {
    setAcknowledgedWarningKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const hasBlockers = (readiness?.counts.blockers ?? 0) > 0;
  const unackWarnings = (readiness?.issues ?? []).filter(
    (i) => i.severity === "WARNING" && !acknowledgedWarningKeys.has(i.key),
  ).length;
  const isBlocked = hasBlockers || unackWarnings > 0;

  return (
      <AlertDialog open={publishOpen} onOpenChange={setPublishOpen}>
        <AlertDialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Publish your theme?</AlertDialogTitle>
            <AlertDialogDescription>
              Your latest changes go live on your store now: every page, the header, the footer, your theme settings and any product settings you have saved. Each page is saved as a numbered version you can restore later. Product details, customers and orders are not affected.
            </AlertDialogDescription>
            <PublishSummary
              pages={waitingPages.map((t) => PAGE_LABEL[t.kind] ?? t.name)}
              products={[...waitingProducts].map((id) => presStore.entries[id]?.name ?? null)}
              unsaved={dirtyCount}
              unverified={unverifiedProducts.size}
              checking={draftChecks.checking}
              checkingPages={checkingPages}
              skipped={draftChecks.skipped}
              truncated={Boolean(presList.data?.truncated)}
              onRetry={draftChecks.retry}
            />
            <div className="pt-2">
              <ReadinessPanel
                report={readiness}
                loading={loadingReadiness}
                acknowledgedWarningKeys={acknowledgedWarningKeys}
                onToggleAcknowledgeWarning={toggleAcknowledgeWarning}
              />
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={publish.isPending || publishing}>Not yet</AlertDialogCancel>
            <AlertDialogAction
              disabled={publish.isPending || publishing || isBlocked}
              onClick={() => void doPublish()}
            >
              {publish.isPending || publishing ? <Loader2 className="animate-spin" aria-hidden /> : <Rocket aria-hidden />} Publish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
  );
}

/** The bottom bar: save status, publication badge, and the tabs that switch panels on a phone. */
export function EditorStatusBar({ publication, status, dirtyCount, liveSince, themeName, mobileTab, setMobileTab, setDeploymentOpen }: {
  publication: ReturnType<typeof publicationStatus>;
  status: SaveStatus;
  dirtyCount: number;
  liveSince: string | null;
  themeName: string | null;
  mobileTab: "sections" | "preview" | "settings";
  setMobileTab: Dispatch<SetStateAction<"sections" | "preview" | "settings">>;
  setDeploymentOpen: (open: "publish" | "live" | null) => void;
}) {
  const queryClient = useQueryClient();
  return (
    <>
      <p className="sr-only" aria-live="polite">{publication === "unpublished" ? "You have changes that are not published." : publication === "checking" ? "Checking publication status." : "Everything is published."}</p>
      <footer className="flex h-8 shrink-0 items-center justify-between gap-3 border-t bg-card px-3 text-xs text-muted-foreground sm:px-4">
        <SaveIndicator status={status} dirty={dirtyCount} />
        <span className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setDeploymentOpen("live");
              void refetchTemplateStatesOnOpen(queryClient);
            }}
            title="See what is live on your store"
            className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {publication === "unpublished" ? (
              <Badge variant="secondary" className="cursor-pointer gap-1.5"><span className="size-1.5 rounded-full bg-amber-500" aria-hidden /> Changes not published</Badge>
            ) : publication === "checking" ? (
              <Badge variant="outline" className="cursor-pointer"><Loader2 className="size-3 animate-spin" aria-hidden /> Checking publication status…</Badge>
            ) : (
              <Badge variant="outline" className="cursor-pointer gap-1.5"><span className="size-1.5 rounded-full bg-emerald-500" aria-hidden /> Live{liveSince ? ` · ${timeAgo(liveSince)}` : ""}</Badge>
            )}
          </button>
          <span className="hidden font-mono text-[11px] xl:inline">{themeName ?? "Your storefront"}</span>
        </span>
      </footer>
      <nav className="grid shrink-0 grid-cols-3 gap-1 border-t bg-card p-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] lg:hidden" role="tablist" aria-label="Editor panels">
        {([["sections", "Sections", Layers], ["preview", "Preview", Eye], ["settings", "Settings", SlidersHorizontal]] as const).map(([t, label, Icon]) => (
          <button key={t} type="button" role="tab" aria-selected={mobileTab === t} onClick={() => setMobileTab(t)} className={cn("flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-[11px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring", mobileTab === t ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}>
            <Icon className="size-[18px]" aria-hidden />
            {label}
          </button>
        ))}
      </nav>
    </>
  );
}
