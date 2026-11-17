"use client";

import { useRef, useState } from "react";
import { Loader2, Trash2, TriangleAlert, Video } from "lucide-react";
import { requestUploadsAction } from "@/app/(dashboard)/dashboard/uploads/actions";
import { putWithProgress } from "@/components/products/image-uploader";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { imageRawPath, publicImageUrl } from "@/lib/storage/paths";
import type { SettingDescriptor } from "@/lib/templates/engine/descriptors";
import { VIDEO_MAX_BYTES, VIDEO_TYPES } from "@/lib/validations/catalog";

type Props = {
  descriptor: SettingDescriptor;
  value: unknown;
  disabled?: boolean;
  error?: string;
  onChange: (value: unknown) => void;
};

/** Where a stored video value plays from: a theme file (`{ asset }`) or one in the store's own folder (`{ path }`). */
export function videoUrlOf(value: unknown): string | null {
  const raw = imageRawPath(value);
  if (!raw) return null;
  return raw.startsWith("/") || raw.startsWith("http") ? raw : publicImageUrl(raw);
}

/**
 * Uploads one MP4 or WebM (up to 50 MB) into the store's own folder. The stored value is `{ path }`, the same shape as a
 * picture, so the document rules about where a file may live apply to it unchanged.
 */
export function VideoField({ descriptor: d, value, disabled, error, onChange }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const url = videoUrlOf(value);
  const uploading = progress !== null;

  async function upload(file: File) {
    setNotice(null);
    if (!(VIDEO_TYPES as readonly string[]).includes(file.type)) return setNotice("Only MP4 or WebM videos are allowed.");
    if (file.size > VIDEO_MAX_BYTES) return setNotice("The video is larger than 50 MB. Compress it or use a shorter clip.");
    setProgress(0);
    try {
      const res = await requestUploadsAction({ scope: "store", files: [{ type: file.type, size: file.size }] });
      if (!res.ok || !res.data?.[0]) throw new Error(res.ok ? "Upload not permitted" : res.error);
      const target = res.data[0];
      await putWithProgress(target.signedUrl, file, setProgress);
      onChange({ path: target.path });
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{d.label}</Label>
      {url ? (
        <video src={url} muted playsInline preload="metadata" controls className="aspect-video w-full rounded-md border bg-black object-cover" />
      ) : null}
      <input
        ref={input}
        type="file"
        accept={VIDEO_TYPES.join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-label={`${d.label} file`}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void upload(f);
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={disabled || uploading} onClick={() => input.current?.click()}>
          {uploading ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Video className="size-3.5" aria-hidden />}
          {uploading ? `Uploading ${progress}%` : url ? "Replace video" : "Upload video"}
        </Button>
        {url && !uploading ? (
          <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onChange(undefined)} className="text-destructive hover:text-destructive">
            <Trash2 className="size-3.5" aria-hidden /> Remove
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">MP4 or WebM, up to 50 MB. A short, silent loop (10 to 20 seconds) plays best.</p>
      {notice || error ? (
        <p role="alert" className="flex items-start gap-1 text-xs text-destructive">
          <TriangleAlert className="mt-0.5 size-3 shrink-0" aria-hidden />
          {notice ?? error}
        </p>
      ) : null}
    </div>
  );
}
