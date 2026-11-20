import type { SettingDescriptor } from "./engine/descriptors";

/**
 * The parts of a product card a merchant can add or remove, like the blocks of a product card in Shopify. Each part is one
 * toggle in the settings of the section that lists products (product grid, featured collection, related products), so the
 * choice rides the normal draft / publish / version pipeline. A card draws only the parts that are on.
 */
export const CARD_PARTS = [
  { key: "image", setting: "showImage", label: "Product image", help: "The picture of the product." },
  { key: "badge", setting: "showBadge", label: "Sale and sold-out tag", help: "The small tag on the picture." },
  { key: "title", setting: "showTitle", label: "Product name", help: "The name of the product." },
  { key: "description", setting: "showDescription", label: "Short description", help: "A line of the product description." },
  { key: "price", setting: "showPrice", label: "Price", help: "What the product costs." },
  { key: "comparePrice", setting: "showComparePrice", label: "Compare-at price", help: "The struck-through old price and the discount." },
  { key: "quickAdd", setting: "showQuickAdd", label: "Quick add and wishlist", help: "The add to bag button and the heart on the picture." },
] as const;

export type CardPartKey = (typeof CARD_PARTS)[number]["key"];
export type CardParts = Record<CardPartKey, boolean>;

/** The section types whose products are drawn as cards. */
export const CARD_SECTION_TYPES: readonly string[] = ["product-grid", "featured-collection", "related-products"];

export const hasProductCards = (sectionType: string | undefined): boolean => !!sectionType && CARD_SECTION_TYPES.includes(sectionType);

/**
 * One toggle per part, for the sections above. A new section starts with every part on except the description. A section that
 * already exists has none of these stored and keeps what its card showed before this existed (`readCardParts`), so only a
 * merchant's own choice changes a card. The editor hides these from the generic settings list and shows them as the card's
 * elements instead (see CardElements).
 */
export const cardPartSettings: SettingDescriptor[] = CARD_PARTS.map((p) => ({ id: p.setting, type: "toggle", label: p.label, help: p.help, group: "card", default: p.key !== "description" }));

export const CARD_SETTING_GROUP = "card";

/**
 * Which parts the cards of a look can draw. Only the looks whose cards carry an add-to-bag button and a heart have a quick add;
 * offering it elsewhere would add a control that does nothing.
 */
export function availableCardParts(look: string | undefined): CardPartKey[] {
  const quick = look === "boutique" || look === "sport" || look === "market";
  return CARD_PARTS.map((p) => p.key).filter((k) => k !== "quickAdd" || quick);
}

/**
 * Whether a card shows its description when the merchant has not chosen. This is what the cards did before the choice existed:
 * Boutique, Sport and the Haven theme show it, the others do not. The cards pass the same answer to `readCardParts`.
 */
export function descriptionOnByDefault(look: string | undefined, home: boolean): boolean {
  return look === "boutique" || look === "sport" || (look !== "market" && home);
}

/** What a section's settings say about each part. A part the merchant never touched is on, except the description (`descriptionDefault`). */
export function readCardParts(settings: Record<string, unknown> | undefined, descriptionDefault = false): CardParts {
  const out = {} as CardParts;
  for (const p of CARD_PARTS) {
    const v = settings?.[p.setting];
    out[p.key] = typeof v === "boolean" ? v : p.key === "description" ? descriptionDefault : true;
  }
  return out;
}

/** Every part on, with the description as the card has always had it. For a card shown outside a section (the legacy markup). */
export const ALL_CARD_PARTS: CardParts = readCardParts(undefined, true);
