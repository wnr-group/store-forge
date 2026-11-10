"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Wipe } from "./effects";

export type FaqItem = { q: string; a: string };

/** One question open at a time. Height animates with a 0fr to 1fr grid row, so no measuring is needed. */
export function FaqAccordion({ items }: { items: readonly FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <ul className="border-b border-lp-border">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <Wipe as="li" key={item.q} delay={i * 0.08} amount={0.3} className="border-t border-lp-border">
            <h3>
              <button
                type="button"
                id={`faq-q-${i}`}
                aria-expanded={isOpen}
                aria-controls={`faq-a-${i}`}
                onClick={() => setOpen(isOpen ? null : i)}
                className="group flex w-full items-start gap-4 py-5 text-left outline-none focus-visible:ring-2 focus-visible:ring-lp-primary focus-visible:ring-offset-2 sm:gap-6 sm:py-6"
              >
                <span className={cn("w-7 shrink-0 pt-1 text-xs font-medium tabular-nums transition-colors duration-300 motion-reduce:transition-none", isOpen ? "text-lp-primary" : "text-lp-text/60")}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className={cn(
                    "flex-1 text-[17px] leading-7 font-medium tracking-tight transition-colors duration-300 motion-reduce:transition-none sm:text-lg",
                    isOpen ? "text-lp-primary" : "text-lp-heading group-hover:text-lp-primary",
                  )}
                >
                  {item.q}
                </span>
                <span aria-hidden className={cn("relative mt-1.5 size-4 shrink-0 transition-colors duration-300 motion-reduce:transition-none", isOpen ? "text-lp-primary" : "text-lp-text group-hover:text-lp-primary")}>
                  <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-current" />
                  <span className={cn("absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-current transition-transform duration-300 ease-out motion-reduce:transition-none", isOpen && "scale-y-0")} />
                </span>
              </button>
            </h3>
            <div
              id={`faq-a-${i}`}
              role="region"
              aria-labelledby={`faq-q-${i}`}
              inert={!isOpen}
              className={cn("grid transition-[grid-template-rows,opacity] duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none", isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}
            >
              <div className="overflow-hidden">
                <p className="max-w-xl pb-6 pl-11 text-[15px] leading-7 text-lp-text sm:pl-[3.25rem] sm:text-base">{item.a}</p>
              </div>
            </div>
          </Wipe>
        );
      })}
    </ul>
  );
}
