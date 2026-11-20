"use client";

import { AlertTriangle, Check, Copy, ExternalLink, History, Rocket } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { timeAgo, type Deployment } from "@/lib/themes/editor/deployment";
import { cn } from "@/lib/utils";

const exact = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

/**
 * What is live on the store, in the style of a deployment page: it opens by itself when a publish finishes, and from the status bar
 * at any time. It shows that the store is live, its address (to open or copy), a preview of the page, when it went live and which
 * pages went live at which version, and says plainly when there are changes that are not published yet.
 */
export function DeploymentDialog({
  open,
  onClose,
  deployment,
  host,
  url,
  preview,
  pendingChanges,
  canPublish,
  onPublish,
  onHistory,
}: {
  open: boolean;
  onClose: () => void;
  deployment: Deployment | null;
  /** The store's address for display ("urban-nest-zqkod2.store-forge.com"). */
  host: string;
  /** The address to open; where the host is not known the store's path on this site. */
  url: string;
  /** A picture of the page as it is live (the preview frame), shown in a browser-style card. */
  preview: React.ReactNode;
  /** True while the editor holds changes that are not published. */
  pendingChanges: boolean;
  canPublish: boolean;
  onPublish: () => void;
  onHistory: () => void;
}) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy the link.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            {deployment ? (deployment.source === "publish" ? "Published to your store" : "Your live store") : "Nothing published yet"}
            {deployment ? (
              <Badge variant="outline" className="gap-1.5 border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden /> Live
              </Badge>
            ) : null}
          </DialogTitle>
          <DialogDescription>
            {deployment
              ? deployment.source === "publish"
                ? "Your changes are live. Shoppers see them now."
                : "This is what shoppers see right now."
              : "Publish your theme and it goes live here, with its address and a preview."}
          </DialogDescription>
        </DialogHeader>

        {deployment ? (
          <div className="grid gap-5 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
              <div className="flex items-center gap-2 border-b bg-muted/60 px-3 py-2">
                <span className="flex gap-1" aria-hidden>
                  <span className="size-2 rounded-full bg-red-400/70" /><span className="size-2 rounded-full bg-amber-400/70" /><span className="size-2 rounded-full bg-emerald-400/70" />
                </span>
                <span className="min-w-0 flex-1 truncate rounded-md bg-background px-2 py-0.5 text-center font-mono text-[11px] text-muted-foreground">{host}</span>
              </div>
              <div className="pointer-events-none max-h-72 overflow-hidden bg-white" aria-label="Preview of your store" role="img">
                {preview}
              </div>
            </div>

            <dl className="space-y-3.5 text-sm">
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Domain</dt>
                <dd className="mt-1 flex items-center gap-1.5">
                  <a href={url} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate font-mono text-[13px] font-medium underline-offset-2 hover:underline" title={url}>{host}</a>
                  <Button type="button" variant="ghost" size="icon-xs" onClick={() => void copy()} aria-label="Copy the store link" title="Copy link"><Copy aria-hidden /></Button>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Status</dt>
                <dd className="mt-1 flex items-center gap-1.5 font-medium"><Check className="size-4 text-emerald-600" aria-hidden /> Ready</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Published</dt>
                <dd className="mt-1">
                  {timeAgo(deployment.publishedAt)}
                  <span className="block text-xs text-muted-foreground">{exact.format(new Date(deployment.publishedAt))}</span>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">{deployment.source === "publish" ? "Went live" : "Live pages"}</dt>
                <dd className="mt-1">
                  <ul className="space-y-1">
                    {deployment.pages.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-3">
                        <span className="truncate">{p.name}</span>
                        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">v{p.version}</span>
                      </li>
                    ))}
                    {deployment.products > 0 ? <li className="text-muted-foreground">{deployment.products} {deployment.products === 1 ? "product" : "products"} with their own settings</li> : null}
                  </ul>
                </dd>
              </div>
            </dl>
          </div>
        ) : null}

        {pendingChanges ? (
          <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm">
            <span className="flex items-center gap-2"><AlertTriangle className="size-4 shrink-0 text-amber-600" aria-hidden /> You have changes that are not published. Shoppers do not see them yet.</span>
            {canPublish ? <Button size="sm" onClick={onPublish}><Rocket aria-hidden /> Review and publish</Button> : null}
          </div>
        ) : null}

        <DialogFooter className="sm:justify-between">
          <Button type="button" variant="ghost" onClick={onHistory}><History aria-hidden /> Version history</Button>
          <span className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={() => void copy()}><Copy aria-hidden /> Copy link</Button>
            <a href={url} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: "default" }), "justify-center")}>
              Visit store <ExternalLink aria-hidden />
            </a>
          </span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
