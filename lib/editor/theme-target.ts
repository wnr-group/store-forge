import { themeSettingDescriptors } from "@/lib/templates/registry/theme-settings";
import { THEME_TARGET_ATTR } from "./theme-target-marker";

/**
 * A theme-wide setting that something on the page stands for (the bag drawer, a product card's Add to bag button). In the editor
 * and the preview that element carries `data-sf-theme="<group>.<key>"` (see theme-target-marker.ts), and clicking it opens
 * Theme > that setting instead of a section's settings. On the live storefront the attribute is never written.
 */
export type ThemeTarget = { group: string; key: string };

/** The setting an attribute value names, only if the theme really has that setting. */
export function parseThemeTarget(value: string | null | undefined): ThemeTarget | null {
  if (!value) return null;
  const at = value.indexOf(".");
  if (at <= 0) return null;
  const group = value.slice(0, at);
  const key = value.slice(at + 1);
  return themeSettingDescriptors.some((d) => d.group === group && d.id === key) ? { group, key } : null;
}

/** The part of an element the click logic needs; a DOM `Element` satisfies it. */
export type ClickableElement = {
  closest(selector: string): ClickableElement | null;
  contains(other: unknown): boolean;
  getAttribute(name: string): string | null;
};

/**
 * The theme setting a click stands for, if any. A link or button inside the marked element keeps its own job (the drawer's close
 * button, "View bag"): only the marked element itself, or what is not a control inside it, counts.
 */
export function themeTargetAt(target: ClickableElement): ThemeTarget | null {
  const marked = target.closest(`[${THEME_TARGET_ATTR}]`);
  if (!marked) return null;
  const control = target.closest("a, button, input, select, textarea, summary");
  if (control && control !== marked && marked.contains(control)) return null;
  return parseThemeTarget(marked.getAttribute(THEME_TARGET_ATTR));
}

/** The id the settings panel gives a theme setting's field, which the jump from the preview looks for. */
export const themeFieldId = (target: ThemeTarget): string => `${target.group}.${target.key}`;
