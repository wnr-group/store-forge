"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { BillingToggle, PlanCard } from "@/components/landing/pricing-plans";
import { effectiveInterval, hasYearlyOption, savingsPercent, type Interval } from "@/components/landing/pricing-utils";
import { ROUTES } from "@/config/app";
import type { PublicPlan } from "@/services/public-plans.service";

/**
 * The published plans in a pop-up, as the same cards the landing page shows: scroll sideways, switch monthly/yearly, pick one. Choosing
 * only changes the address (nothing is bought until the payment step). There is no way to close it: a plan is the next required step,
 * and `footer` (sign out) is the way out.
 */
export function PlanPicker({ plans, footer }: { plans: PublicPlan[]; footer?: React.ReactNode }) {
  const [billing, setBilling] = useState<Interval>("monthly");
  const scroller = useRef<HTMLUListElement>(null);
  const yearly = hasYearlyOption(plans);
  const bestSaving = Math.max(0, ...plans.map(savingsPercent));
  const scrollBy = (dir: 1 | -1) => scroller.current?.scrollBy({ left: dir * 380, behavior: "smooth" });

  return (
    <DialogPrimitive.Root open modal disablePointerDismissal onOpenChange={() => {}}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 isolate z-50 bg-lp-deep/60 backdrop-blur-sm data-open:animate-in data-open:fade-in-0" />
        <DialogPrimitive.Popup className="lp-root fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] max-w-5xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-3xl bg-lp-soft text-lp-heading shadow-2xl outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95">
          <div className="shrink-0 px-5 pt-6 text-center sm:px-8 sm:pt-8">
            <DialogPrimitive.Title className="text-2xl font-extrabold tracking-tight sm:text-3xl">Choose your plan</DialogPrimitive.Title>
            <DialogPrimitive.Description className="mt-2 text-sm text-lp-text sm:text-base">
              Compare what each plan includes. You can change it later.
            </DialogPrimitive.Description>
            {yearly ? <BillingToggle interval={billing} onChange={setBilling} saving={bestSaving} /> : null}
          </div>

          {plans.length === 0 ? (
            <p className="px-6 py-16 text-center text-sm text-lp-text">No plans are available right now. Please try again shortly.</p>
          ) : (
            <div className="relative min-h-0 flex-1 overflow-y-auto px-3 pt-4 sm:px-6">
              {plans.length > 1 ? (
                <div className="mb-1 hidden justify-end gap-2 sm:flex">
                  {([-1, 1] as const).map((dir) => (
                    <button
                      key={dir}
                      type="button"
                      aria-label={dir === -1 ? "Previous plans" : "Next plans"}
                      onClick={() => scrollBy(dir)}
                      className="grid size-9 place-items-center rounded-full border border-lp-border bg-white text-lp-heading transition-colors outline-none hover:bg-lp-secondary focus-visible:ring-2 focus-visible:ring-lp-primary"
                    >
                      {dir === -1 ? <ChevronLeft className="size-5" aria-hidden /> : <ChevronRight className="size-5" aria-hidden />}
                    </button>
                  ))}
                </div>
              ) : null}
              <ul
                ref={scroller}
                aria-label="Plans"
                className="mx-auto flex w-fit max-w-full snap-x snap-mandatory items-stretch gap-4 overflow-x-auto scroll-smooth px-1 pt-2 pb-6 [scrollbar-width:thin] motion-reduce:scroll-auto"
              >
                {plans.map((p, i) => {
                  const interval = effectiveInterval(p, yearly ? billing : "monthly");
                  return (
                    <PlanCard
                      key={p.code}
                      plan={p}
                      interval={yearly ? billing : "monthly"}
                      index={i}
                      reveal={false}
                      href={`${ROUTES.onboarding}?plan=${encodeURIComponent(p.code)}&interval=${interval}`}
                      cta={p.monthlyPriceMinor === 0 && p.yearlyPriceMinor === 0 ? "Start free" : "Choose this plan"}
                    />
                  );
                })}
              </ul>
            </div>
          )}

          {footer ? <div className="shrink-0 border-t border-lp-border bg-white/60 px-5 py-2.5 text-center">{footer}</div> : null}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
