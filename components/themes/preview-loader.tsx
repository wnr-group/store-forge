"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** The pictures a preview is showing right now, inside same-origin preview windows too, that are near the top of the page. */
function visibleImages(root: HTMLElement): HTMLImageElement[] {
  const out: HTMLImageElement[] = [];
  const top = root.getBoundingClientRect();
  for (const img of root.querySelectorAll("img")) {
    const r = img.getBoundingClientRect();
    if (r.top < top.bottom && r.bottom > top.top) out.push(img);
  }
  for (const frame of root.querySelectorAll("iframe")) {
    try {
      const doc = frame.contentDocument;
      const height = frame.contentWindow?.innerHeight ?? 0;
      if (doc) for (const img of doc.querySelectorAll("img")) if (img.getBoundingClientRect().top < height) out.push(img);
    } catch {
      // A window we cannot read: nothing to wait for.
    }
  }
  return out;
}

/** The preview has drawn something: its page is in the box, and a preview window has shown it (it stays hidden until its styles are in). */
function hasDrawn(root: HTMLElement): boolean {
  const frames = root.querySelectorAll("iframe");
  if (frames.length > 0) return [...frames].every((f) => f.style.opacity === "1" && !!f.contentDocument?.querySelector("#sf-screen-root > *"));
  return !!root.querySelector(".sf-frame");
}

/**
 * True once the preview inside the returned ref has drawn and its pictures (the ones on screen) have loaded. A preview shows its
 * layout at once but its photos arrive later, so this tells a loader when to fade out. It never waits longer than `capMs`: a
 * picture that fails or never loads must not keep the loader on forever.
 */
export function useImagesReady(enabled: boolean, capMs = 7000) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const started = Date.now();
    const finish = () => setReady(true);
    const cap = window.setTimeout(finish, capMs);
    // Polling, because the preview mounts its pictures at its own pace (after it is measured, after its styles load).
    const poll = window.setInterval(() => {
      const root = ref.current;
      if (!root || Date.now() - started < 500) return;
      if (hasDrawn(root) && visibleImages(root).every((img) => img.complete)) finish();
    }, 150);
    return () => {
      window.clearTimeout(cap);
      window.clearInterval(poll);
    };
  }, [enabled, capMs]);
  return [ref, enabled && ready] as const;
}

/** Covers a preview with a shimmer and a spinner until it is ready, then fades away. The preview must sit in a `relative` box. */
export function PreviewLoader({ ready, label = "Loading preview" }: { ready: boolean; label?: string }) {
  return (
    <div role="status" aria-hidden={ready} className={cn("absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 transition-opacity duration-300", ready && "pointer-events-none opacity-0")}>
      <Skeleton className="absolute inset-0 rounded-none" />
      <span className="relative flex items-center gap-2 rounded-full bg-background/80 px-3 py-1.5 text-xs text-muted-foreground shadow-xs backdrop-blur">
        <Loader2 className="size-3.5 animate-spin" aria-hidden /> {label}
      </span>
    </div>
  );
}
