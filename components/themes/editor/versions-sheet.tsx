"use client";

import { History, Loader2, RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { ActionError, useRollback, useVersions } from "@/lib/themes/queries";
import type { TemplateVersion } from "@/lib/themes/types";

const when = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

type Props = {
  open: boolean;
  onClose: () => void;
  templateId: string;
  pageName: string;
  canManage: boolean;
  /** Called after a version is restored, so the editor can load the restored draft. */
  onRestored: (templateId: string) => void;
  hasUnsavedChanges: boolean;
};

/** Publishing history of the page being edited. Restoring publishes the old version again as a new one. */
export function VersionsSheet({ open, onClose, templateId, pageName, canManage, onRestored, hasUnsavedChanges }: Props) {
  const versions = useVersions(open ? templateId : null);
  const rollback = useRollback();
  const [target, setTarget] = useState<TemplateVersion | null>(null);

  const restore = async () => {
    if (!target) return;
    try {
      await rollback.mutateAsync({ id: templateId, versionId: target.id });
      toast.success(`Version ${target.versionNumber} is live again`);
      setTarget(null);
      onRestored(templateId);
    } catch (error) {
      toast.error(error instanceof ActionError ? error.message : "Could not restore that version.");
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2"><History className="size-4" aria-hidden /> Version history</SheetTitle>
          <SheetDescription>Every time you publish {pageName}, a numbered copy is kept. Restoring one makes it live again; your products and orders are not affected.</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {versions.isLoading ? (
            <div className="space-y-2"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div>
          ) : versions.isError ? (
            <Alert variant="destructive"><AlertDescription>The history could not be loaded.</AlertDescription></Alert>
          ) : versions.data && versions.data.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nothing published yet. Publish your theme and its versions will be listed here.</p>
          ) : (
            <ol className="space-y-2">
              {versions.data?.map((v) => (
                <li key={v.id} className="flex items-center gap-3 rounded-md border bg-card p-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      Version {v.versionNumber}
                      {v.isLive ? <Badge variant="secondary">Live</Badge> : null}
                      {v.source === "rollback" ? <Badge variant="outline">Restored</Badge> : null}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{when.format(new Date(v.publishedAt))}{v.label ? ` · ${v.label}` : ""}</p>
                  </div>
                  {canManage && !v.isLive ? (
                    <Button size="sm" variant="outline" onClick={() => setTarget(v)}><RotateCcw aria-hidden /> Restore</Button>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </div>
      </SheetContent>

      <AlertDialog open={target !== null} onOpenChange={(o) => { if (!o) setTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore version {target?.versionNumber}?</AlertDialogTitle>
            <AlertDialogDescription>
              This page goes live with that version straight away, and your draft is reset to match.
              {hasUnsavedChanges ? " Your unsaved changes to this page will be replaced." : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rollback.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={rollback.isPending} onClick={() => void restore()}>
              {rollback.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null} Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
