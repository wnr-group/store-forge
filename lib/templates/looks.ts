/**
 * Storefront looks: the one list of presentation styles a theme can choose with `settings.brand.look`.
 *
 * A theme (the data in the catalogue) says WHICH look it uses; the look (React components, see
 * `components/storefront/engine/looks`) decides HOW the sections are drawn. Every look reads the same store data and
 * the same section settings, so a new look never touches tenant data, cart or checkout code.
 *
 * This file is plain data (no React) because the theme-settings descriptors, and so the generated validation schema,
 * read it. Adding a look = one entry here + one entry in `components/storefront/engine/looks/index.ts`
 * (a unit test keeps the two lists in sync).
 */
export const LOOK_IDS = ["standard", "boutique", "sport", "market"] as const;
export type LookId = (typeof LOOK_IDS)[number];

/** `standard` draws every section with the engine's own components (and its legacy per-theme variants). */
export const DEFAULT_LOOK: LookId = "standard";

export const LOOK_LABELS: Record<LookId, string> = {
  standard: "Standard",
  boutique: "Boutique (Maison)",
  sport: "Sport (Stride)",
  market: "Market (Marketplace)",
};

/**
 * Which theme colour tints the soft panels and image wells (`--surface`, `--tint`). `auto` keeps the engine's rule (the primary
 * when it is colourful, otherwise the accent); Sport uses the secondary so its bands are a soft lavender, not yellow.
 */
export const LOOK_TINT: Record<LookId, "auto" | "secondary"> = { standard: "auto", boutique: "auto", sport: "secondary", market: "secondary" };

export function isLookId(value: unknown): value is LookId {
  return typeof value === "string" && (LOOK_IDS as readonly string[]).includes(value);
}

/**
 * The theme a look is named after in LOOK_LABELS ("Sport (Stride)" is "Stride"). The standard look has no such name: many themes
 * share it, so a published design in the standard look cannot be told apart by its look alone.
 */
export function lookThemeName(look: LookId): string | null {
  return /\(([^)]+)\)/.exec(LOOK_LABELS[look])?.[1] ?? null;
}
