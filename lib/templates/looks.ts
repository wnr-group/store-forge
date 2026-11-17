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
export const LOOK_IDS = ["standard", "boutique"] as const;
export type LookId = (typeof LOOK_IDS)[number];

/** `standard` draws every section with the engine's own components (and its legacy per-theme variants). */
export const DEFAULT_LOOK: LookId = "standard";

export const LOOK_LABELS: Record<LookId, string> = {
  standard: "Standard",
  boutique: "Boutique (Karthika)",
};

export function isLookId(value: unknown): value is LookId {
  return typeof value === "string" && (LOOK_IDS as readonly string[]).includes(value);
}
