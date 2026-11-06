"use client";

import { useState } from "react";
import { ArrowUpRight, Blocks, Dumbbell, Pill, Shirt, ShoppingBasket, Smartphone, Sofa, Sparkles, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CategoryImage, ImagePlaceholder } from "./category-image";

/** Icons are passed by key (a server component cannot hand a component function to a client one). */
const ICONS = { smartphone: Smartphone, shirt: Shirt, pill: Pill, sparkles: Sparkles, basket: ShoppingBasket, sofa: Sofa, dumbbell: Dumbbell, blocks: Blocks } satisfies Record<string, LucideIcon>;

export type IndustryCategory = {
  name: string;
  text: string;
  icon: keyof typeof ICONS;
  /** Leave out to show the "Image Coming Soon" placeholder. */
  image?: string;
  alt: string;
  /** Keeps the subject in frame when the photo is cropped. */
  position?: string;
  /** Only set when a real page for the category exists; the caption then links to it. */
  href?: string;
};

const pad = (n: number) => String(n).padStart(2, "0");
const EASE = "ease-[cubic-bezier(0.22,1,0.36,1)]";

/**
 * Editorial stage: a selectable list of industries, one large framed photograph with a caption card, and a thumbnail
 * strip showing every industry at once. Hover, focus or tap anywhere selects. All photographs stay mounted so
 * switching is a pure cross-fade with no network wait.
 */
export function IndustriesShowcase({ categories }: { categories: readonly IndustryCategory[] }) {
  const [active, setActive] = useState(0);
  const current = categories[active];

  return (
    <div className="rounded-[28px] border border-lp-border bg-lp-bg p-3 sm:p-5 lg:p-8">
      <div className="grid items-start gap-6 lg:grid-cols-[5fr_7fr] lg:gap-10">
        {/* Photograph, caption and thumbnails */}
        <div className="order-first lg:order-last lg:self-center">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-lp-soft shadow-[0_30px_60px_-30px_rgba(23,43,66,0.4)] ring-1 ring-lp-heading/10 lg:aspect-square">
            {categories.map((c, i) => (
              <div
                key={c.name}
                aria-hidden={i !== active}
                className={cn("absolute inset-0 transform-gpu transition-[opacity,transform] duration-[900ms] motion-reduce:transition-none", EASE, i === active ? "scale-100 opacity-100" : "pointer-events-none scale-[1.04] opacity-0")}
              >
                {c.image ? <CategoryImage src={c.image} alt={c.alt} sizes="(min-width: 1024px) 55vw, 100vw" position={c.position} priority={i === 0} /> : <ImagePlaceholder />}
              </div>
            ))}

            <div className="absolute inset-x-3 bottom-3 sm:inset-x-auto sm:bottom-5 sm:left-5 sm:max-w-xs">
              <div className="rounded-xl bg-white p-4 shadow-[0_12px_32px_-12px_rgba(23,43,66,0.35)] sm:p-5">
                <p className="text-xs font-medium tracking-wide text-lp-primary tabular-nums">
                  {pad(active + 1)} / {pad(categories.length)}
                </p>
                {/* Re-keyed so the caption eases in each time the selection changes */}
                <div key={current.name} className="animate-[lp-rise_500ms_cubic-bezier(0.22,1,0.36,1)_both] motion-reduce:animate-none">
                  <h3 className="mt-1.5 text-lg font-semibold tracking-tight text-lp-heading">{current.name}</h3>
                  <p className="mt-1 text-sm leading-5 text-lp-text">{current.text}</p>
                  {current.href ? (
                    <a href={current.href} className="mt-3 inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-lp-primary outline-none hover:text-lp-primary-hover focus-visible:ring-2 focus-visible:ring-lp-primary">
                      Explore <ArrowUpRight className="size-4" aria-hidden />
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <ul className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-8 sm:gap-2.5">
            {categories.map((c, i) => (
              <li key={c.name}>
                <button
                  type="button"
                  aria-label={c.name}
                  aria-pressed={i === active}
                  onClick={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  className={cn(
                    "relative block aspect-[4/3] w-full cursor-pointer overflow-hidden rounded-lg bg-lp-soft outline-none ring-offset-2 ring-offset-lp-bg transition-[opacity,box-shadow] duration-500 motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-lp-primary",
                    i === active ? "opacity-100 ring-2 ring-lp-primary" : "opacity-60 hover:opacity-100",
                  )}
                >
                  {c.image ? <CategoryImage src={c.image} alt="" sizes="(min-width: 640px) 8vw, 25vw" position={c.position} /> : <ImagePlaceholder compact />}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Industry list */}
        <ul className="space-y-1.5">
          {categories.map((c, i) => {
            const isActive = i === active;
            const Icon = ICONS[c.icon];
            const select = () => setActive(i);
            return (
              <li key={c.name} className="relative">
                <span aria-hidden className={cn("absolute inset-0 rounded-xl border border-lp-border bg-white shadow-sm transition-opacity duration-500 motion-reduce:transition-none", isActive ? "opacity-100" : "opacity-0")} />
                <button
                  type="button"
                  aria-pressed={isActive}
                  onMouseEnter={select}
                  onFocus={select}
                  onClick={select}
                  className="group relative flex w-full cursor-pointer items-center gap-4 rounded-xl px-4 py-3.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-lp-primary sm:py-4"
                >
                  <span
                    className={cn(
                      "grid size-11 shrink-0 place-items-center rounded-lg border transition-colors duration-500 motion-reduce:transition-none",
                      isActive ? "border-lp-primary bg-lp-primary text-white" : "border-lp-border bg-white text-lp-text group-hover:text-lp-primary",
                    )}
                  >
                    <Icon className="size-5" strokeWidth={1.75} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-lg font-semibold tracking-tight transition-colors duration-500 motion-reduce:transition-none sm:text-xl", isActive ? "text-lp-heading" : "text-lp-text group-hover:text-lp-heading")}>{c.name}</span>
                    <span className={cn("grid transition-[grid-template-rows,opacity] duration-500 motion-reduce:transition-none", EASE, isActive ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
                      <span className="overflow-hidden">
                        <span className="block pt-1 text-sm leading-5 text-lp-text">{c.text}</span>
                      </span>
                    </span>
                  </span>
                  <span className="text-xs font-medium text-lp-text/50 tabular-nums">{pad(i + 1)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
