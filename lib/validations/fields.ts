import { z } from "zod";

/**
 * Reusable field primitives shared by every form schema (client AND server).
 * Messages are written for merchants: they name the field and say how to fix it.
 */

/** Required text: trimmed, with a field-specific message for missing, too short and too long input. */
export const requiredText = (label: string, max: number, min = 1) =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`)
    .min(min, `${label} must be at least ${min} characters.`)
    .max(max, `${label} must be at most ${max} characters.`);

/** Optional text: trimmed; empty / missing becomes null so "no value" is stored one way only. */
export const optionalText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be at most ${max} characters.`)
    .nullish()
    .transform((v) => (v ? v : null));

export const emailField = (label = "Email address") =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .toLowerCase()
    .min(1, `${label} is required.`)
    .max(254, `${label} must be at most 254 characters.`)
    .pipe(z.email("Please enter a valid email address."));

export const optionalEmail = (label = "Email address") =>
  z
    .string()
    .trim()
    .toLowerCase()
    .max(254, `${label} must be at most 254 characters.`)
    .nullish()
    .transform((v) => (v ? v : null))
    .pipe(z.email("Please enter a valid email address.").nullable());

/** International-friendly: optional "+", digits and common separators, 7-15 digits (E.164 upper bound). */
const PHONE_CHARS = /^\+?[0-9\s().-]+$/;
export function isValidPhone(value: string): boolean {
  if (!PHONE_CHARS.test(value) || value.length > 32) return false;
  const digits = value.replace(/\D/g, "").length;
  return digits >= 7 && digits <= 15;
}
export const optionalPhone = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || isValidPhone(v), "Please enter a valid phone number, e.g. +1 415 555 0100.");

/**
 * A whole number typed into a text box. Unlike z.coerce.number() this rejects blank input
 * (which coerces to 0), "1e3", "0x10", "1.5" and other things Number() quietly accepts.
 */
export const wholeNumber = (label: string, { min = 0, max = 1_000_000 }: { min?: number; max?: number } = {}) =>
  z.union([z.string(), z.number()], { error: `${label} is required.` }).transform((raw, ctx) => {
    const text = String(raw).trim();
    const fail = (message: string) => {
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    };
    if (text === "") return fail(`${label} is required.`);
    if (!/^[+-]?\d+$/.test(text)) return fail(`${label} must be a whole number.`);
    const n = Number(text);
    if (n < min) return fail(min === 0 ? `${label} cannot be negative.` : `${label} must be at least ${min}.`);
    if (n > max) return fail(`${label} must be at most ${max.toLocaleString("en")}.`);
    return n;
  });

/** Decimal text as typed ("1,299.50") -> its numeric value, or null when it is not a plain non-negative amount. */
export function moneyValue(input: string): number | null {
  const clean = input.trim().replace(/,/g, "");
  return /^\d+(\.\d+)?$/.test(clean) ? Number(clean) : null;
}

/**
 * Money as typed by the merchant. Stays a string here; the service converts it to minor units
 * using the store currency (which decides how many decimals are allowed).
 */
export const moneyText = (label: string, { required = false, positive = false } = {}) =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .max(16, `${label} is too large.`)
    .superRefine((v, ctx) => {
      if (v === "") {
        if (required) ctx.addIssue({ code: "custom", message: `${label} is required.` });
        return;
      }
      if (v.startsWith("-")) return void ctx.addIssue({ code: "custom", message: `${label} cannot be negative.` });
      const n = moneyValue(v);
      if (n === null) return void ctx.addIssue({ code: "custom", message: `${label} must be a valid amount, e.g. 1299.50.` });
      if (positive && n <= 0) ctx.addIssue({ code: "custom", message: `${label} must be greater than zero.` });
    });

/** Empty -> null so an unset optional amount is stored one way only. */
export const optionalMoneyText = (label: string) => moneyText(label).optional().transform((v) => (v ? v : null));

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const supportedCurrencies = (() => {
  try {
    return new Set((Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf("currency"));
  } catch {
    return null;
  }
})();

export function isSupportedCurrency(code: string): boolean {
  if (!/^[A-Z]{3}$/.test(code)) return false;
  return supportedCurrencies ? supportedCurrencies.has(code) : true;
}
