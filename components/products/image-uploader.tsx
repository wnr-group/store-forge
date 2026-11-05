"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, Star, Trash2, TriangleAlert } from "lucide-react";
import { requestUploadsAction } from "@/app/(dashboard)/dashboard/uploads/actions";
import { discardUploadsAction } from "@/app/(dashboard)/dashboard/uploads/discard";
import { Button } from "@/components/ui/button";
import { publicImageUrl } from "@/lib/storage/paths";
import { cn } from "@/lib/utils";
import { uuid } from "@/lib/utils/uuid";
import { IMAGE_MAX_BYTES, IMAGE_TYPES } from "@/lib/validations/catalog";

export type ImageItem = {
  /** Local key for React; the storage path once uploaded. */
  key: string;
  path: string | null;
  altText: string | null;
  /** Local preview for files that are still uploading / not yet saved. */
  preview?: string;
  progress: number;
  status: "uploading" | "done" | "error";
  error?: string;
  /** True once the row is stored in the database (so removing it only unlinks; the server deletes the file on save). */
  saved: boolean;
};

type Props = {
  value: ImageItem[];
  onChange: (next: ImageItem[] | ((prev: ImageItem[]) => ImageItem[])) => void;
  scope: "product" | "collection" | "store";
  ownerId?: string;
  max: number;
  disabled?: boolean;
  /** Single-image mode (collection image / store logo). */
  single?: boolean;
  label?: string;
};

/** PUT the file to a Supabase signed upload URL with real progress (same wire format as supabase-js uploadToSignedUrl). */
function putWithProgress(signedUrl: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("x-upsert", "false");
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (anon) xhr.setRequestHeader("apikey", anon);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Network error during upload"));
    const body = new FormData();
    body.append("cacheControl", "3600");
    body.append("", file);
    xhr.send(body);
  });
}

export function ImageUploader({ value, onChange, scope, ownerId, max, disabled, single, label = "Images" }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const busy = value.some((v) => v.status === "uploading");

  const patch = (key: string, p: Partial<ImageItem>) => onChange((prev) => prev.map((i) => (i.key === key ? { ...i, ...p } : i)));

  async function addFiles(list: FileList | File[]) {
    setNotice(null);
    const room = single ? 1 : max - value.length;
    const incoming = Array.from(list);
    const problems: string[] = [];
    const ok = incoming.filter((f) => {
      if (!(IMAGE_TYPES as readonly string[]).includes(f.type)) problems.push(`${f.name}: only JPEG, PNG or WebP images`);
      else if (f.size > IMAGE_MAX_BYTES) problems.push(`${f.name}: larger than 5 MB`);
      else return true;
      return false;
    });
    if (ok.length > room) problems.push(`Only ${max} image${max === 1 ? "" : "s"} allowed; extra files were skipped`);
    const files = ok.slice(0, Math.max(room, 0));
    if (problems.length) setNotice(problems.join(". "));
    if (!files.length) return;

    const items: ImageItem[] = files.map((f) => ({ key: uuid(), path: null, altText: null, preview: URL.createObjectURL(f), progress: 0, status: "uploading", saved: false }));
    if (single && value.some((v) => v.path && !v.saved)) void discardUploadsAction(value.flatMap((v) => (v.path && !v.saved ? [v.path] : [])));
    onChange((prev) => (single ? items : [...prev, ...items]));

    const res = await requestUploadsAction({ scope, ownerId, files: files.map((f) => ({ type: f.type, size: f.size })) });
    if (!res.ok || !res.data) {
      for (const it of items) patch(it.key, { status: "error", error: res.ok ? "Upload not permitted" : res.error });
      return;
    }
    await Promise.all(
      files.map(async (file, i) => {
        const target = res.data![i];
        try {
          await putWithProgress(target.signedUrl, file, (progress) => patch(items[i].key, { progress }));
          patch(items[i].key, { path: target.path, status: "done", progress: 100 });
        } catch (e) {
          patch(items[i].key, { status: "error", error: e instanceof Error ? e.message : "Upload failed" });
        }
      }),
    );
  }

  const remove = (item: ImageItem) => {
    onChange((prev) => prev.filter((i) => i.key !== item.key));
    if (item.preview) URL.revokeObjectURL(item.preview);
    // Unsaved uploads are not referenced by the database: delete the file now. Saved ones are removed by the server on save.
    if (item.path && !item.saved) void discardUploadsAction([item.path]);
  };

  const move = (index: number, to: number) =>
    onChange((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [it] = next.splice(index, 1);
      next.splice(to, 0, it);
      return next;
    });

  const canAdd = !disabled && (single ? true : value.length < max);

  return (
    <div className="space-y-3">
      {value.length > 0 ? (
        <ul className={cn("grid gap-3", single ? "max-w-48 grid-cols-1" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4")}>
          {value.map((item, index) => {
            const src = item.preview ?? publicImageUrl(item.path);
            return (
              <li key={item.key} className="group relative overflow-hidden rounded-lg border bg-muted">
                <div className="relative aspect-square">
                  {src ? <Image src={src} alt={item.altText ?? ""} fill sizes="200px" unoptimized={Boolean(item.preview)} className={cn("object-cover transition-opacity", item.status !== "done" && "opacity-50")} /> : null}
                  {item.status === "uploading" ? (
                    <div className="absolute inset-x-2 bottom-2" role="progressbar" aria-valuenow={item.progress} aria-valuemin={0} aria-valuemax={100} aria-label="Upload progress">
                      <div className="h-1.5 overflow-hidden rounded-full bg-background/80">
                        <div className="h-full bg-primary transition-[width]" style={{ width: `${item.progress}%` }} />
                      </div>
                    </div>
                  ) : null}
                  {item.status === "error" ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-background/85 p-2 text-center text-xs text-destructive">
                      <TriangleAlert className="size-4" aria-hidden />
                      <span>{item.error ?? "Upload failed"}</span>
                    </div>
                  ) : null}
                  {!single && index === 0 && item.status === "done" ? (
                    <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded-md bg-background px-2 py-0.5 text-[11px] font-medium">
                      <Star className="size-3 fill-current" aria-hidden /> Main
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center justify-between gap-1 border-t bg-card p-1">
                  {single ? (
                    <span />
                  ) : (
                    <div className="flex items-center">
                      <Button type="button" variant="ghost" size="icon-xs" onClick={() => move(index, index - 1)} disabled={index === 0 || disabled} aria-label="Move earlier">
                        <ArrowLeft aria-hidden />
                      </Button>
                      <Button type="button" variant="ghost" size="icon-xs" onClick={() => move(index, index + 1)} disabled={index === value.length - 1 || disabled} aria-label="Move later">
                        <ArrowRight aria-hidden />
                      </Button>
                      {index !== 0 ? (
                        <Button type="button" variant="ghost" size="icon-xs" onClick={() => move(index, 0)} disabled={disabled || item.status !== "done"} aria-label="Make main image" title="Make main image">
                          <Star aria-hidden />
                        </Button>
                      ) : null}
                    </div>
                  )}
                  <Button type="button" variant="ghost" size="icon-xs" onClick={() => remove(item)} disabled={disabled} aria-label="Remove image" className="text-destructive hover:text-destructive">
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {canAdd && (single ? value.length === 0 : true) ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void addFiles(e.dataTransfer.files);
          }}
          className={cn("flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center transition-colors", dragging ? "border-ring bg-accent" : "bg-card/50")}
        >
          <ImagePlus className="size-5 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">
            Drag {single ? "an image" : "images"} here or{" "}
            <button type="button" className="font-medium text-link underline underline-offset-2" onClick={() => input.current?.click()}>
              browse
            </button>
          </p>
          <p className="text-xs text-muted-foreground">JPEG, PNG or WebP · up to 5 MB each{single ? "" : ` · ${value.length}/${max}`}</p>
        </div>
      ) : null}

      <input
        ref={input}
        type="file"
        accept={IMAGE_TYPES.join(",")}
        multiple={!single}
        className="sr-only"
        aria-label={label}
        tabIndex={-1}
        onChange={(e) => {
          if (e.target.files) void addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {busy ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
          <Loader2 className="size-3.5 animate-spin" aria-hidden /> Uploading…
        </p>
      ) : null}
      {notice ? (
        <p role="alert" className="text-xs text-destructive">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
