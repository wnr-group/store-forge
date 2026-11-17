/**
 * Per-product presentation: the small, closed set of product-page settings an owner can change for ONE product.
 * Mirrors the API's validator (`validation/presentation-document.ts`, migration 0032): the same keys, values and limits.
 * Plain data and pure functions (no React, no server-only imports), so the storefront renderer, the editor and the
 * service layer share one definition.
 *
 * Precedence at render time: product presentation, then the page's section setting, then the descriptor default. A
 * missing key always inherits; a product without a presentation renders exactly as the page template says.
 */

export const PRESENTATION_SCHEMA_VERSION = 1;
export const GALLERY_LAYOUTS = ["thumbnails", "stacked"] as const;
export const MEDIA_POSITIONS = ["left", "right"] as const;
/** Five block types and one section type (`related-products`). Title and price can never be hidden. */
export const HIDEABLE_BLOCKS = ["product-description", "product-sku", "product-type", "product-category", "social-share", "related-products"] as const;
/** The only identifier that names a section, not a block. */
export const HIDEABLE_SECTION = "related-products";

export type GalleryLayout = (typeof GALLERY_LAYOUTS)[number];
export type MediaPosition = (typeof MEDIA_POSITIONS)[number];
export type HideableBlock = (typeof HIDEABLE_BLOCKS)[number];

export type ProductPresentation = {
  schemaVersion: typeof PRESENTATION_SCHEMA_VERSION;
  gallery?: { layout?: GalleryLayout; mediaPosition?: MediaPosition };
  focalPoint?: { x: number; y: number };
  hiddenBlocks?: HideableBlock[];
};

export const EMPTY_PRESENTATION: ProductPresentation = Object.freeze({ schemaVersion: PRESENTATION_SCHEMA_VERSION }) as ProductPresentation;

export const BLOCK_LABELS: Record<HideableBlock, string> = {
  "product-description": "Description",
  "product-sku": "SKU",
  "product-type": "Product type",
  "product-category": "Category",
  "social-share": "Share links",
  "related-products": "Related products",
};

export const PRESENTATION_MAX_BYTES = 4_096;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isGalleryLayout = (v: unknown): v is GalleryLayout => (GALLERY_LAYOUTS as readonly unknown[]).includes(v);
const isMediaPosition = (v: unknown): v is MediaPosition => (MEDIA_POSITIONS as readonly unknown[]).includes(v);
const isHideable = (v: unknown): v is HideableBlock => (HIDEABLE_BLOCKS as readonly unknown[]).includes(v);
const isPercent = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100;

/**
 * Reads a presentation from untrusted data (the public API, or a draft). Never throws and never returns anything that
 * could break a page: a value that is not an object, or has an unsupported schema version, is `null`; inside a valid
 * document every part that is wrong (an unknown layout, a focal point out of range, a block the engine cannot hide) is
 * dropped on its own and the rest still applies. Unknown keys are ignored.
 */
export function parsePresentation(input: unknown): ProductPresentation | null {
  if (!isRecord(input) || input.schemaVersion !== PRESENTATION_SCHEMA_VERSION) return null;
  const out: ProductPresentation = { schemaVersion: PRESENTATION_SCHEMA_VERSION };

  if (isRecord(input.gallery)) {
    const gallery: NonNullable<ProductPresentation["gallery"]> = {};
    if (isGalleryLayout(input.gallery.layout)) gallery.layout = input.gallery.layout;
    if (isMediaPosition(input.gallery.mediaPosition)) gallery.mediaPosition = input.gallery.mediaPosition;
    if (Object.keys(gallery).length > 0) out.gallery = gallery;
  }
  if (isRecord(input.focalPoint) && isPercent(input.focalPoint.x) && isPercent(input.focalPoint.y)) {
    out.focalPoint = { x: input.focalPoint.x, y: input.focalPoint.y };
  }
  if (Array.isArray(input.hiddenBlocks)) {
    const hidden = HIDEABLE_BLOCKS.filter((b) => (input.hiddenBlocks as unknown[]).includes(b));
    if (hidden.length > 0) out.hiddenBlocks = hidden;
  }
  return out;
}

/**
 * The one canonical form of a document: known keys only, in a fixed order, empty parts omitted, hidden blocks in the
 * catalogue order. Two documents that mean the same thing serialize identically (the database may reorder keys), which
 * is what "unsaved changes" compares.
 */
export function canonicalPresentation(input: unknown): ProductPresentation {
  return parsePresentation(input) ?? { schemaVersion: PRESENTATION_SCHEMA_VERSION };
}

export const presentationKey = (input: unknown): string => JSON.stringify(canonicalPresentation(input));

/** True when the document changes nothing (everything inherits). */
export const isEmptyPresentation = (input: unknown): boolean => presentationKey(input) === JSON.stringify(EMPTY_PRESENTATION);

/**
 * The editor's own check before saving: the API's rules, reported by field path (`gallery.layout`). Unlike
 * `parsePresentation` it rejects instead of repairing, because the merchant should see a problem, not a silent fix.
 */
export function validatePresentation(input: unknown): Record<string, string> {
  if (!isRecord(input)) return { "": "The settings are not valid." };
  const problems: Record<string, string> = {};
  for (const key of Object.keys(input)) if (!["schemaVersion", "gallery", "focalPoint", "hiddenBlocks"].includes(key)) problems[key] = "This setting is not supported.";
  if (input.schemaVersion !== PRESENTATION_SCHEMA_VERSION) problems.schemaVersion = `Schema version must be ${PRESENTATION_SCHEMA_VERSION}.`;

  if ("gallery" in input) {
    const g = input.gallery;
    if (!isRecord(g)) problems.gallery = "Must be an object.";
    else {
      for (const key of Object.keys(g)) if (!["layout", "mediaPosition"].includes(key)) problems[`gallery.${key}`] = "This setting is not supported.";
      if ("layout" in g && !isGalleryLayout(g.layout)) problems["gallery.layout"] = `Layout must be one of: ${GALLERY_LAYOUTS.join(", ")}.`;
      if ("mediaPosition" in g && !isMediaPosition(g.mediaPosition)) problems["gallery.mediaPosition"] = `Media position must be one of: ${MEDIA_POSITIONS.join(", ")}.`;
    }
  }
  if ("focalPoint" in input) {
    const f = input.focalPoint;
    if (!isRecord(f)) problems.focalPoint = "Must be an object.";
    else {
      for (const key of Object.keys(f)) if (!["x", "y"].includes(key)) problems[`focalPoint.${key}`] = "This setting is not supported.";
      for (const axis of ["x", "y"] as const) if (!isPercent(f[axis])) problems[`focalPoint.${axis}`] = `${axis} must be a number from 0 to 100.`;
    }
  }
  if ("hiddenBlocks" in input) {
    const h = input.hiddenBlocks;
    if (!Array.isArray(h)) problems.hiddenBlocks = "Must be a list.";
    else {
      const seen = new Set<unknown>();
      h.forEach((item, i) => {
        if (!isHideable(item)) problems[`hiddenBlocks[${i}]`] = "That block cannot be hidden.";
        else if (seen.has(item)) problems[`hiddenBlocks[${i}]`] = "Each block can be listed once.";
        seen.add(item);
      });
    }
  }
  try {
    if (new TextEncoder().encode(JSON.stringify(input)).length > PRESENTATION_MAX_BYTES) problems[""] = "The settings are too large.";
  } catch {
    problems[""] = "The settings are not valid.";
  }
  return problems;
}

// ---- render-time helpers ------------------------------------------------------------------------------------------

/** The presentation a product resource carries (already parsed by the service layer), or null. Safe on anything. */
export function presentationOf(resource: unknown): ProductPresentation | null {
  if (!isRecord(resource)) return null;
  return parsePresentation(resource.presentation);
}

/** Gallery layout: product override, else the section setting, else the descriptor default (`thumbnails`). */
export function effectiveGalleryLayout(sectionValue: unknown, presentation: ProductPresentation | null): GalleryLayout {
  return presentation?.gallery?.layout ?? (isGalleryLayout(sectionValue) ? sectionValue : "thumbnails");
}

/** Media position: product override, else the section setting, else the descriptor default (`left`). */
export function effectiveMediaPosition(sectionValue: unknown, presentation: ProductPresentation | null): MediaPosition {
  return presentation?.gallery?.mediaPosition ?? (isMediaPosition(sectionValue) ? sectionValue : "left");
}

/** Whether the product hides this block type (or, for `related-products`, that section). Hiding is render-time only. */
export const isHiddenFor = (presentation: ProductPresentation | null, type: string): boolean => Boolean(presentation?.hiddenBlocks?.some((b) => b === type));
