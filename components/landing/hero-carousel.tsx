"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import Image from "next/image";
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHeroScroll } from "./motion";
import { lpButton } from "./ui";

/** How long each banner stays. The same value drives the progress bars, so what you see is what the timer does. */
const SLIDE_MS = 7000;

type Slide = {
  eyebrow: string;
  /** Parts are kept together when the headline wraps. */
  title: string | string[];
  text: string;
  cta: { label: string; href: string };
  image: { src: string; alt: string; position?: string };
};

const SLIDES: Slide[] = [
  {
    eyebrow: "Build your online store",
    title: ["Everything You Need", "to Build Your", "Online Store."],
    text: "Bring your business online with a beautiful storefront and everything you need to start selling.",
    cta: { label: "See How It Works", href: "#how-it-works" },
    image: { src: "/landing/hero-woman.webp", alt: "A woman in a navy shirt smiling as she works on a laptop at a wooden desk, with navy shelves of ceramics and plants behind her", position: "78% 40%" },
  },
  {
    eyebrow: "Manage your business",
    title: ["Your Business.", "Your Store.", "All in One Place."],
    text: "Manage your products, orders and customers with a simple and powerful commerce experience.",
    cta: { label: "Explore Features", href: "#features" },
    image: { src: "/landing/hero-manage.webp", alt: "A shop owner in a navy apron checking stock on a tablet, with wrapped parcels and folded knitwear on the table in front of him", position: "80% 35%" },
  },
  {
    eyebrow: "Grow your business",
    title: ["Turn Your Ideas Into", "a Growing Online", "Business."],
    text: "Showcase your products, connect with customers and create memorable shopping experiences.",
    cta: { label: "Explore the Platform", href: "#platform" },
    image: { src: "/landing/hero-grow.webp", alt: "Wooden shelves on a navy wall displaying folded knitwear, ceramics, a leather wallet, headphones and plants", position: "80% 50%" },
  },
];

const vars = (i: number) => ({ "--i": i }) as React.CSSProperties;

export function HeroCarousel() {
  const [index, setIndex] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [keyboardFocus, setKeyboardFocus] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const heroScroll = useHeroScroll(sectionRef);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const go = useCallback(
    (to: number) => {
      const next = (to + SLIDES.length) % SLIDES.length;
      if (next === index) return;
      setPrev(index); // the outgoing banner stays underneath while the new one opens over it
      setIndex(next);
    },
    [index],
  );

  const playing = !userPaused && !keyboardFocus && !reduceMotion;

  return (
    <section ref={sectionRef} aria-roledescription="carousel" aria-label="Featured" className="relative">
      <h1 className="sr-only">Kanova Store: build, manage and grow your online store</h1>
      <div
        className="relative h-[calc(100svh-6.3125rem)] max-h-[58rem] min-h-[34rem] w-full overflow-hidden bg-[#080a25]"
        // Hovering never pauses the timer. It only holds while someone is tabbing through the controls (keyboard
        // focus), so a mouse click on a control does not stop the slide show either.
        onFocus={(e) => e.target.matches(":focus-visible") && setKeyboardFocus(true)}
        onBlur={() => setKeyboardFocus(false)}
      >
        {SLIDES.map((s, i) => {
          const active = i === index;
          const outgoing = i === prev && !active;
          return (
            <div
              key={s.eyebrow}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${SLIDES.length}`}
              aria-hidden={!active}
              inert={!active}
              data-active={active}
              className={cn(
                "lp-slide absolute inset-0",
                // The incoming banner opens like a card sliding open from the right edge; the outgoing one stays put beneath it.
                active && "z-20 [clip-path:inset(0_0_0_0)] motion-safe:transition-[clip-path] motion-safe:duration-[1100ms] motion-safe:ease-[cubic-bezier(0.77,0,0.18,1)]",
                outgoing && "z-10 [clip-path:inset(0_0_0_0)]",
                !active && !outgoing && "z-0 [clip-path:inset(0_0_0_100%)]",
                !active && "pointer-events-none",
              )}
            >
              <Image
                src={s.image.src}
                alt={s.image.alt}
                fill
                sizes="100vw"
                priority={i === 0}
                style={{ objectPosition: s.image.position }}
                className={cn("object-cover motion-safe:transition-transform motion-safe:duration-[9000ms] motion-safe:ease-out", active ? "scale-100" : "motion-safe:scale-110")}
              />
              {/* Deep navy wash so white text always has strong contrast, strongest where the text sits. */}
              <div className="absolute inset-0 bg-[#080a25]/60 sm:bg-transparent sm:bg-gradient-to-r sm:from-[#080a25]/85 sm:via-[#080a25]/50 sm:via-55% sm:to-transparent" aria-hidden />
              <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#080a25]/80 to-transparent" aria-hidden />

              <motion.div style={{ y: heroScroll.y, opacity: heroScroll.opacity }} className="relative mx-auto flex h-full w-full max-w-6xl items-center px-4 pb-32 sm:px-6 sm:pb-28">
                <div className="lp-stagger max-w-2xl">
                  <p style={vars(0)} className="inline-flex items-center gap-2.5 text-sm font-semibold tracking-wide text-lp-accent-light">
                    <span className="h-px w-8 bg-lp-accent" aria-hidden />
                    {s.eyebrow}
                  </p>
                  <h2 style={vars(1)} className="mt-4 text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-[3.75rem] lg:leading-[1.05]">
                    {Array.isArray(s.title)
                      ? s.title.map((part) => (
                          <span key={part} className="mr-[0.25em] inline-block">
                            {part}
                          </span>
                        ))
                      : s.title}
                  </h2>
                  <p style={vars(2)} className="mt-5 max-w-md text-base leading-7 text-pretty text-white/85 sm:text-lg sm:leading-8">
                    {s.text}
                  </p>
                  <div style={vars(3)} className="mt-8">
                    <a href={s.cta.href} className={lpButton("gold", "h-12 px-8 text-[15px]")}>
                      {s.cta.label} <ArrowRight className="size-4" aria-hidden />
                    </a>
                  </div>
                </div>
              </motion.div>
            </div>
          );
        })}

        {/* Timer cards: one per banner. The active card's bar fills over SLIDE_MS and, when full, opens the next banner. */}
        <div className="absolute inset-x-0 bottom-0 z-30">
          <div className="mx-auto flex w-full max-w-6xl items-end justify-between gap-4 px-4 pb-6 sm:px-6 sm:pb-8">
            <div role="tablist" aria-label="Choose a banner" className="grid flex-1 grid-cols-3 gap-3 sm:max-w-2xl sm:gap-4">
              {SLIDES.map((s, i) => {
                const active = i === index;
                return (
                  <button
                    key={s.eyebrow}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-label={`Banner ${i + 1}: ${s.eyebrow}`}
                    onClick={() => go(i)}
                    className="group relative rounded-sm pt-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#080a25]"
                  >
                    <span className="absolute inset-x-0 top-0 h-[3px] overflow-hidden rounded-full bg-white/30" aria-hidden>
                      {active ? (
                        <span
                          key={index}
                          data-run="true"
                          className="lp-progress block h-full w-full bg-lp-accent"
                          style={{ "--lp-dur": `${SLIDE_MS}ms`, animationPlayState: playing ? "running" : "paused" } as React.CSSProperties}
                          onAnimationEnd={() => go(index + 1)}
                        />
                      ) : null}
                    </span>
                    <span className={cn("block text-xs font-medium tabular-nums transition-colors", active ? "text-white" : "text-white/60 group-hover:text-white/90")}>0{i + 1}</span>
                    <span className={cn("mt-0.5 hidden text-sm font-medium transition-colors sm:block", active ? "text-white" : "text-white/60 group-hover:text-white/90")}>{s.eyebrow}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setUserPaused((p) => !p)}
                aria-label={userPaused ? "Resume automatic slide show" : "Pause automatic slide show"}
                className="flex size-10 items-center justify-center rounded-full border border-white/40 text-white outline-none transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white"
              >
                {userPaused || reduceMotion ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}
              </button>
              <button
                type="button"
                onClick={() => go(index - 1)}
                aria-label="Previous banner"
                className="flex size-10 items-center justify-center rounded-full border border-white/40 text-white outline-none transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white"
              >
                <ChevronLeft className="size-5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => go(index + 1)}
                aria-label="Next banner"
                className="flex size-10 items-center justify-center rounded-full border border-white/40 text-white outline-none transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white"
              >
                <ChevronRight className="size-5" aria-hidden />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
