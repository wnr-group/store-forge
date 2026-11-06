import { publicImageUrl } from "@/lib/storage/paths";
import { ACCENT_COLOR_PATTERN } from "@/lib/validations/templates";
import { DEFAULT_TEMPLATE_KEY, isTemplateKey, type TemplateKey } from "./registry";
import type { PublicTemplate, ResolvedTemplateSettings, SavedTemplateSettings, StorefrontData } from "./types";

/** Unknown, removed or missing keys render the default template. */
export function resolveTemplateKey(key: string | null | undefined): TemplateKey {
  return isTemplateKey(key) ? key : DEFAULT_TEMPLATE_KEY;
}

const clean = (v: string | null | undefined) => {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
};

/**
 * Applies the fallbacks, so an unconfigured store renders exactly as before. The accent color is
 * re-checked here because unsaved preview values never went through the server schema.
 */
export function resolveTemplateSettings(
  store: Pick<StorefrontData, "name" | "description">,
  saved: Omit<SavedTemplateSettings, "templateKey"> | null,
): ResolvedTemplateSettings {
  const accent = saved?.accentColor ?? "";
  return {
    accentColor: ACCENT_COLOR_PATTERN.test(accent) ? accent.toLowerCase() : null,
    heading: clean(saved?.heroHeading) ?? store.name,
    subheading: clean(saved?.heroSubheading) ?? store.description,
    heroImageUrl: publicImageUrl(saved?.heroImagePath),
  };
}

export function savedFromPublic(t: PublicTemplate | null | undefined): SavedTemplateSettings | null {
  return t
    ? { templateKey: t.key, accentColor: t.accent_color, heroHeading: t.hero_heading, heroSubheading: t.hero_subheading, heroImagePath: t.hero_image_path }
    : null;
}
