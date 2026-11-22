"use client";

import { useState } from "react";
import Link from "next/link";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { RichText } from "../../richtext-renderer";
import { BAND_Y, HEADLINE_FONT, PILL_DARK, SHELL, SportEyebrow } from "./ui";

export type FaqItem = { id: string; question: string; answer: string; open: boolean };

/** Two columns: label, headline and a button on the left; ruled questions that open one at a time on the right. */
export function SportFaq({ eyebrow, heading, subheading, ctaLabel, ctaLink, items, sfProps }: { eyebrow: string; heading: string; subheading: string; ctaLabel: string; ctaLink: string; items: FaqItem[]; sfProps?: Record<string, string> }) {
  const [openId, setOpenId] = useState<string | null>(items.find((i) => i.open)?.id ?? null);
  return (
    <section {...sfProps}>
      <div className={cn(SHELL, BAND_Y, "grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-24")}>
        <div className="space-y-6">
          <SportEyebrow>{eyebrow}</SportEyebrow>
          <h2 className="text-balance text-[2rem] font-extrabold uppercase leading-[1] tracking-[-0.025em] text-primary md:text-[2.5rem] xl:text-[3rem]" style={HEADLINE_FONT}>
            {heading}
          </h2>
          {subheading ? <p className="max-w-md text-[17px] leading-8 text-foreground/75">{subheading}</p> : null}
          {ctaLabel ? (
            <Link href={ctaLink || "/contact"} className={PILL_DARK}>
              {ctaLabel}
            </Link>
          ) : null}
        </div>
        <ul className="border-t border-border">
          {items.map((item) => {
            const open = openId === item.id;
            return (
              <li key={item.id} className="border-b border-border">
                <h3>
                  <button type="button" onClick={() => setOpenId(open ? null : item.id)} aria-expanded={open} aria-controls={`faq-${item.id}`} className="flex w-full items-center justify-between gap-6 py-5 text-left text-[17px] font-bold text-primary transition-colors hover:text-secondary focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary">
                    <span>{item.question}</span>
                    {open ? <Minus className="size-5 shrink-0" strokeWidth={1.75} aria-hidden /> : <Plus className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />}
                  </button>
                </h3>
                {open ? (
                  <div id={`faq-${item.id}`} className="pb-6 pr-10 text-[16px] leading-7 text-foreground/75 animate-in fade-in duration-200">
                    <RichText content={item.answer} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
