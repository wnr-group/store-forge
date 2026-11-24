import { formatMoney } from "@/lib/money";

/** Display helpers for the platform screens. Dates come from the API as ISO strings; amounts as integer minor units. */
const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const dateTimeFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });

export const shortDate = (iso: string | null | undefined): string => (iso ? dateFmt.format(new Date(iso)) : "—");
/** UTC, because the API stores and filters in UTC; the label says so wherever the time of day matters. */
export const dateTime = (iso: string | null | undefined): string => (iso ? `${dateTimeFmt.format(new Date(iso))} UTC` : "—");

export const money = (minor: number, currency: string): string => formatMoney(minor, currency);

/** "₹1,200.00" or, for several currencies, "₹1,200.00 + $40.00". Nothing at all is "—", never a made-up zero. */
export const moneyList = (amounts: { currency: string; amountMinor: number }[]): string =>
  amounts.length === 0 ? "—" : amounts.map((a) => formatMoney(a.amountMinor, a.currency)).join(" + ");

export const plural = (n: number, one: string, many = `${one}s`): string => `${n.toLocaleString("en-IN")} ${n === 1 ? one : many}`;

/** "5 minutes", "3 hours", "2 days": how often a job is meant to run. */
export function everyText(minutes: number): string {
  if (minutes % (24 * 60) === 0) return minutes === 24 * 60 ? "day" : `${minutes / (24 * 60)} days`;
  if (minutes % 60 === 0) return minutes === 60 ? "hour" : `${minutes / 60} hours`;
  return `${minutes} minutes`;
}

export function uptimeText(seconds: number): string {
  if (seconds < 90) return `${seconds} seconds`;
  if (seconds < 5400) return `${Math.round(seconds / 60)} minutes`;
  if (seconds < 172_800) return `${Math.round(seconds / 3600)} hours`;
  return `${Math.round(seconds / 86_400)} days`;
}
