"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Camera } from "lucide-react";
import { cn } from "@/lib/utils";

/** Shown when a category has no photo yet, or when its photo fails to load. Fills the same box as the photo. */
export function ImagePlaceholder({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex h-full w-full flex-col items-center justify-center gap-2 bg-lp-soft text-lp-text/70", className)}>
      <Camera className={compact ? "size-4" : "size-6"} strokeWidth={1.5} aria-hidden />
      {compact ? <span className="sr-only">Image Coming Soon</span> : <span className="text-xs font-medium tracking-wide">Image Coming Soon</span>}
    </div>
  );
}

/**
 * Category photo that fills its parent (which must be `relative`). A soft skeleton shows while it loads, the photo
 * eases in, and any load failure swaps in the "Image Coming Soon" placeholder instead of a broken image.
 */
export function CategoryImage({ src, alt, sizes, position, priority }: { src?: string; alt: string; sizes: string; position?: string; priority?: boolean }) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const zoomRef = useRef<HTMLDivElement>(null);

  // A cached photo can finish loading before React hydrates, so its onLoad never reaches us: check on mount too.
  useEffect(() => {
    const img = zoomRef.current?.querySelector("img");
    if (img?.complete && img.naturalWidth > 0) setState("ready");
  }, []);

  if (!src || state === "error") return <ImagePlaceholder />;

  return (
    <>
      <div aria-hidden className={cn("absolute inset-0 bg-lp-soft transition-opacity duration-500 motion-reduce:transition-none", state === "ready" ? "opacity-0" : "animate-pulse")} />
      {/* The zoom lives on its own GPU layer and its own transition; the fade-in below never shares it, so neither stutters. */}
      <div
        ref={zoomRef}
        className="absolute inset-0 transform-gpu transition-transform duration-[1100ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform group-hover:scale-[1.07] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
      >
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          style={position ? { objectPosition: position } : undefined}
          onLoad={() => setState("ready")}
          onError={() => setState("error")}
          className={cn("object-cover transition-opacity duration-700 ease-out motion-reduce:transition-none", state === "ready" ? "opacity-100" : "opacity-0")}
        />
      </div>
    </>
  );
}
