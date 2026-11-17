import { currencyDigits } from "@/lib/money";

/** A price the way the bag shows it: no trailing ".00" on whole amounts ("₹9,800"), decimals only when there are some. */
export function formatBagPrice(minor: number, currency: string, locale = "en-IN"): string {
  const digits = currencyDigits(currency);
  const whole = minor % 10 ** digits === 0;
  const fractionDigits = whole ? 0 : digits;
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits }).format(minor / 10 ** digits);
  } catch {
    return `${(minor / 10 ** digits).toFixed(fractionDigits)} ${currency}`;
  }
}
