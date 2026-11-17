"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { PILL_YELLOW, HEADLINE_FONT, SHELL } from "./ui";

export type SportSlide = {
  id: string;
  src: string | null;
  alt: string;
  heading: string;
  subheading: string;
  buttonLabel: string;
  href: string;
};

const SLIDE_MS = 6000;
const REDUCED = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (cb: () => void) => {
  const q = window.matchMedia(REDUCED);
  q.addEventListener("change", cb);
  return () => q.removeEventListener("change", cb);
};

/** "Move better. Live brighter." -> ["Move better.", "Live brighter."]: the first sentence is white, the rest is yellow. */
export function splitHeading(text: string): [string, string] {
  const parts = text.trim().split(/(?<=[.!?])\s+/);
  return parts.length > 1 ? [parts[0], parts.slice(1).join(" ")] : [text.trim(), ""];
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Full-screen hero slider. Slides cross-fade; the copy sits on the left over a navy wash. A counter with a progress line shows
 * where you are, and round buttons pause, go back and go forward. It pauses on hover, never advances for visitors who prefer
 * reduced motion, and a single slide does not move at all.
 */
export function SportHeroSlider({ slides, eyebrow, ctas, sfProps }: { slides: SportSlide[]; eyebrow: string; ctas: React.ReactNode; sfProps?: { "data-sf-section"?: string } }) {
  const count = slides.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hover, setHover] = useState(false);
  const reduced = useSyncExternalStore(subscribeReduced, () => window.matchMedia(REDUCED).matches, () => false);
  const running = count > 1 && !paused && !hover && !reduced;

  const go = useCallback((n: number) => setIndex(((n % count) + count) % count), [count]);

  useEffect(() => {
    if (!running) return;
    const t = window.setTimeout(() => setIndex((i) => (i + 1) % count), SLIDE_MS);
    return () => window.clearTimeout(t);
  }, [running, index, count]);

  const slide = slides[index];
  const [first, rest] = splitHeading(slide.heading);

  return (
    <section aria-roledescription="carousel" aria-label="Featured" className="relative isolate flex min-h-[max(28rem,calc(100svh-92px))] max-h-[60rem] lg:min-h-[max(30rem,calc(100svh-104px))] w-full flex-col overflow-hidden bg-primary text-white" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} {...sfProps}>
      {slides.map((s, i) => (
        <div key={s.id} aria-hidden={i !== index} className={cn("absolute inset-0 -z-20 transition-opacity duration-700 motion-reduce:transition-none", i === index ? "opacity-100" : "opacity-0")}>
          {s.src ? <Image src={s.src} alt={s.alt} fill {...(i === 0 ? { priority: true } : { loading: "eager" as const })} sizes="100vw" className="object-cover object-[70%_center]" /> : <div className="absolute inset-0 bg-[linear-gradient(135deg,var(--primary),color-mix(in_srgb,var(--secondary)_70%,var(--primary)))]" />}
        </div>
      ))}
      <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,var(--primary)_0%,color-mix(in_srgb,var(--primary)_90%,transparent)_38%,color-mix(in_srgb,var(--primary)_40%,transparent)_66%,transparent_88%)] max-md:bg-primary/70" />

      <div className={cn(SHELL, "relative flex flex-1 items-center py-10 lg:pl-[8%] xl:pl-[11%] lg:py-20 [@media(max-height:760px)]:py-6")}>
        <div key={slide.id} className="max-w-2xl animate-in fade-in slide-in-from-bottom-3 duration-700 motion-reduce:animate-none">
          <p className="inline-flex items-center gap-2.5 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-white backdrop-blur-sm lg:px-5 lg:py-2.5 lg:text-[12px] [@media(max-height:760px)]:py-1.5">
            <span aria-hidden className="size-2 rounded-full bg-accent" />
            {eyebrow}
          </p>
          <h1 className="mt-5 text-balance text-[2.5rem] font-extrabold leading-[1.02] tracking-[-0.035em] sm:text-[3.5rem] lg:mt-6 lg:text-[4.25rem] [@media(max-height:760px)]:mt-4 [@media(max-height:760px)]:text-[2.5rem] lg:[@media(max-height:760px)]:text-[3.25rem]" style={HEADLINE_FONT}>
            <span className="block text-white">{first}</span>
            {rest ? <span className="block text-accent">{rest}</span> : null}
          </h1>
          {slide.subheading ? <p className="mt-4 max-w-xl text-[16px] leading-7 text-white/85 sm:text-[18px] lg:mt-6 lg:leading-8 [@media(max-height:760px)]:mt-3 [@media(max-height:760px)]:text-[16px] [@media(max-height:760px)]:leading-6">{slide.subheading}</p> : null}
          <div className="mt-6 flex flex-wrap gap-3 lg:mt-9 lg:gap-4 [@media(max-height:760px)]:mt-4 [&>div]:pt-0 [&_a]:h-12 lg:[&_a]:h-14 [@media(max-height:760px)]:[&_a]:!h-11 [&_a]:rounded-full [&_a]:border [&_a]:border-white/30 [&_a]:bg-white/10 [&_a]:px-6 lg:[&_a]:px-7 [&_a]:text-[15px] lg:[&_a]:text-[16px] [&_a]:font-semibold [&_a]:text-white [&_a]:shadow-none [&_a]:backdrop-blur-sm [&_a]:transition-colors [&_a:hover]:bg-white/20">
            {slide.buttonLabel ? (
              <Link href={slide.href || "/products"} className={cn(PILL_YELLOW, "h-12 text-[15px] lg:h-14 lg:text-[16px] [@media(max-height:760px)]:!h-11")}>
                {slide.buttonLabel}
                <ArrowRight className="size-[18px]" strokeWidth={2} aria-hidden />
              </Link>
            ) : null}
            {ctas}
          </div>
        </div>
      </div>

      {count > 1 ? (
        <div className={cn(SHELL, "relative flex items-center justify-between pb-8 lg:pb-10")}>
          <div className="flex items-center gap-3 text-[14px] font-bold tabular-nums tracking-[0.1em] sm:gap-5" aria-live="off">
            <span>{pad(index + 1)}</span>
            <span aria-hidden className="relative h-0.5 w-14 overflow-hidden sm:w-40 rounded-full bg-white/25">
              <span key={`${index}-${running}`} className={cn("absolute inset-y-0 left-0 bg-accent", running ? "w-full" : "w-0")} style={running ? { animation: `sf-progress ${SLIDE_MS}ms linear forwards` } : undefined} />
            </span>
            <span className="text-white/60">{pad(count)}</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {[
              { label: paused ? "Play slideshow" : "Pause slideshow", icon: paused ? Play : Pause, on: () => setPaused((p) => !p) },
              { label: "Previous slide", icon: ArrowLeft, on: () => go(index - 1) },
              { label: "Next slide", icon: ArrowRight, on: () => go(index + 1) },
            ].map(({ label, icon: Icon, on }) => (
              <button key={label} type="button" onClick={on} aria-label={label} className="flex size-11 items-center justify-center rounded-full bg-white text-primary transition-transform duration-200 hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:size-14">
                <Icon className="size-5" strokeWidth={2} aria-hidden />
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <style>{`@keyframes sf-progress{from{width:0}to{width:100%}}@media (prefers-reduced-motion: reduce){[style*="sf-progress"]{animation:none!important;width:100%}}`}</style>
    </section>
  );
}
