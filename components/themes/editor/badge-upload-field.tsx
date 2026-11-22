"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { attestBadgeUploadAction, finalizeBadgeUploadAction, getBadgeWordingAction, requestBadgeUploadAction } from "@/app/(dashboard)/dashboard/templates/badge-actions";
import { putWithProgress } from "@/components/products/image-uploader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t } from "@/lib/i18n/messages";
import { BADGE_UPLOAD_TYPES, badgeFileProblem, type BadgeWording } from "@/lib/studio/badge-upload";
import { useStudioCaps } from "./studio-context";

type Marks = { markAssetId: string; markPath: string; markAlt: string };

/**
 * The image part of an uploaded trust badge. Shown only when the member can attest AND the badge upload feature is available;
 * otherwise a plain notice. Choosing a file opens a dialog with the approved wording, word for word; only after the member confirms
 * is the file uploaded, finalized and the attestation recorded. The badge keeps the asset id, its path and the alt text, nothing else.
 */
export function BadgeUploadField({ marks, disabled, errors, onChange }: { marks: Marks; disabled: boolean; errors: Partial<Record<keyof Marks, string>>; onChange: (patch: Partial<Marks>) => void }) {
  const { features, canAttest } = useStudioCaps();
  const available = features.badge_upload === "available";
  const [file, setFile] = useState<File | null>(null);
  const [wording, setWording] = useState<BadgeWording | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const alt = (
    <div className="space-y-1.5">
      <Label htmlFor="badge-alt">Image description (required)</Label>
      <Input id="badge-alt" value={marks.markAlt} maxLength={125} disabled={disabled} aria-invalid={Boolean(errors.markAlt)} onChange={(e) => onChange({ markAlt: e.target.value })} />
      {errors.markAlt ? <p className="text-xs text-destructive">{errors.markAlt}</p> : null}
    </div>
  );

  if (!available || !canAttest) {
    return (
      <div className="space-y-3">
        <p className="rounded-md bg-muted/60 px-3 py-2 text-sm text-muted-foreground">{!available ? t("trustBadges.upload.unavailable") : t("trustBadges.upload.needsAttest")}</p>
        {marks.markPath ? alt : null}
      </div>
    );
  }

  const pick = async (f: File | null) => {
    setProblem(null);
    setConfirmed(false);
    if (!f) return;
    const bad = badgeFileProblem(f);
    if (bad) {
      setProblem(bad);
      return;
    }
    setFile(f);
    setWording(null);
    setOpen(true);
    const result = await getBadgeWordingAction();
    if (result.ok && result.data) setWording(result.data);
    else setProblem(result.ok ? t("common.error.generic") : result.error);
  };

  const close = () => {
    if (busy) return;
    setOpen(false);
    setFile(null);
    setConfirmed(false);
  };

  const confirm = async () => {
    if (!file || !wording) return;
    setBusy(true);
    setProblem(null);
    try {
      const requested = await requestBadgeUploadAction({ mimeType: file.type, sizeBytes: file.size, filename: file.name });
      if (!requested.ok || !requested.data) throw new Error(requested.ok ? t("common.error.generic") : requested.error);
      await putWithProgress(requested.data.uploadUrl, file, () => {});
      const finalized = await finalizeBadgeUploadAction({ assetId: requested.data.assetId, path: requested.data.path });
      if (!finalized.ok || !finalized.data) throw new Error(finalized.ok ? t("common.error.generic") : finalized.error);
      const attested = await attestBadgeUploadAction({ wordingVersion: wording.version, assetId: finalized.data.assetId });
      if (!attested.ok) throw new Error(attested.error);
      onChange({ markAssetId: finalized.data.assetId, markPath: finalized.data.path });
      setOpen(false);
      setFile(null);
      setConfirmed(false);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : t("common.error.generic"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="badge-file">{t("trustBadges.upload.title")}</Label>
        <Input id="badge-file" type="file" accept={BADGE_UPLOAD_TYPES.join(",")} disabled={disabled || busy} onChange={(e) => { void pick(e.target.files?.[0] ?? null); e.target.value = ""; }} />
        {marks.markPath ? <p className="text-xs text-muted-foreground">An image is attached to this badge.</p> : null}
        {errors.markAssetId || errors.markPath ? <p className="text-xs text-destructive">{errors.markAssetId ?? errors.markPath}</p> : null}
        {problem && !open ? <p role="alert" className="text-xs text-destructive">{problem}</p> : null}
      </div>
      {alt}
      <Dialog open={open} onOpenChange={(o) => { if (!o) close(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("trustBadges.upload.title")}</DialogTitle>
            <DialogDescription>{t("trustBadges.upload.attestIntro")}</DialogDescription>
          </DialogHeader>
          {wording ? (
            <blockquote className="max-h-56 overflow-y-auto rounded-md border bg-muted/40 p-3 text-sm whitespace-pre-wrap" data-testid="badge-attestation-wording">{wording.text}</blockquote>
          ) : problem ? null : (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden /> {t("common.loading")}</p>
          )}
          {problem ? <p role="alert" className="text-sm text-destructive">{problem}</p> : null}
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={confirmed} disabled={!wording || busy} onCheckedChange={(v) => setConfirmed(v === true)} />
            <span>{t("trustBadges.upload.confirm")}</span>
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={busy}>{t("common.cancel")}</Button>
            <Button onClick={() => void confirm()} disabled={!wording || !confirmed || busy}>{busy ? <Loader2 className="animate-spin" aria-hidden /> : null} Upload</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
