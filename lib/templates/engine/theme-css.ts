import { FONT_REGISTRY, isFontKey, type FontKey } from "./fonts";
import { themeSettingDescriptors } from "../registry/theme-settings";
import type { SettingDescriptor } from "./descriptors";
import { HEX_COLOR_REGEX } from "./schema";

export interface ThemeColors {
  primary?: string;
  secondary?: string;
  background?: string;
  text?: string;
  accent?: string;
  muted?: string;
  border?: string;
}

export interface ThemeTypography {
  headingFont?: FontKey;
  bodyFont?: FontKey;
  baseSize?: number;
  headingWeight?: number;
  bodyWeight?: number;
  lineHeight?: number;
}

export interface ThemeLayout {
  pageWidth?: number;
  gridGap?: number;
}

export interface ThemeButtons {
  radius?: number;
}

export interface ThemeSettings {
  colors?: ThemeColors;
  typography?: ThemeTypography;
  layout?: ThemeLayout;
  buttons?: ThemeButtons;
  social?: Record<string, string>;
}

function cleanHex(val: unknown): string | null {
  if (typeof val !== "string") return null;
  const trimmed = val.trim();
  return HEX_COLOR_REGEX.test(trimmed) ? trimmed.toLowerCase() : null;
}

/** A finite number inside the bounds whose text is plain decimal (`1e-7` would print as exponent notation). */
function cleanNumber(val: unknown, min: number, max: number): number | null {
  if (typeof val !== "number" || !Number.isFinite(val)) return null;
  if (val < min || val > max) return null;
  return /^\d+(?:\.\d+)?$/.test(String(val)) ? val : null;
}

/** Min and max of each numeric theme descriptor, by `group.id`; built once per descriptor list. */
const boundsCache = new WeakMap<SettingDescriptor[], Map<string, readonly [number, number]>>();

function boundsOf(descriptors: SettingDescriptor[]): Map<string, readonly [number, number]> {
  let bounds = boundsCache.get(descriptors);
  if (!bounds) {
    bounds = new Map();
    for (const d of descriptors) {
      if (d.group !== undefined && d.min !== undefined && d.max !== undefined) bounds.set(`${d.group}.${d.id}`, [d.min, d.max]);
    }
    boundsCache.set(descriptors, bounds);
  }
  return bounds;
}

/**
 * Renders the CSS custom properties of a theme. The numeric bounds come from the theme setting descriptors (the single
 * source, also used to generate themeSettingsSchema); `descriptors` is injectable for tests only. A number without a
 * descriptor bound is not rendered.
 */
export function themeToCssVars(
  theme: ThemeSettings | null | undefined,
  descriptors: SettingDescriptor[] = themeSettingDescriptors,
): string {
  if (!theme || typeof theme !== "object") return "";
  const bounds = boundsOf(descriptors);
  const num = (val: unknown, key: string): number | null => {
    const range = bounds.get(key);
    return range ? cleanNumber(val, range[0], range[1]) : null;
  };

  const vars: string[] = [];

  // Colors
  if (theme.colors) {
    const p = cleanHex(theme.colors.primary);
    if (p) vars.push(`--sf-color-primary: ${p};`);

    const s = cleanHex(theme.colors.secondary);
    if (s) vars.push(`--sf-color-secondary: ${s};`);

    const bg = cleanHex(theme.colors.background);
    if (bg) vars.push(`--sf-color-background: ${bg};`);

    const txt = cleanHex(theme.colors.text);
    if (txt) vars.push(`--sf-color-text: ${txt};`);

    const acc = cleanHex(theme.colors.accent);
    if (acc) vars.push(`--sf-color-accent: ${acc};`);

    const mut = cleanHex(theme.colors.muted);
    if (mut) vars.push(`--sf-color-muted: ${mut};`);

    const bdr = cleanHex(theme.colors.border);
    if (bdr) vars.push(`--sf-color-border: ${bdr};`);
  }

  // Typography
  if (theme.typography) {
    if (theme.typography.headingFont && isFontKey(theme.typography.headingFont)) {
      vars.push(`--sf-font-heading: ${FONT_REGISTRY[theme.typography.headingFont].fontFamily};`);
    }
    if (theme.typography.bodyFont && isFontKey(theme.typography.bodyFont)) {
      vars.push(`--sf-font-body: ${FONT_REGISTRY[theme.typography.bodyFont].fontFamily};`);
    }

    const baseSize = num(theme.typography.baseSize, "typography.baseSize");
    if (baseSize) vars.push(`--sf-font-base-size: ${baseSize}px;`);

    const headingWeight = num(theme.typography.headingWeight, "typography.headingWeight");
    if (headingWeight) vars.push(`--sf-font-heading-weight: ${headingWeight};`);

    const bodyWeight = num(theme.typography.bodyWeight, "typography.bodyWeight");
    if (bodyWeight) vars.push(`--sf-font-body-weight: ${bodyWeight};`);

    const lineHeight = num(theme.typography.lineHeight, "typography.lineHeight");
    if (lineHeight) vars.push(`--sf-line-height: ${lineHeight};`);
  }

  // Layout
  if (theme.layout) {
    const pageWidth = num(theme.layout.pageWidth, "layout.pageWidth");
    if (pageWidth) vars.push(`--sf-page-width: ${pageWidth}px;`);

    const gridGap = num(theme.layout.gridGap, "layout.gridGap");
    if (gridGap !== null) vars.push(`--sf-grid-gap: ${gridGap}px;`);
  }

  // Buttons
  if (theme.buttons) {
    const radius = num(theme.buttons.radius, "buttons.radius");
    if (radius !== null) vars.push(`--sf-button-radius: ${radius}px;`);
  }

  return vars.join("\n");
}
