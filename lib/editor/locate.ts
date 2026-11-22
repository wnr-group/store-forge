import type { SettingDescriptor } from "@/lib/templates/engine/descriptors";

/**
 * Click-to-edit: which content setting produced the text or picture the merchant clicked in the preview. The storefront draws
 * a setting's value as plain text (or as a picture whose address contains the stored path), so an exact match is a reliable
 * pointer; when nothing matches the merchant simply gets the element's settings without a jump.
 */

const collapse = (s: string) => s.replace(/\s+/g, " ").trim();

type Candidates = { descriptors: readonly SettingDescriptor[]; settings: Record<string, unknown> | undefined }[];

/** The id of the setting whose text equals one of `texts` (innermost first) or whose picture is `image`. */
export function findSettingForClick(candidates: Candidates, click: { texts?: string[]; image?: string }): string | null {
  for (const { descriptors, settings } of candidates) {
    if (click.image) {
      for (const d of descriptors) {
        if (d.type !== "image") continue;
        const v = settings?.[d.id] as { path?: string; asset?: string } | undefined;
        const needle = v?.path ?? v?.asset;
        if (needle && click.image.includes(needle)) return d.id;
      }
    }
    for (const text of click.texts ?? []) {
      const wanted = collapse(text);
      if (!wanted) continue;
      for (const d of descriptors) {
        if (d.type !== "text" && d.type !== "textarea") continue;
        const v = settings?.[d.id] ?? d.default;
        if (typeof v === "string" && collapse(v) === wanted) return d.id;
      }
    }
  }
  return null;
}
