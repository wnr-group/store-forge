"use client";

import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { CONTAINER } from "../ui";
import { cn } from "@/lib/utils";

export type HeroSlideData = {
  id: string;
  kind: "image" | "video";
  /** Picture or video address, already resolved to a URL. */
  src: string;
  alt: string;
  heading?: string;
  subheading?: string;
  buttonLabel?: string;
  href?: string;
};

/** Seconds a picture slide stays before the next one slides in. */
const SLIDE_MS = 6500;
const EASE = "cubic-bezier(0.65, 0, 0.35, 1)";

const REDUCED = "(prefers-reduced-motion: reduce)";
const subscribeReducedMotion = (onChange: () => void) => {
  const q = window.matchMedia(REDUCED);
  q.addEventListener("change", onChange);
  return () => q.removeEventListener("change", onChange);
};
const reducedMotionNow = () => window.matchMedia(REDUCED).matches;

const mod = (n: number, m: number) => ((n % m) + m) % m;

/**
 * Full-height hero with sliding slides (Haven). Picture slides carry a heading, text and button; video slides play on their
 * own with no text and no slide controls, then hand over to the next slide when they end. One slide never slides: a lone
 * picture stays put and a lone video loops.
 *
 * Slides sit side by side and move with `transform` only. With two slides the list is doubled so each move can always
 * continue in the same direction. Pictures advance by timer (paused while hovered or focused, and never when the
 * visitor prefers reduced motion); they can also be moved with the arrows, the dots or a swipe; a video advances when it ends.
 */
export function HeroSlider({ slides, storeName, sfProps }: { slides: HeroSlideData[]; storeName: string; sfProps?: { "data-sf-section"?: string } }) {
  const count = slides.length;
  const multiple = count > 1;
  // Two real slides are shown as four so the track can keep moving one way.
  const track = count === 2 ? [...slides, ...slides] : slides;
  const total = track.length;

  const [pos, setPos] = useState(0);
  const [step, setStep] = useState(0);
  const [hover, setHover] = useState(false);
  const reduced = useSyncExternalStore(subscribeReducedMotion, reducedMotionNow, () => false);
  const [muted, setMuted] = useState(true);
  const [videoPaused, setVideoPaused] = useState(false);

  const current = mod(pos, total);
  const real = current % count;
  const activeSlide = track[current];
  const onVideo = activeSlide.kind === "video";

  const swipeFrom = useRef<number | null>(null);
  const go = useCallback((by: number) => {
    setStep(by);
    setPos((p) => p + by);
  }, []);

  // Pictures advance on a timer. Videos advance when they end (see `onEnded`).
  useEffect(() => {
    if (!multiple || reduced || hover || onVideo) return;
    const t = window.setTimeout(() => go(1), SLIDE_MS);
    return () => window.clearTimeout(t);
  }, [multiple, reduced, hover, onVideo, go, pos]);

  // A slide that wraps from one end of the track to the other must jump, not sweep across the screen. `step` is the last move,
  // so the positions before it can be worked out again without keeping them anywhere.
  const offsetsAt = (cur: number) =>
    track.map((_, i) => {
      const d = mod(i - cur, total);
      return d > total / 2 ? d - total : d;
    });
  const offsets = offsetsAt(current);
  const before = offsetsAt(mod(pos - step, total));
  const jumped = offsets.map((o, i) => Math.abs(o - before[i]) > 1);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured"
      className="relative isolate h-[calc(100svh-4rem)] min-h-[32rem] w-full overflow-hidden bg-neutral-900 text-white lg:h-[calc(100svh-5.25rem)]"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      onTouchStart={(e) => {
        swipeFrom.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const from = swipeFrom.current;
        swipeFrom.current = null;
        if (from === null || !multiple || onVideo) return;
        const dx = (e.changedTouches[0]?.clientX ?? from) - from;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
      }}
      {...sfProps}
    >
      {track.map((slide, i) => {
        const offset = offsets[i];
        const active = i === current;
        const near = Math.abs(offset) <= 1;
        return (
          <div
            key={`${slide.id}-${i}`}
            role="group"
            aria-roledescription="slide"
            aria-label={`${(i % count) + 1} of ${count}`}
            aria-hidden={!active}
            inert={!active}
            className={cn("absolute inset-0", !near && "invisible")}
            style={{
              transform: `translate3d(${offset * 100}%,0,0)`,
              transition: jumped[i] || reduced ? "none" : `transform 900ms ${EASE}`,
              willChange: "transform",
            }}
          >
            {slide.kind === "video" ? (
              <SlideVideo src={slide.src} active={active} near={near} loop={!multiple} muted={muted} paused={videoPaused} onEnded={() => multiple && go(1)} onFailed={() => multiple && active && go(1)} />
            ) : (
              <Image
                src={slide.src}
                alt={slide.alt}
                fill
                priority={i === 0}
                loading="eager"
                sizes="100vw"
                className={cn("object-cover", !reduced && "transition-transform duration-[8000ms] ease-out", active && !reduced ? "scale-[1.06]" : "scale-100")}
              />
            )}
            {slide.kind === "image" ? (
              <>
                <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/30 to-transparent sm:via-black/20" />
                <div aria-hidden className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/50 to-transparent" />
                <div className={cn(CONTAINER, "relative flex h-full items-center pb-20")}>
                  <div className={cn("max-w-2xl transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none", active ? "translate-y-0 opacity-100 delay-500 motion-reduce:delay-0" : "translate-y-5 opacity-0")}>
                    <p className="inline-flex items-center gap-3 text-sm font-medium tracking-wide text-white/90">
                      <span aria-hidden className="h-0.5 w-10 bg-accent" />
                      {storeName}
                    </p>
                    {slide.heading ? (
                      i === 0 ? (
                        <h1 className="mt-4 text-4xl font-semibold leading-[1.06] tracking-tight text-balance sm:text-5xl lg:text-[4rem]">{slide.heading}</h1>
                      ) : (
                        <h2 className="mt-4 text-4xl font-semibold leading-[1.06] tracking-tight text-balance sm:text-5xl lg:text-[4rem]">{slide.heading}</h2>
                      )
                    ) : null}
                    {slide.subheading ? <p className="mt-5 max-w-md text-base leading-7 text-pretty text-white/85 sm:text-lg sm:leading-8">{slide.subheading}</p> : null}
                    {slide.buttonLabel ? (
                      <Link
                        href={slide.href || "/"}
                        className="group/btn mt-8 inline-flex h-12 items-center gap-2 rounded-[var(--sf-button-radius,4px)] bg-white px-8 text-[15px] font-medium text-neutral-950 transition-colors duration-300 hover:bg-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                      >
                        {slide.buttonLabel}
                        <ArrowRight className="size-4 transition-transform duration-300 group-hover/btn:translate-x-1 motion-reduce:transition-none" aria-hidden />
                      </Link>
                    ) : null}
                  </div>
                </div>
              </>
            ) : (
              <div aria-hidden className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/40 to-transparent" />
            )}
          </div>
        );
      })}

      {/* Controls. On a video slide there is no next or previous, only pause and sound. */}
      {multiple || onVideo ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10">
          <div className={cn(CONTAINER, "flex items-center justify-between gap-4 pb-6 sm:pb-8")}>
            {multiple && !onVideo ? (
              <div className="pointer-events-auto flex items-center gap-4">
                <span className="text-sm tabular-nums tracking-widest text-white/90" aria-hidden>
                  {String(real + 1).padStart(2, "0")} <span className="text-white/50">/ {String(count).padStart(2, "0")}</span>
                </span>
                <div role="group" aria-label="Choose a slide" className="flex items-center gap-1">
                  {slides.map((s, i) => (
                    <button
                      key={s.id}
                      type="button"
                      aria-label={`Go to slide ${i + 1}`}
                      aria-current={i === real}
                      onClick={() => go(i - real)}
                      className="group/dot flex h-11 w-6 items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-white"
                    >
                      <span className={cn("block h-0.5 rounded-full bg-white transition-all duration-500 motion-reduce:transition-none", i === real ? "w-6 opacity-100" : "w-3 opacity-50 group-hover/dot:opacity-80")} />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <span />
            )}
            <div className="pointer-events-auto flex items-center gap-2">
              {onVideo ? (
                <>
                  <RoundButton label={muted ? "Turn sound on" : "Mute"} onClick={() => setMuted((m) => !m)}>
                    {muted ? <VolumeX className="size-5" aria-hidden /> : <Volume2 className="size-5" aria-hidden />}
                  </RoundButton>
                  <RoundButton label={videoPaused ? "Play video" : "Pause video"} onClick={() => setVideoPaused((v) => !v)}>
                    {videoPaused ? <Play className="size-5" aria-hidden /> : <Pause className="size-5" aria-hidden />}
                  </RoundButton>
                </>
              ) : (
                <>
                  <RoundButton label="Previous slide" onClick={() => go(-1)}>
                    <ChevronLeft className="size-5" aria-hidden />
                  </RoundButton>
                  <RoundButton label="Next slide" onClick={() => go(1)}>
                    <ChevronRight className="size-5" aria-hidden />
                  </RoundButton>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
      <span className="sr-only" aria-live={hover ? "polite" : "off"}>{`Slide ${real + 1} of ${count}`}</span>
    </section>
  );
}

function RoundButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="inline-flex size-11 items-center justify-center rounded-full border border-white/40 bg-black/20 text-white backdrop-blur-sm transition-colors duration-300 hover:bg-white hover:text-neutral-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
    >
      {children}
    </button>
  );
}

/** A background video: muted by default (browsers only autoplay muted video), plays only while its slide is showing. */
function SlideVideo({ src, active, near, loop, muted, paused, onEnded, onFailed }: { src: string; active: boolean; near: boolean; loop: boolean; muted: boolean; paused: boolean; onEnded: () => void; onFailed: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.muted = muted;
  }, [muted]);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (active && !paused) {
      v.play().catch(() => {
        // Autoplay blocked or the file will not play: do not leave a frozen frame on screen.
        onFailed();
      });
    } else {
      v.pause();
      if (!active) v.currentTime = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, paused]);
  return <video ref={ref} src={src} muted={muted} loop={loop} playsInline preload={near ? "auto" : "none"} onEnded={onEnded} onError={onFailed} className="absolute inset-0 size-full object-cover" aria-hidden />;
}
