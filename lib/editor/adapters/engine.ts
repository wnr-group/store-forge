import type { ElementSpec, ThemeEditorAdapter } from "../adapter";
import { UNWRAPPED_SECTIONS } from "../render";
import type { CapabilityId } from "../style";

const caps = (...c: CapabilityId[]): readonly CapabilityId[] => c;

const SECTION: ElementSpec = { capabilities: caps("fonts", "background", "spacing", "size", "border", "opacity", "visibility"), textScope: false };
/** A sticky header cannot be boxed, but its fonts can change (they travel as inherited variables) and it can be hidden on a device. */
const HEADER: ElementSpec = { capabilities: caps("fonts", "visibility"), textScope: false };
/** An element a look draws itself and marks with the style hook: it can be hidden on a device, nothing else is promised. */
const HIDE_ONLY: ElementSpec = { capabilities: caps("visibility"), textScope: false };
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
  /** Sections where only some block types carry the style hook (the look draws the rest itself): section type -> those block types. */
  blockTypes?: Readonly<Record<string, readonly string[]>>;
  /** Block types a look draws itself (not through the engine) but marks with the style hook, so they can be hidden: section type -> those block types. */
  hideOnly?: Readonly<Record<string, readonly string[]>>;
  /** Block types a look accepts in a section but never draws (so the editor does not offer them there): section type -> those block types. */
  notDrawn?: Readonly<Record<string, readonly string[]>>;
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
    drawsBlock: (type, sectionType) => !config.notDrawn?.[sectionType]?.includes(type),
    section: (type) => (UNWRAPPED_SECTIONS.has(type) ? HEADER : SECTION),
    block: (type, sectionType) => {
      if (config.notDrawn?.[sectionType]?.includes(type)) return null;
      if (config.hideOnly?.[sectionType]?.includes(type)) return HIDE_ONLY;
      if (!withBlocks.has(sectionType)) return null;
      const only = config.blockTypes?.[sectionType];
      return only && !only.includes(type) ? null : (BLOCKS[type] ?? null);
    },
  };
}
