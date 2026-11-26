import { z } from "zod";
import { parseMoney } from "@/lib/money";

/**
 * Turns what a merchant types into what the API takes, and back. Pure functions, so the rules (percent to basis points, rupees to
 * paise, a date in the STORE's time zone to a point in time) are easy to test. The API checks every value again.
 */

// --- Time zone -----------------------------------------------------------------------------------------------------------------

const parts = (ms: number, timeZone: string) => {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { y: Number(p.year), mo: Number(p.month), d: Number(p.day), h: Number(p.hour) % 24, mi: Number(p.minute), s: Number(p.second) };
};

/** How far `timeZone` is ahead of UTC at the instant `ms`. */
const offsetMs = (ms: number, timeZone: string) => {
  const p = parts(ms, timeZone);
  return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - Math.floor(ms / 1000) * 1000;
};

const LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** "2026-11-24T18:30" typed for a store in `timeZone`, as the instant it means (ISO, UTC). Null if it is not a real date and time. */
export function zonedLocalToIso(local: string, timeZone: string): string | null {
  const m = LOCAL.exec(local);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  const check = new Date(asUtc);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d || check.getUTCHours() !== h) return null;
  try {
    // Twice, because the offset is read at the guess and a daylight-saving change can sit between the guess and the answer.
    let guess = asUtc - offsetMs(asUtc, timeZone);
    guess = asUtc - offsetMs(guess, timeZone);
    return new Date(guess).toISOString();
  } catch {
    return null;
  }
}

/** The instant `iso`, as the "YYYY-MM-DDTHH:mm" a merchant in `timeZone` would have typed. Empty for no date. */
export function isoToZonedLocal(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return "";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  try {
    const p = parts(ms, timeZone);
    const two = (n: number) => String(n).padStart(2, "0");
    return `${p.y}-${two(p.mo)}-${two(p.d)}T${two(p.h)}:${two(p.mi)}`;
  } catch {
    return "";
  }
}

// --- Numbers -------------------------------------------------------------------------------------------------------------------

/** "10" or "12.5" percent to basis points (1000, 1250). Null if it is not between 0.01 and 100 with at most two decimals. */
export function parsePercentToBps(input: string): number | null {
  const clean = input.trim().replace(/%$/, "").trim();
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(clean)) return null;
  const bps = Math.round(Number(clean) * 100);
  return bps >= 1 && bps <= 10_000 ? bps : null;
}

/** Basis points back to the text a merchant types ("10", "12.5"). */
export const bpsToPercentText = (bps: number) => String(bps / 100);

/** A whole number of at least 1, or null for empty (no limit). Returns "invalid" for anything else. */
export function parseOptionalCount(input: string, max: number): number | null | "invalid" {
  const t = input.trim();
  if (t === "") return null;
  if (!/^\d{1,9}$/.test(t)) return "invalid";
  const n = Number(t);
  return n >= 1 && n <= max ? n : "invalid";
}

// --- Discount form -------------------------------------------------------------------------------------------------------------

export type DiscountFormValues = {
  code: string;
  description: string;
  kind: "percentage" | "fixed";
  /** Percent (e.g. "10") or an amount (e.g. "250.00"), by `kind`. */
  value: string;
  minSubtotal: string;
  maxDiscount: string;
  startsAt: string;
  expiresAt: string;
  usageLimit: string;
  perCustomerLimit: string;
  appliesTo: "all" | "products" | "collections";
  productIds: string[];
  collectionIds: string[];
  campaignId: string;
  isActive: boolean;
};

export type DiscountPayload = {
  code: string;
  description: string | null;
  kind: "percentage" | "fixed";
  value: number;
  minSubtotalMinor: number;
  maxDiscountMinor: number | null;
  startsAt: string | null;
  expiresAt: string | null;
  usageLimit: number | null;
  perCustomerLimit: number | null;
  appliesTo: "all" | "products" | "collections";
  productIds: string[];
  collectionIds: string[];
  campaignId: string | null;
  isActive: boolean;
};

export const DISCOUNT_CODE = /^[A-Z0-9][A-Z0-9_-]{2,31}$/;

export type Converted<T> = { ok: true; value: T } | { ok: false; errors: Record<string, string> };

/** What the merchant typed, as the API wants it; or the message for each field that is wrong. */
export function discountFormToPayload(v: DiscountFormValues, ctx: { currency: string; timeZone: string; creating: boolean }): Converted<DiscountPayload> {
  const errors: Record<string, string> = {};
  const code = v.code.trim().toUpperCase();
  if (ctx.creating && !DISCOUNT_CODE.test(code)) errors.code = "Use 3 to 32 letters, numbers, hyphens or underscores.";

  let value = 0;
  if (v.kind === "percentage") {
    const bps = parsePercentToBps(v.value);
    if (bps === null) errors.value = "Enter a percentage between 0.01 and 100.";
    else value = bps;
  } else {
    const minor = parseMoney(v.value, ctx.currency);
    if (minor === null || minor < 1) errors.value = "Enter an amount more than zero.";
    else value = minor;
  }

  const min = v.minSubtotal.trim() === "" ? 0 : parseMoney(v.minSubtotal, ctx.currency);
  if (min === null) errors.minSubtotal = "Enter an amount, or leave it empty.";
  let max: number | null = null;
  if (v.kind === "percentage" && v.maxDiscount.trim() !== "") {
    const m = parseMoney(v.maxDiscount, ctx.currency);
    if (m === null || m < 1) errors.maxDiscount = "Enter an amount more than zero, or leave it empty.";
    else max = m;
  }

  const starts = v.startsAt ? zonedLocalToIso(v.startsAt, ctx.timeZone) : null;
  const expires = v.expiresAt ? zonedLocalToIso(v.expiresAt, ctx.timeZone) : null;
  if (v.startsAt && !starts) errors.startsAt = "Enter a real date and time.";
  if (v.expiresAt && !expires) errors.expiresAt = "Enter a real date and time.";
  if (starts && expires && Date.parse(expires) <= Date.parse(starts)) errors.expiresAt = "The expiry must be after the start.";

  const usage = parseOptionalCount(v.usageLimit, 100_000_000);
  if (usage === "invalid") errors.usageLimit = "Enter a whole number of 1 or more, or leave it empty.";
  const perCustomer = parseOptionalCount(v.perCustomerLimit, 1_000_000);
  if (perCustomer === "invalid") errors.perCustomerLimit = "Enter a whole number of 1 or more, or leave it empty.";

  if (v.appliesTo === "products" && v.productIds.length === 0) errors.productIds = "Choose at least one product.";
  if (v.appliesTo === "collections" && v.collectionIds.length === 0) errors.collectionIds = "Choose at least one collection.";
  if (v.description.length > 500) errors.description = "Keep the description under 500 characters.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      code,
      description: v.description.trim() || null,
      kind: v.kind,
      value,
      minSubtotalMinor: min as number,
      maxDiscountMinor: max,
      startsAt: starts,
      expiresAt: expires,
      usageLimit: usage as number | null,
      perCustomerLimit: perCustomer as number | null,
      appliesTo: v.appliesTo,
      productIds: v.appliesTo === "products" ? v.productIds : [],
      collectionIds: v.appliesTo === "collections" ? v.collectionIds : [],
      campaignId: v.campaignId || null,
      isActive: v.isActive,
    },
  };
}

// --- Campaign form -------------------------------------------------------------------------------------------------------------

export type CampaignFormValues = { name: string; description: string; startsAt: string; endsAt: string; productIds: string[]; collectionIds: string[]; discountIds: string[] };

export type CampaignPayload = { name: string; description: string | null; startsAt: string | null; endsAt: string | null; productIds: string[]; collectionIds: string[]; discountIds: string[] };

export function campaignFormToPayload(v: CampaignFormValues, ctx: { timeZone: string }): Converted<CampaignPayload> {
  const errors: Record<string, string> = {};
  const name = v.name.trim();
  if (!name) errors.name = "Enter a campaign name.";
  else if (name.length > 120) errors.name = "Keep the name under 120 characters.";
  if (v.description.length > 2000) errors.description = "Keep the description under 2000 characters.";
  const starts = v.startsAt ? zonedLocalToIso(v.startsAt, ctx.timeZone) : null;
  const ends = v.endsAt ? zonedLocalToIso(v.endsAt, ctx.timeZone) : null;
  if (v.startsAt && !starts) errors.startsAt = "Enter a real date and time.";
  if (v.endsAt && !ends) errors.endsAt = "Enter a real date and time.";
  if (starts && ends && Date.parse(ends) <= Date.parse(starts)) errors.endsAt = "The end must be after the start.";
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { name, description: v.description.trim() || null, startsAt: starts, endsAt: ends, productIds: v.productIds, collectionIds: v.collectionIds, discountIds: v.discountIds } };
}

// --- What the server actions accept --------------------------------------------------------------------------------------------

const ids = z.array(z.string().uuid()).max(200);
const iso = z.string().datetime({ offset: true }).nullable();

export const discountPayloadSchema = z.object({
  code: z.string().regex(DISCOUNT_CODE, "Use 3 to 32 letters, numbers, hyphens or underscores."),
  description: z.string().trim().max(500).nullable(),
  kind: z.enum(["percentage", "fixed"]),
  value: z.number().int().min(1).max(1_000_000_000),
  minSubtotalMinor: z.number().int().min(0).max(1_000_000_000),
  maxDiscountMinor: z.number().int().min(1).max(1_000_000_000).nullable(),
  startsAt: iso,
  expiresAt: iso,
  usageLimit: z.number().int().min(1).max(100_000_000).nullable(),
  perCustomerLimit: z.number().int().min(1).max(1_000_000).nullable(),
  appliesTo: z.enum(["all", "products", "collections"]),
  productIds: ids,
  collectionIds: ids,
  campaignId: z.string().uuid().nullable(),
  isActive: z.boolean(),
});

export const campaignPayloadSchema = z.object({
  name: z.string().trim().min(1, "Enter a campaign name.").max(120),
  description: z.string().trim().max(2000).nullable(),
  startsAt: iso,
  endsAt: iso,
  productIds: ids,
  collectionIds: ids,
  discountIds: ids,
});
