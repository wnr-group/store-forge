"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react";
import { publicImageUrl } from "@/lib/storage/paths";
import { cn } from "@/lib/utils";
import { ImagePlaceholder } from "../../ui";

const pad = (n: number) => String(n).padStart(2, "0");
const ARROW = "grid size-10 place-items-center rounded-full bg-white/90 text-primary shadow-sm backdrop-blur transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";

/**
 * Sport product gallery: a vertical rail of thumbnails and a big rounded picture. Every picture stays mounted and only the
 * shown one is visible, so switching is a clean cross-fade. Hover shows arrows, swipe works on phones, and a click opens a
 * full-screen viewer that zooms toward the pointer.
 */
export function SportProductGallery({ paths, shown, onShow, name, soldOut }: { paths: string[]; shown: string | null; onShow: (path: string) => void; name: string; soldOut: boolean }) {
  const viewer = useRef<HTMLDialogElement>(null);
  const touchX = useRef<number | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const count = paths.length;
  const index = Math.max(0, paths.indexOf(shown ?? ""));

  if (count === 0) {
    return (
      <div className="relative aspect-[4/5] overflow-hidden rounded-[1.5rem] bg-[var(--surface)] lg:aspect-auto lg:h-[calc(100dvh-9rem)] lg:min-h-[30rem]">
        <ImagePlaceholder className="absolute inset-0" />
      </div>
    );
  }

  const go = (d: number) => {
    onShow(paths[(index + d + count) % count]);
    setZoomed(false);
  };
  const keys = (e: React.KeyboardEvent) => {
    if (count < 2) return;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      go(1);
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      go(-1);
    }
  };
  const current = publicImageUrl(paths[index]);

  return (
    <div className="flex min-w-0 flex-col-reverse gap-3 lg:flex-row lg:gap-4">
      {count > 1 ? (
        <ul className="flex shrink-0 gap-2 overflow-x-auto pb-1 lg:max-h-[calc(100dvh-9rem)] lg:w-[4.5rem] lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden lg:pb-0" aria-label="Product pictures">
          {paths.map((path, i) => {
            const url = publicImageUrl(path);
            if (!url) return null;
            return (
              <li key={path} className="w-14 shrink-0 lg:w-full">
                <button type="button" onClick={() => onShow(path)} onKeyDown={keys} aria-label={`Show picture ${i + 1} of ${count}`} aria-pressed={i === index} className={cn("relative block aspect-[4/5] w-full overflow-hidden rounded-[0.75rem] border-2 bg-[var(--surface)] outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-primary", i === index ? "border-primary" : "border-transparent opacity-70 hover:opacity-100")}>
                  <Image src={url} alt="" fill sizes="72px" className="object-cover" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div
        className="group/stage relative aspect-[4/5] min-w-0 flex-1 overflow-hidden rounded-[1.5rem] bg-[var(--surface)] lg:aspect-auto lg:h-[calc(100dvh-9rem)] lg:min-h-[30rem]"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
        }}
        onKeyDown={keys}
      >
        {paths.map((path, i) => {
          const url = publicImageUrl(path);
          return url ? <Image key={path} src={url} alt={i === index ? name : ""} aria-hidden={i !== index} fill priority={i === 0} sizes="(min-width: 1024px) 45vw, 100vw" className={cn("object-cover transition-opacity duration-500 motion-reduce:transition-none", i === index ? "opacity-100" : "opacity-0")} /> : null;
        })}
        <button type="button" onClick={() => viewer.current?.showModal()} aria-label="View full screen and zoom" className="absolute inset-0 cursor-zoom-in focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-primary" />
        <span aria-hidden className="pointer-events-none absolute right-4 top-4 grid size-9 place-items-center rounded-full bg-white/90 text-primary opacity-0 backdrop-blur transition-opacity duration-300 group-hover/stage:opacity-100">
          <Maximize2 className="size-4" />
        </span>
        {soldOut ? <span className="pointer-events-none absolute left-4 top-4 rounded-full bg-white px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-secondary">Sold out</span> : null}
        {count > 1 ? (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Previous picture" className={cn(ARROW, "absolute left-3 top-1/2 hidden -translate-y-1/2 opacity-0 transition-opacity duration-300 group-hover/stage:opacity-100 focus-visible:opacity-100 lg:grid")}>
              <ChevronLeft className="size-5" aria-hidden />
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Next picture" className={cn(ARROW, "absolute right-3 top-1/2 hidden -translate-y-1/2 opacity-0 transition-opacity duration-300 group-hover/stage:opacity-100 focus-visible:opacity-100 lg:grid")}>
              <ChevronRight className="size-5" aria-hidden />
            </button>
            <span className="pointer-events-none absolute bottom-4 left-4 rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-bold tabular-nums tracking-[0.12em] text-primary">
              {pad(index + 1)} / {pad(count)}
            </span>
          </>
        ) : null}
      </div>

      <dialog ref={viewer} onClose={() => setZoomed(false)} onKeyDown={keys} aria-label={`${name}, full screen`} className="m-0 h-dvh max-h-none w-dvw max-w-none bg-[var(--surface)] p-0 text-primary backdrop:bg-black/60">
        <div
          className={cn("relative h-full w-full overflow-hidden", zoomed ? "cursor-zoom-out" : "cursor-zoom-in")}
          onClick={() => setZoomed((z) => !z)}
          onMouseMove={(e) => {
            if (!zoomed) return;
            const r = e.currentTarget.getBoundingClientRect();
            e.currentTarget.style.setProperty("--zx", `${((e.clientX - r.left) / r.width) * 100}%`);
            e.currentTarget.style.setProperty("--zy", `${((e.clientY - r.top) / r.height) * 100}%`);
          }}
        >
          {current ? <Image key={current} src={current} alt={name} fill sizes="100vw" className={cn("object-contain p-6 transition-transform duration-500 sm:p-10", zoomed ? "scale-[2.2]" : "scale-100")} style={{ transformOrigin: "var(--zx, 50%) var(--zy, 50%)" }} /> : null}
        </div>
        <button type="button" onClick={() => viewer.current?.close()} aria-label="Close" className={cn(ARROW, "absolute right-4 top-4 size-11")}>
          <X className="size-5" aria-hidden />
        </button>
        {count > 1 ? (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Previous picture" className={cn(ARROW, "absolute left-4 top-1/2 size-11 -translate-y-1/2")}>
              <ChevronLeft className="size-5" aria-hidden />
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Next picture" className={cn(ARROW, "absolute right-4 top-1/2 size-11 -translate-y-1/2")}>
              <ChevronRight className="size-5" aria-hidden />
            </button>
          </>
        ) : null}
        <p className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-primary/60">Click to zoom · {index + 1} / {count}</p>
      </dialog>
    </div>
  );
}
