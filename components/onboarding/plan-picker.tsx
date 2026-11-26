import Link from "next/link";
import { ROUTES } from "@/config/app";
import { priceView } from "@/components/landing/pricing-utils";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PublicPlan } from "@/services/public-plans.service";

/** The published plans as a short list. Choosing one only changes the address: nothing is bought until the payment step. */
export function PlanPicker({ plans }: { plans: PublicPlan[] }) {
  if (plans.length === 0) {
    return <p className="text-sm text-lp-text">No plans are available right now. Please try again shortly.</p>;
  }
  return (
    <ul className="space-y-3">
      {plans.map((plan) => {
        const monthly = priceView(plan, "monthly");
        const yearly = plan.monthlyPriceMinor > 0 && plan.yearlyPriceMinor > 0 ? priceView(plan, "yearly") : null;
        return (
          <li key={plan.code} className="rounded-2xl border border-lp-border bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-lp-heading">{plan.name}</h2>
                {plan.description ? <p className="mt-0.5 text-sm text-lp-text">{plan.description}</p> : null}
              </div>
              <p className="shrink-0 text-right">
                <span className="text-lg font-extrabold text-lp-heading">{monthly.amount}</span>
                {monthly.per ? <span className="ml-1 text-xs text-lp-text">{monthly.per}</span> : null}
              </p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={`${ROUTES.onboarding}?plan=${encodeURIComponent(plan.code)}&interval=monthly`}
                className={cn(buttonVariants({ size: "sm" }), "rounded-full")}
              >
                {monthly.free ? "Start free" : "Choose monthly"}
              </Link>
              {yearly ? (
                <Link
                  href={`${ROUTES.onboarding}?plan=${encodeURIComponent(plan.code)}&interval=yearly`}
                  className={cn(buttonVariants({ size: "sm", variant: "outline" }), "rounded-full")}
                >
                  Choose yearly ({yearly.amount})
                </Link>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
