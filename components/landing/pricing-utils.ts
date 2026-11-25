import { currencyDigits } from "@/lib/money";
import type { PublicPlan } from "@/services/public-plans.service";

export type Interval = "monthly" | "yearly";

/** Whole amounts without decimals (₹499), anything else with them (₹499.50). */
export function formatPrice(minor: number, currency: string) {
  const digits = currencyDigits(currency);
  const whole = minor % 10 ** digits === 0;
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, minimumFractionDigits: whole ? 0 : digits, maximumFractionDigits: digits }).format(minor / 10 ** digits);
  } catch {
    return `${(minor / 10 ** digits).toFixed(whole ? 0 : digits)} ${currency}`;
  }
}

export function formatBytes(n: number) {
  if (n >= 1024 ** 3) return `${+(n / 1024 ** 3).toFixed(1)} GB`;
  if (n >= 1024 ** 2) return `${+(n / 1024 ** 2).toFixed(1)} MB`;
  return `${n.toLocaleString("en-IN")} bytes`;
}

export const limitValue = (l: PublicPlan["limits"][number]) => (l.value === null ? "Unlimited" : l.unit === "bytes" ? formatBytes(l.value) : l.value.toLocaleString("en-IN"));

/** How much cheaper a year is than twelve months, in whole percent (0 when there is no saving or no yearly price). */
export function savingsPercent(plan: Pick<PublicPlan, "monthlyPriceMinor" | "yearlyPriceMinor">) {
  const twelve = plan.monthlyPriceMinor * 12;
  if (plan.monthlyPriceMinor <= 0 || plan.yearlyPriceMinor <= 0 || plan.yearlyPriceMinor >= twelve) return 0;
  return Math.round((1 - plan.yearlyPriceMinor / twelve) * 100);
}

/** Whether a yearly choice means anything: at least one plan has both a monthly and a yearly price. */
export const hasYearlyOption = (plans: PublicPlan[]) => plans.some((p) => p.monthlyPriceMinor > 0 && p.yearlyPriceMinor > 0);

/** A figure in minor units rounded to a whole major unit (41583 paise becomes 41600, shown as ₹416), so a monthly equivalent has no odd decimals. */
const wholeUnits = (minor: number, currency: string) => Math.round(minor / 10 ** currencyDigits(currency)) * 10 ** currencyDigits(currency);

export type PriceView = { free: boolean; amount: string; per: string; note: string | null };

/** What a plan card shows as its price for the chosen billing interval. A plan without a yearly price keeps its monthly price. */
export function priceView(plan: PublicPlan, interval: Interval): PriceView {
  const { monthlyPriceMinor: m, yearlyPriceMinor: y, currency } = plan;
  if (m === 0 && y === 0) return { free: true, amount: "Free", per: "", note: null };
  if (interval === "yearly" && y > 0) {
    return { free: false, amount: formatPrice(y, currency), per: "/ year", note: m > 0 ? `${formatPrice(wholeUnits(y / 12, currency), currency)} a month, billed yearly` : null };
  }
  if (m > 0) {
    return { free: false, amount: formatPrice(m, currency), per: "/ month", note: interval === "yearly" ? "Billed monthly" : y > 0 ? `or ${formatPrice(y, currency)} a year` : null };
  }
  return { free: false, amount: formatPrice(y, currency), per: "/ year", note: null };
}
