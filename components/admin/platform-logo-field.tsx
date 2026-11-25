"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ImageUp, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { removePlatformLogoAction, requestPlatformLogoUploadAction, setPlatformLogoAction } from "@/app/(admin)/admin/actions";
import { putWithProgress } from "@/components/products/image-uploader";
import { SectionCard } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import { PLATFORM_LOGO_MAX_BYTES, PLATFORM_LOGO_TYPES } from "@/lib/validations/admin-platform";

type Props = { logoUrl: string | null; canEdit: boolean };

/**
 * The platform logo. Picking a file uploads it straight to Storage (never through the app server), then the API checks the file and makes
 * it the logo everywhere: sign-in page, public site and both dashboards. Super admins only; the API and Storage refuse anyone else.
 */
export function PlatformLogoField({ logoUrl, canEdit }: Props) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const choose = async (file: File | undefined) => {
    if (input.current) input.current.value = "";
    if (!file) return;
    setError(null);
    if (!(PLATFORM_LOGO_TYPES as readonly string[]).includes(file.type)) return setError("The logo must be a JPEG, PNG or WebP image.");
    if (file.size > PLATFORM_LOGO_MAX_BYTES) return setError("The logo must be 2 MB or smaller.");

    setBusy("upload");
    setProgress(0);
    try {
      const target = await requestPlatformLogoUploadAction({ type: file.type, size: file.size });
      if (!target.ok || !target.data) return setError(target.ok ? "Could not start the upload." : target.error);
      await putWithProgress(target.data.signedUrl, file, setProgress);
      const saved = await setPlatformLogoAction(target.data.path);
      if (!saved.ok) return setError(saved.error);
      toast.success("Logo updated");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setError(null);
    setBusy("remove");
    try {
      const res = await removePlatformLogoAction();
      if (!res.ok) return setError(res.error);
      toast.success("Logo removed");
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  return (
    <SectionCard title="Logo" description="Shown beside the platform name on the sign-in page, the public site and the dashboards. JPEG, PNG or WebP, up to 2 MB.">
      <div className="flex flex-wrap items-center gap-4">
        <div className="grid h-20 w-40 place-items-center overflow-hidden rounded-lg border bg-muted/40 p-2">
          {logoUrl ? (
            <Image src={logoUrl} alt="Current platform logo" width={160} height={64} unoptimized className="max-h-16 w-auto object-contain" />
          ) : (
            <Image src="/logo.png" alt="Built-in logo" width={256} height={217} className="max-h-14 w-auto object-contain" />
          )}
        </div>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{logoUrl ? "A custom logo is in use." : "The built-in logo is in use."}</p>
          {canEdit ? (
            <div className="flex flex-wrap items-center gap-2">
              <input ref={input} type="file" accept={PLATFORM_LOGO_TYPES.join(",")} className="sr-only" aria-label="Choose a logo file" onChange={(e) => void choose(e.target.files?.[0])} />
              <Button type="button" variant="outline" disabled={busy !== null} onClick={() => input.current?.click()}>
                {busy === "upload" ? <Loader2 className="animate-spin" aria-hidden /> : <ImageUp aria-hidden />}
                {busy === "upload" ? `Uploading… ${progress}%` : logoUrl ? "Replace logo" : "Upload logo"}
              </Button>
              {logoUrl ? (
                <Button type="button" variant="ghost" disabled={busy !== null} onClick={() => void remove()}>
                  {busy === "remove" ? <Loader2 className="animate-spin" aria-hidden /> : <Trash2 aria-hidden />} Remove
                </Button>
              ) : null}
            </div>
          ) : null}
          {error ? <p role="alert" className="text-sm text-error">{error}</p> : null}
        </div>
      </div>
    </SectionCard>
  );
}
