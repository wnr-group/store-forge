import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { currencyDigits } from "@/lib/money";
import { getPublicPlans, type PublicPlan } from "@/services/public-plans.service";
import { Reveal } from "./motion";
import { Container, Section, SectionHeading } from "./ui";

/** Whole amounts without decimals (₹499), anything else with them (₹499.50). */
function price(minor: number, currency: string) {
  const digits = currencyDigits(currency);
  const whole = minor % 10 ** digits === 0;
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, minimumFractionDigits: whole ? 0 : digits, maximumFractionDigits: digits }).format(minor / 10 ** digits);
  } catch {
    return `${(minor / 10 ** digits).toFixed(whole ? 0 : digits)} ${currency}`;
  }
}

function bytes(n: number) {
  if (n >= 1024 ** 3) return `${+(n / 1024 ** 3).toFixed(1)} GB`;
  if (n >= 1024 ** 2) return `${+(n / 1024 ** 2).toFixed(1)} MB`;
  return `${n.toLocaleString("en-IN")} bytes`;
}

const limitValue = (l: PublicPlan["limits"][number]) => (l.value === null ? "Unlimited" : l.unit === "bytes" ? bytes(l.value) : l.value.toLocaleString("en-IN"));

function PlanCard({ plan, index }: { plan: PublicPlan; index: number }) {
  const free = plan.monthlyPriceMinor === 0 && plan.yearlyPriceMinor === 0;
  return (
    <Reveal as="li" delay={index * 0.08} amount={0.1} className="h-full">
      <article className="flex h-full flex-col rounded-2xl border border-lp-border bg-white p-6 shadow-[0_1px_2px_rgba(8,10,37,0.04)] sm:p-7">
        <h3 className="text-xl font-semibold tracking-tight text-lp-heading">{plan.name}</h3>
        {plan.description ? <p className="mt-2 text-[15px] leading-6 text-lp-text">{plan.description}</p> : null}

        <p className="mt-6 flex items-baseline gap-1.5">
          {free ? (
            <span className="text-4xl font-extrabold tracking-tight text-lp-heading">Free</span>
          ) : (
            <>
              <span className="text-4xl font-extrabold tracking-tight text-lp-heading">{price(plan.monthlyPriceMinor, plan.currency)}</span>
              <span className="text-sm font-medium text-lp-text">/ month</span>
            </>
          )}
        </p>
        {!free && plan.yearlyPriceMinor > 0 ? <p className="mt-1 text-sm text-lp-text">or {price(plan.yearlyPriceMinor, plan.currency)} a year</p> : null}
        {plan.trialDays > 0 ? (
          <p className="mt-4 w-fit rounded-full bg-lp-secondary px-3 py-1 text-xs font-semibold text-lp-primary">{plan.trialDays}-day free trial</p>
        ) : null}

        {plan.features.length > 0 ? (
          <div className="mt-6 border-t border-lp-border pt-6">
            <h4 className="text-sm font-semibold text-lp-heading">What&apos;s included</h4>
            <ul className="mt-3 space-y-2.5">
              {plan.features.map((f) => (
                <li key={f.key} className="flex gap-2.5 text-[15px] leading-6 text-lp-text">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-lp-secondary text-lp-primary">
                    <Check className="size-3" strokeWidth={2.5} aria-hidden />
                  </span>
                  {f.label}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {plan.limits.length > 0 ? (
          <div className="mt-6 border-t border-lp-border pt-6">
            <h4 className="text-sm font-semibold text-lp-heading">Limits</h4>
            <dl className="mt-3 space-y-2 text-[15px] leading-6">
              {plan.limits.map((l) => (
                <div key={l.key} className="flex items-baseline justify-between gap-4">
                  <dt className="text-lp-text">{l.label}</dt>
                  <dd className="font-semibold text-lp-heading">{limitValue(l)}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
      </article>
    </Reveal>
  );
}

/** The plans, as cards. Presentational: it only shows what it is given and has no buttons (nothing can be bought here). */
export function PricingPlans({ plans }: { plans: PublicPlan[] }) {
  if (plans.length === 0) return null;
  const columns = plans.length === 1 ? "max-w-md" : plans.length === 2 ? "max-w-3xl lg:grid-cols-2" : plans.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2 xl:grid-cols-4";
  return (
    <Section id="plans" className="bg-lp-soft py-24 sm:py-32">
      <Container>
        <SectionHeading eyebrow="Plans" title="Plans that grow with your store" align="center">
          Compare what each plan includes and what it allows.
        </SectionHeading>
        <ul className={cn("mx-auto mt-14 grid gap-5 sm:grid-cols-2", plans.length === 1 && "sm:grid-cols-1", columns)}>
          {plans.map((p, i) => (
            <PlanCard key={p.code} plan={p} index={i} />
          ))}
        </ul>
      </Container>
    </Section>
  );
}

/** The plans an admin has published. Renders nothing when there are none (or the list cannot be loaded). */
export async function Pricing() {
  return <PricingPlans plans={await getPublicPlans()} />;
}
