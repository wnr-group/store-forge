import { themeToCssVars, type ThemeSettings } from "./theme-css";

/**
 * Turns a store's theme settings into the inline style of the storefront wrapper.
 *
 * Two kinds of variable are set, only inside the wrapper, so the dashboard and every other page keep their own look:
 *  - `--sf-*`: the validated tokens from `themeToCssVars` (page width, fonts, weights, spacing).
 *  - the app's own design tokens (`--primary`, `--background`, `--foreground`, `--border`, `--radius`...) that the
 *    sections already use through Tailwind classes such as `bg-primary`, so one theme change restyles every section.
 * Every value passes through `themeToCssVars`' checks first (hex colours, bounded numbers, closed font list), so a
 * stored document can never inject arbitrary CSS.
 */

const HEX = /^#[0-9a-f]{6}$/;

/** Black or white, whichever reads better on `hex` (WCAG relative luminance). */
export function readableOn(hex: string): string {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
  return luminance > 0.4 ? "#111111" : "#ffffff";
}

/** How colourful a hex colour is, 0 (grey/black/white) to 1. */
function chroma(hex: string): number {
  const c = [0, 1, 2].map((i) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16));
  return (Math.max(...c) - Math.min(...c)) / 255;
}

/** Darkens a hex colour by `amount` (0 to 1), for hover states. */
export function darken(hex: string, amount = 0.12): string {
  const part = (i: number) =>
    Math.round(parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) * (1 - amount))
      .toString(16)
      .padStart(2, "0");
  return `#${part(0)}${part(1)}${part(2)}`;
}

/** Accepts the stored theme document (`{ settings }`) or just its settings. */
export function themeSettingsOf(theme: unknown): ThemeSettings | null {
  if (!theme || typeof theme !== "object") return null;
  const t = theme as { settings?: unknown };
  const settings = t.settings && typeof t.settings === "object" ? t.settings : theme;
  return settings as ThemeSettings;
}

/** CSS custom properties for one element's `style`; empty when there is no usable theme. */
export function themeToStyle(theme: unknown): Record<string, string> {
  const settings = themeSettingsOf(theme);
  if (!settings) return {};
  const style: Record<string, string> = {};

  for (const line of themeToCssVars(settings).split("\n")) {
    const match = /^(--sf-[a-z-]+): (.+);$/.exec(line.trim());
    if (match) style[match[1]] = match[2];
  }

  const color = (key: string) => style[`--sf-color-${key}`];
  const set = (name: string, value: string | undefined) => {
    if (value) style[name] = value;
  };
  const primary = color("primary");
  if (primary && HEX.test(primary)) {
    set("--primary", primary);
    set("--primary-hover", darken(primary));
    set("--primary-foreground", readableOn(primary));
    set("--ring", primary);
  }
  // The colour picture placeholders are tinted with: the primary, unless that is near-black or grey, then the accent.
  const accentHex = color("accent");
  const tint = primary && HEX.test(primary) && (chroma(primary) > 0.25 || !(accentHex && HEX.test(accentHex))) ? primary : accentHex && HEX.test(accentHex) ? accentHex : primary;
  if (tint && HEX.test(tint)) set("--tint", tint);
  const secondary = color("secondary");
  if (secondary && HEX.test(secondary)) {
    set("--secondary", secondary);
    set("--secondary-foreground", readableOn(secondary));
  }
  const background = color("background");
  if (background) {
    set("--background", background);
    set("--card", background);
  }
  const text = color("text");
  if (text) {
    set("--foreground", text);
    set("--card-foreground", text);
  }
  // Neutral panels (image wells, quiet bands) are a whisper of the text colour over the background, so they stay warm on a
  // warm theme and cool on a cool one instead of the app's fixed grey.
  if (background && text) {
    set("--muted", "color-mix(in srgb, var(--foreground) 5%, var(--background))");
    set("--surface", "color-mix(in srgb, var(--tint, var(--foreground)) 7%, var(--background))");
    // Secondary text stays readable on any palette: 68% of the text colour over the background.
    set("--muted-foreground", "color-mix(in srgb, var(--foreground) 68%, var(--background))");
  } else {
    set("--muted-foreground", color("muted"));
  }
  set("--border", color("border"));
  set("--input", color("border"));
  const accent = color("accent");
  if (accent && HEX.test(accent)) {
    set("--accent", accent);
    set("--accent-foreground", readableOn(accent));
  }
  const radius = style["--sf-button-radius"];
  if (radius) set("--radius", radius);

  return style;
}

/** True when a store has a usable theme. Stores without one keep the markup of their built-in template. */
export const hasTheme = (theme: unknown): boolean => Object.keys(themeToStyle(theme)).length > 0;

/** Atelier is the only theme with serif headings and square buttons; sections use this to give it their editorial presentation. */
export function isEditorialTheme(theme: unknown): boolean {
  const ts = themeSettingsOf(theme) as { typography?: { headingFont?: string }; buttons?: { radius?: number } } | null;
  return ts?.typography?.headingFont === "system-serif" && ts?.buttons?.radius === 0;
}
