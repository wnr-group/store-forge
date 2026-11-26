"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PublicPlan } from "@/services/public-plans.service";
import { Reveal } from "./motion";
import { effectiveInterval, hasYearlyOption, limitValue, priceView, savingsPercent, type Interval } from "./pricing-utils";
import { Container, lpButton, Section, SectionHeading } from "./ui";

/** Features shown before "Show all": enough to compare plans at a glance, the rest one click away. */
const PREVIEW_FEATURES = 5;

function BillingToggle({ interval, onChange, saving }: { interval: Interval; onChange: (i: Interval) => void; saving: number }) {
  const option = (value: Interval, label: string) => (
    <button
      type="button"
      aria-pressed={interval === value}
      onClick={() => onChange(value)}
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-lp-primary focus-visible:ring-offset-2",
        interval === value ? "bg-lp-primary text-white" : "text-lp-text hover:text-lp-heading",
      )}
    >
      {label}
      {value === "yearly" && saving > 0 ? (
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] leading-none font-bold", interval === "yearly" ? "bg-white/20 text-white" : "bg-lp-accent/30 text-lp-heading")}>Save up to {saving}%</span>
      ) : null}
    </button>
  );
  return (
    <div role="group" aria-label="Billing period" className="mx-auto mt-8 flex w-fit rounded-full border border-lp-border bg-white p-1 shadow-[0_1px_2px_rgba(8,10,37,0.04)]">
      {option("monthly", "Monthly")}
      {option("yearly", "Yearly")}
    </div>
  );
}

function PlanCard({ plan, interval, index }: { plan: PublicPlan; interval: Interval; index: number }) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const price = priceView(plan, interval);
  const extra = plan.features.length - PREVIEW_FEATURES;
  const saving = interval === "yearly" ? savingsPercent(plan) : 0;
  return (
    <Reveal as="li" delay={index * 0.08} amount={0.1} className="w-[85%] max-w-sm shrink-0 snap-center sm:w-[22rem] sm:snap-start">
      <article className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-lp-border bg-white p-6 shadow-[0_1px_2px_rgba(8,10,37,0.04)] transition-[translate,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[0_24px_48px_-28px_rgba(8,10,37,0.35)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:p-7">
        <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-lp-cta to-lp-primary" />

        <div className="flex items-start justify-between gap-3">
          <h3 className="text-xl font-semibold tracking-tight text-lp-heading">{plan.name}</h3>
          {plan.trialDays > 0 ? <span className="shrink-0 rounded-full bg-lp-secondary px-3 py-1 text-xs font-semibold text-lp-primary">{plan.trialDays}-day free trial</span> : null}
        </div>
        {plan.description ? <p className="mt-2 min-h-12 text-[15px] leading-6 text-lp-text">{plan.description}</p> : <div className="min-h-12" />}

        <div className="mt-5 min-h-[5.5rem]">
          <p className="flex items-baseline gap-1.5">
            <span className="text-4xl font-extrabold tracking-tight text-lp-heading">{price.amount}</span>
            {price.per ? <span className="text-sm font-medium text-lp-text">{price.per}</span> : null}
          </p>
          {price.note ? (
            <p className="mt-1.5 text-sm text-lp-text">
              {price.note}
              {saving > 0 ? <span className="ml-2 rounded-full bg-lp-accent/30 px-2 py-0.5 text-xs font-bold text-lp-heading">Save {saving}%</span> : null}
            </p>
          ) : null}
        </div>

        <Link
          href={`/signup?plan=${encodeURIComponent(plan.code)}&interval=${effectiveInterval(plan, interval)}`}
          className={lpButton("primary", "mt-5 w-full")}
          aria-label={`${price.free ? "Start free with" : "Get started with"} the ${plan.name} plan`}
        >
          {price.free ? "Start free" : "Get started"}
        </Link>

        {plan.features.length > 0 ? (
          <div className="mt-5 border-t border-lp-border pt-5">
            <h4 className="text-sm font-semibold text-lp-heading">What&apos;s included</h4>
            <ul id={listId} className="mt-3 space-y-2.5">
              {plan.features.map((f, i) => (
                <li key={f.key} className={cn("flex gap-2.5 text-[15px] leading-6 text-lp-text", i >= PREVIEW_FEATURES && !open && "hidden")}>
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-lp-secondary text-lp-primary">
                    <Check className="size-3" strokeWidth={2.5} aria-hidden />
                  </span>
                  {f.label}
                </li>
              ))}
            </ul>
            {extra > 0 ? (
              <button
                type="button"
                aria-expanded={open}
                aria-controls={listId}
                onClick={() => setOpen((o) => !o)}
                className="mt-3 inline-flex items-center gap-1 rounded-md text-sm font-semibold text-lp-primary outline-none hover:text-lp-primary-hover focus-visible:ring-2 focus-visible:ring-lp-primary"
              >
                {open ? "Show fewer features" : `Show all ${plan.features.length} features`}
                <ChevronDown className={cn("size-4 transition-transform duration-200 motion-reduce:transition-none", open && "rotate-180")} aria-hidden />
              </button>
            ) : null}
          </div>
        ) : null}

        {plan.limits.length > 0 ? (
          <dl className="mt-auto grid grid-cols-2 gap-2.5 pt-6">
            {plan.limits.map((l) => (
              <div key={l.key} className="rounded-xl bg-lp-soft px-3.5 py-3">
                <dd className="text-lg leading-6 font-bold tracking-tight text-lp-heading">{limitValue(l)}</dd>
                <dt className="mt-0.5 text-xs leading-4 text-lp-text">{l.label}</dt>
              </div>
            ))}
          </dl>
        ) : null}
      </article>
    </Reveal>
  );
}

/** The plans, as cards. A card's button starts the sign-up with that plan; nothing is bought here (payment comes after the account exists). */
export function PricingPlans({ plans }: { plans: PublicPlan[] }) {
  const [billing, setBilling] = useState<Interval>("monthly");
  const scroller = useRef<HTMLUListElement>(null);
  if (plans.length === 0) return null;
  const yearly = hasYearlyOption(plans);
  const bestSaving = Math.max(0, ...plans.map(savingsPercent));
  const scrollBy = (dir: 1 | -1) => scroller.current?.scrollBy({ left: dir * 380, behavior: "smooth" });
  return (
    <Section id="plans" className="bg-lp-soft py-24 sm:py-32">
      <Container>
        <SectionHeading eyebrow="Plans" title="Plans that grow with your store" align="center">
          Compare what each plan includes and what it allows.
        </SectionHeading>
        {yearly ? <BillingToggle interval={billing} onChange={setBilling} saving={bestSaving} /> : null}
        <div className="relative mt-8">
          {plans.length > 1 ? (
            <div className="mb-2 hidden justify-end gap-2 sm:flex">
              {([-1, 1] as const).map((dir) => (
                <button
                  key={dir}
                  type="button"
                  aria-label={dir === -1 ? "Previous plans" : "Next plans"}
                  onClick={() => scrollBy(dir)}
                  className="grid size-10 place-items-center rounded-full border border-lp-border bg-white text-lp-heading transition-colors outline-none hover:bg-lp-secondary focus-visible:ring-2 focus-visible:ring-lp-primary"
                >
                  {dir === -1 ? <ChevronLeft className="size-5" aria-hidden /> : <ChevronRight className="size-5" aria-hidden />}
                </button>
              ))}
            </div>
          ) : null}
          <ul
            ref={scroller}
            aria-label="Plans"
            className="mx-auto flex w-fit max-w-full snap-x snap-mandatory items-stretch gap-5 overflow-x-auto scroll-smooth px-1 pt-2 pb-8 [scrollbar-width:thin] motion-reduce:scroll-auto"
          >
            {plans.map((p, i) => (
              <PlanCard key={p.code} plan={p} interval={yearly ? billing : "monthly"} index={i} />
            ))}
          </ul>
        </div>
      </Container>
    </Section>
  );
}
