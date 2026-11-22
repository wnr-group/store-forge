import { z } from "zod";
import { partStyleSchema, type PartStyle, type PartStyleKey } from "./style";

/**
 * Text overrides: replacements for words a theme writes into its own components (menu labels, footer lines, "Add to bag",
 * filter titles ...) that have no setting of their own. Stored on a section as `settings._text`, a list of
 * `{ from, to }`: every piece of text in that section that is exactly `from` is shown as `to`. Plain text only; the page
 * receives it as a text node, never as markup. An entry may also carry a `style` (font, size, weight, colour ...) for that
 * piece of text alone; with `to` equal to `from` it changes only the look, not the words.
 */

export const TEXT_SETTING_KEY = "_text";
export const MAX_TEXT_OVERRIDES = 60;
export const MAX_TEXT_LENGTH = 300;

export const textOverridesSchema = z
  .array(z.object({ from: z.string().min(1).max(MAX_TEXT_LENGTH), to: z.string().max(MAX_TEXT_LENGTH), style: partStyleSchema.optional() }).strict())
  .max(MAX_TEXT_OVERRIDES)
  .refine((list) => new Set(list.map((o) => o.from)).size === list.length, "Each text can be replaced once");

export type TextOverride = { from: string; to: string; style?: PartStyle };

export const collapseText = (s: string) => s.replace(/\s+/g, " ").trim();

export function readTextOverrides(settings: Record<string, unknown> | undefined): TextOverride[] {
  const parsed = textOverridesSchema.safeParse(settings?.[TEXT_SETTING_KEY]);
  return parsed.success ? parsed.data : [];
}

/** Keeps an entry only while it changes something: other words, or a style. */
function normalised(from: string, to: string, style: PartStyle | undefined): TextOverride | null {
  const hasStyle = !!style && Object.keys(style).length > 0;
  if (collapseText(to) === from && !hasStyle) return null;
  return hasStyle ? { from, to, style } : { from, to };
}

/** The list with `from` shown as `to` (its style kept). `undefined` removes the entry entirely; `to === from` without a style does too. */
export function withTextOverride(list: readonly TextOverride[], from: string, to: string | undefined): TextOverride[] {
  const key = collapseText(from);
  const existing = list.find((o) => o.from === key);
  const rest = list.filter((o) => o.from !== key);
  if (to === undefined) return rest;
  const entry = normalised(key, to.slice(0, MAX_TEXT_LENGTH), existing?.style);
  return entry ? [...rest, entry] : rest;
}

/** The list with one style property of the text `from` set (or removed with `undefined`); its words are kept. */
export function withTextStyle(list: readonly TextOverride[], from: string, key: PartStyleKey, value: unknown): TextOverride[] {
  const k = collapseText(from);
  const existing = list.find((o) => o.from === k);
  const style: Record<string, unknown> = { ...(existing?.style ?? {}) };
  if (value === undefined || value === null || value === "") delete style[key];
  else style[key] = value;
  const entry = normalised(k, existing?.to ?? k, style as PartStyle);
  return [...list.filter((o) => o.from !== k), ...(entry ? [entry] : [])];
}

/** What a replaced word was originally: the entry whose `to` (or `from`) is the text the merchant clicked. */
export function originalOf(list: readonly TextOverride[], shown: string): string {
  const s = collapseText(shown);
  return list.find((o) => collapseText(o.to) === s)?.from ?? s;
}

export const hasTextOverrides = (settings: Record<string, unknown> | undefined) => readTextOverrides(settings).length > 0;
