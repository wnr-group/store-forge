"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { btnAccent, WRAP } from "./ui";

export type MarketSlide = { id: string; src: string | null; alt: string; heading: string; subheading: string; buttonLabel: string; href: string };

const SLIDE_MS = 6500;

/**
 * Market hero: one rounded banner on a deep teal gradient with faint rings (or the slide's picture under a dark fade), an
 * orange label, a big white headline, a line of text and two buttons. More than one slide rotates and shows dots; it pauses
 * on hover and never moves for visitors who prefer reduced motion.
 */
export function MarketHeroBanner({ slides, eyebrow, ctas, sfProps }: { slides: MarketSlide[]; eyebrow: string; ctas: React.ReactNode; sfProps?: { "data-sf-section"?: string } }) {
  const count = slides.length;
  const [index, setIndex] = useState(0);
  const [hover, setHover] = useState(false);

  useEffect(() => {
    if (count < 2 || hover || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setTimeout(() => setIndex((i) => (i + 1) % count), SLIDE_MS);
    return () => window.clearTimeout(t);
  }, [count, hover, index]);

  const slide = slides[index];
  return (
    <section aria-roledescription="carousel" aria-label="Featured" className={cn(WRAP, "pb-2 pt-4")} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} {...sfProps}>
      <div className="relative isolate overflow-hidden rounded-xl bg-[linear-gradient(115deg,var(--primary)_0%,color-mix(in_srgb,var(--secondary)_55%,var(--primary))_52%,var(--secondary)_100%)]">
        {slides.map((s, i) =>
          s.src ? (
            <Image key={s.id} src={s.src} alt={i === index ? s.alt : ""} aria-hidden={i !== index} fill priority={i === 0} sizes="100vw" className={cn("-z-20 object-cover object-[70%_center] transition-opacity duration-700 motion-reduce:transition-none", i === index ? "opacity-100" : "opacity-0")} />
          ) : null,
        )}
        {slide.src ? <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,var(--primary)_0%,color-mix(in_srgb,var(--primary)_80%,transparent)_45%,transparent_100%)] max-sm:bg-primary/65" /> : null}
        {/* Faint rings, as on the marketplace hero; hidden behind a real picture. */}
        {!slide.src ? (
          <svg aria-hidden viewBox="0 0 1200 420" preserveAspectRatio="xMaxYMid slice" className="absolute inset-0 -z-10 size-full">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <circle key={i} cx="880" cy="200" r={60 + i * 46} fill="none" stroke="#fff" strokeOpacity={0.14 - i * 0.018} strokeWidth="2" />
            ))}
            <path d="M0 420 L360 150 L560 300 L820 90 L1200 340 V420 Z" fill="#fff" opacity="0.05" />
          </svg>
        ) : null}

        <div key={slide.id} className="max-w-2xl animate-in fade-in slide-in-from-bottom-2 px-6 py-10 duration-500 motion-reduce:animate-none sm:px-10 sm:py-14">
          <span className="inline-flex items-center rounded-md border border-accent/60 bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">{eyebrow}</span>
          <h1 className="mt-3 text-balance text-3xl font-extrabold leading-[1.08] text-white sm:text-[42px]" style={{ fontFamily: "var(--sf-font-heading)" }}>
            {slide.heading}
          </h1>
          {slide.subheading ? <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/75 sm:text-base">{slide.subheading}</p> : null}
          <div className="mt-5 flex flex-wrap items-center gap-2.5 [&>div]:pt-0 [&_a]:h-11 [&_a]:rounded-lg [&_a]:border [&_a]:border-white/25 [&_a]:bg-white/10 [&_a]:px-5 [&_a]:text-[15px] [&_a]:font-semibold [&_a]:text-white [&_a]:shadow-none [&_a:hover]:bg-white/20">
            {slide.buttonLabel ? (
              <Link href={slide.href || "/products"} className={cn(btnAccent("lg"), "!border-black/10 !bg-accent !text-accent-foreground hover:!bg-accent hover:brightness-95")}>
                {slide.buttonLabel}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            ) : null}
            {ctas}
          </div>
        </div>

        {count > 1 ? (
          <div className="absolute bottom-3 right-4 flex items-center gap-1.5">
            {slides.map((s, i) => (
              <button key={s.id} type="button" onClick={() => setIndex(i)} aria-label={`Show slide ${i + 1} of ${count}`} aria-current={i === index} className={cn("h-1.5 rounded-full transition-all duration-300", i === index ? "w-6 bg-white" : "w-1.5 bg-white/40 hover:bg-white/70")} />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
