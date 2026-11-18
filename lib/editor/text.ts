import { z } from "zod";

/**
 * Text overrides: replacements for words a theme writes into its own components (menu labels, footer lines, "Add to bag",
 * filter titles ...) that have no setting of their own. Stored on a section as `settings._text`, a list of
 * `{ from, to }`: every piece of text in that section that is exactly `from` is shown as `to`. Plain text only; the page
 * receives it as a text node, never as markup.
 */

export const TEXT_SETTING_KEY = "_text";
export const MAX_TEXT_OVERRIDES = 60;
export const MAX_TEXT_LENGTH = 300;

export const textOverridesSchema = z
  .array(z.object({ from: z.string().min(1).max(MAX_TEXT_LENGTH), to: z.string().max(MAX_TEXT_LENGTH) }).strict())
  .max(MAX_TEXT_OVERRIDES)
  .refine((list) => new Set(list.map((o) => o.from)).size === list.length, "Each text can be replaced once");

export type TextOverride = { from: string; to: string };

export const collapseText = (s: string) => s.replace(/\s+/g, " ").trim();

export function readTextOverrides(settings: Record<string, unknown> | undefined): TextOverride[] {
  const parsed = textOverridesSchema.safeParse(settings?.[TEXT_SETTING_KEY]);
  return parsed.success ? parsed.data : [];
}

/** The list with `from` replaced by `to`. An empty `to`-less call (`undefined`) or `to === from` removes the entry. */
export function withTextOverride(list: readonly TextOverride[], from: string, to: string | undefined): TextOverride[] {
  const key = collapseText(from);
  const rest = list.filter((o) => o.from !== key);
  if (to === undefined || collapseText(to) === key) return rest;
  return [...rest, { from: key, to: to.slice(0, MAX_TEXT_LENGTH) }];
}

/** What a replaced word was originally: the entry whose `to` (or `from`) is the text the merchant clicked. */
export function originalOf(list: readonly TextOverride[], shown: string): string {
  const s = collapseText(shown);
  return list.find((o) => collapseText(o.to) === s)?.from ?? s;
}

export const hasTextOverrides = (settings: Record<string, unknown> | undefined) => readTextOverrides(settings).length > 0;
