"use client";

import { Copy, ExternalLink, Palette } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ROUTES } from "@/config/app";
import type { TemplateDocument } from "@/lib/templates/document";
import { LOOK_LABELS, lookThemeName, type LookId } from "@/lib/templates/looks";
import { deploymentFromTemplates, pendingFromTemplates, timeAgo } from "@/lib/themes/editor/deployment";
import { INDUSTRY_LABELS, type PreviewStoreData, type TemplateSummary, type ThemeSummary } from "@/lib/themes/types";
import { cn } from "@/lib/utils";
import { PreviewLoader, useImagesReady } from "./preview-loader";
import { ThemeFrame } from "./theme-frame";

const exact = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

/** The design shoppers get right now: the published home page with its theme settings and shared parts, as the storefront renders it. */
export type DeployedDesign = {
  document: Record<string, unknown>;
  theme: Record<string, unknown> | null;
  groups: { header?: Record<string, unknown> | null; footer?: Record<string, unknown> | null; announcement?: Record<string, unknown> | null };
  /** The published version of the home page. */
  versionNumber: number;
  /** The look the published design is drawn in (it says which theme was published; the applied theme is only the draft). */
  look: LookId;
};

/**
 * Whether the store's design is live, in the style of a deployment page: a preview of the site as it is deployed (the published
 * design, never the draft), which theme it is, the store's address (to open or copy), when it was last published, which pages are
 * live at which version, and which pages have changes that are not published yet. Read from the publication state of each page, so
 * it is true whoever published and from wherever.
 */
export function PublishStatus({
  templates,
  loading,
  failed,
  onRetry,
  host,
  url,
  canManage,
  deployed,
  theme,
  appliedVersion,
  data,
}: {
  templates: TemplateSummary[] | undefined;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  host: string;
  url: string;
  canManage: boolean;
  /** The published design, or null when nothing is published (or it could not be read). */
  deployed: DeployedDesign | null;
  /** The theme the store uses, and the version of it that was applied. */
  theme: ThemeSummary | null;
  appliedVersion: number | null;
  data: PreviewStoreData;
}) {
  const doc = deployed?.document as unknown as TemplateDocument | undefined;
  const [imagesRef, imagesReady] = useImagesReady(Boolean(doc));

  if (loading && !templates) return <Skeleton className="h-52 w-full rounded-lg" />;
  if (failed && !templates) {
    return (
      <Alert variant="destructive">
        <AlertDescription className="flex items-center justify-between gap-3">
          The publish status could not be loaded.
          <Button size="sm" variant="outline" onClick={onRetry}>Try again</Button>
        </AlertDescription>
      </Alert>
    );
  }
  const list = templates ?? [];
  // No theme applied yet: nothing to publish, so no status to show.
  if (list.length === 0) return null;

  const live = deploymentFromTemplates(list);
  const pending = pendingFromTemplates(list);
  // The theme that is deployed comes from the published design. The theme the store has applied is the draft being customised, which
  // may be a different one that is not published yet.
  const deployedName = live && deployed ? (lookThemeName(deployed.look) ?? "Standard theme") : null;
  const draftIsDifferent = Boolean(theme && (!deployedName || lookThemeName(deployed!.look) === null ? !live : theme.name.toLowerCase() !== deployedName.toLowerCase()));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy the link.");
    }
  };

  return (
    <section aria-labelledby="publish-status" className="rounded-lg border bg-card">
      <div className="flex flex-col gap-4 p-4 md:flex-row md:gap-5">
        {/* The deployment preview: the site as shoppers get it now. */}
        <div className="w-full shrink-0 md:w-72">
          <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
            <div className="flex items-center gap-2 border-b bg-muted/60 px-2.5 py-1.5">
              <span className="flex gap-1" aria-hidden>
                <span className="size-1.5 rounded-full bg-red-400/70" /><span className="size-1.5 rounded-full bg-amber-400/70" /><span className="size-1.5 rounded-full bg-emerald-400/70" />
              </span>
              <span className="min-w-0 flex-1 truncate rounded bg-background px-2 py-0.5 text-center font-mono text-[10px] text-muted-foreground">{host}</span>
            </div>
            <div className="relative h-40 overflow-hidden bg-white">
              {live && deployed && doc ? (
                <>
                  <div aria-hidden inert ref={imagesRef} className="pointer-events-none">
                    <ThemeFrame document={doc} theme={deployed.theme} groups={{ header: (deployed.groups.header as unknown as TemplateDocument) ?? null, footer: (deployed.groups.footer as unknown as TemplateDocument) ?? null, announcement: (deployed.groups.announcement as unknown as TemplateDocument) ?? null }} data={data} cropHeight={160} />
                  </div>
                  <PreviewLoader ready={imagesReady} />
                </>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-1.5 px-4 text-center text-xs text-muted-foreground">
                  <Palette className="size-5" aria-hidden />
                  {live ? "Preview unavailable" : "Nothing is deployed yet"}
                </div>
              )}
            </div>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">{live ? "What shoppers see now" : "Publish to deploy your theme"}</p>
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="publish-status" className="text-sm font-semibold">Live store</h2>
                {live ? (
                  <Badge variant="outline" className="gap-1.5 border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                    <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden /> Live
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1.5"><span className="size-1.5 rounded-full bg-muted-foreground/60" aria-hidden /> Not published</Badge>
                )}
                {live && pending.length > 0 ? (
                  <Badge variant="secondary" className="gap-1.5"><span className="size-1.5 rounded-full bg-amber-500" aria-hidden /> {pending.length} {pending.length === 1 ? "change" : "changes"} not published</Badge>
                ) : null}
              </div>
              <a href={url} target="_blank" rel="noopener noreferrer" className="block truncate font-mono text-[13px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" title={url}>{host}</a>
              <p className="text-sm text-muted-foreground">
                {live
                  ? pending.length > 0
                    ? "Shoppers see the last published version. Your newer changes are saved as a draft."
                    : "Everything you designed is live. Shoppers see it now."
                  : "Your theme is a draft. Shoppers see your store as it was before, until you publish."}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {live ? (
                <>
                  <Button type="button" variant="outline" size="sm" onClick={() => void copy()}><Copy aria-hidden /> Copy link</Button>
                  <a href={url} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>Visit store <ExternalLink aria-hidden /></a>
                </>
              ) : null}
              {canManage ? (
                <Link href={ROUTES.themeEditor} className={cn(buttonVariants({ size: "sm" }))}>
                  <Palette aria-hidden /> {pending.length > 0 ? "Review and publish" : "Open editor"}
                </Link>
              ) : null}
            </div>
          </div>

          <dl className="grid gap-4 border-t pt-3.5 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Theme deployed</dt>
              <dd className="mt-1">
                {deployedName && deployed ? (
                  <>
                    <span className="font-medium">{deployedName}</span>
                    <span className="block text-xs text-muted-foreground">{LOOK_LABELS[deployed.look].split(" (")[0]} look · home page v{deployed.versionNumber}</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">None yet. Your store shows its built-in design.</span>
                )}
              </dd>
            </div>
            {theme && draftIsDifferent ? (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Draft theme (not published)</dt>
                <dd className="mt-1">
                  <span className="inline-flex items-center gap-1.5 font-medium"><span className="size-1.5 rounded-full bg-amber-500" aria-hidden /> {theme.name}</span>
                  <span className="block text-xs text-muted-foreground">{INDUSTRY_LABELS[theme.industry]}{appliedVersion ? ` · theme version ${appliedVersion}` : ""} · publish to make it live</span>
                </dd>
              </div>
            ) : null}
            {live ? (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Last published</dt>
                <dd className="mt-1">
                  {timeAgo(live.publishedAt)}
                  <span className="block text-xs text-muted-foreground">{exact.format(new Date(live.publishedAt))}</span>
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      </div>
    </section>
  );
}
