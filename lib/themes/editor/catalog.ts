import type { ThemeKind } from "@/lib/themes/types";

/**
 * Which section types a merchant may add to which document. The API enforces the same lists
 * (`src/modules/themes/validation/template-document.ts`), so keep the two in step when a new section type is added.
 */
const COMMON = [
  "hero",
  "image-banner",
  "image-with-text",
  "featured-collection",
  "collection-list",
  "product-grid",
  "promotional-banner",
  "rich-text",
  "testimonials",
  "multicolumn",
  "logo-list",
  "collapsible-content",
  "countdown",
  "trust-badges",
] as const;

const BY_KIND: Record<ThemeKind, readonly string[]> = {
  index: COMMON,
  collection: [...COMMON, "collection-banner"],
  product: [...COMMON, "related-products"],
  theme_settings: [],
  group_header: [],
  group_footer: [],
  group_announcement: [],
};

/** `main-product` and the shared header, footer and announcement are fixed parts of their pages and are not offered. */
export const sectionTypesFor = (kind: ThemeKind): readonly string[] => BY_KIND[kind];
