import type { ElementSpec, ThemeEditorAdapter } from "../adapter";
import { UNWRAPPED_SECTIONS } from "../render";
import type { CapabilityId } from "../style";

const caps = (...c: CapabilityId[]): readonly CapabilityId[] => c;

const SECTION: ElementSpec = { capabilities: caps("background", "spacing", "size", "border", "opacity", "visibility"), textScope: false };
const TEXT: ElementSpec = { capabilities: caps("typography", "textColor", "background", "spacing", "border", "opacity", "visibility"), textScope: true };
const CONTROL: ElementSpec = { capabilities: caps("typography", "textColor", "background", "spacing", "size", "border", "opacity", "visibility"), textScope: true };
const CONTAINER: ElementSpec = CONTROL;
const MEDIA: ElementSpec = { capabilities: caps("spacing", "size", "border", "opacity", "visibility"), textScope: false };
const MINIMAL: ElementSpec = { capabilities: caps("spacing", "visibility"), textScope: false };

/** What each engine block type supports. A type missing here (or null) has no style controls. */
const BLOCKS: Record<string, ElementSpec | null> = {
  heading: TEXT,
  text: TEXT,
  link: TEXT,
  "link-column": TEXT,
  "social-link": TEXT,
  "social-share": MINIMAL,
  testimonial: TEXT,
  "collapsible-item": TEXT,
  "collapsible-info": TEXT,
  "product-title": TEXT,
  "product-price": TEXT,
  "product-compare-at-price": TEXT,
  "product-sku": TEXT,
  "product-type": TEXT,
  "product-category": TEXT,
  "product-description": TEXT,
  "variant-picker": MINIMAL,
  button: CONTROL,
  image: MEDIA,
  column: CONTAINER,
  group: CONTAINER,
  // Slide data read by the hero itself, not a block drawn on its own.
  "hero-slide": null,
};

export type EngineAdapterConfig = {
  id: string;
  name: string;
  looks: readonly string[];
  /** Sections whose blocks are drawn through the engine's block renderer, so a block's style reaches the page. */
  blockSections: readonly string[];
  addableSections?: readonly string[];
};

/**
 * The adapter for any look built on the storefront engine's section and block renderers. Looks differ only in which of their
 * sections draw blocks through the engine (`blockSections`); a theme with a different component model implements
 * `ThemeEditorAdapter` directly instead.
 */
export function createEngineAdapter(config: EngineAdapterConfig): ThemeEditorAdapter {
  const withBlocks = new Set(config.blockSections);
  return {
    id: config.id,
    name: config.name,
    looks: config.looks,
    addableSections: config.addableSections,
    section: (type) => (UNWRAPPED_SECTIONS.has(type) ? null : SECTION),
    block: (type, sectionType) => (withBlocks.has(sectionType) ? (BLOCKS[type] ?? null) : null),
  };
}
