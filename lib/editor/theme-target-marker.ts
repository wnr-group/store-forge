/**
 * The attribute that marks an element on the page as standing for a theme-wide setting (the bag drawer, a product card's Add to bag
 * button). No imports, so the storefront's own components can use it without pulling the editor in; `theme-target.ts` reads it.
 */
export const THEME_TARGET_ATTR = "data-sf-theme";

/**
 * The attribute for a theme setting (`data-sf-theme="<group>.<key>"`), or none outside the editor and the preview: `mode` is the
 * render mode, and `public` (the live store) or no mode at all never gets the attribute.
 */
export function themeTargetMarker(mode: string | undefined, group: string, key: string): Record<string, string> {
  return mode === "editor" || mode === "preview" ? { [THEME_TARGET_ATTR]: `${group}.${key}` } : {};
}
