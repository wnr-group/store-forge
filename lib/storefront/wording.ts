/**
 * Shopping wording: the few storefront words a merchant can change for the whole store (Theme editor > Theme > Shopping wording).
 *
 * They are stored in the theme's `productCards` settings group (`settings.productCards.<key>`), the one group the API allows that
 * had no settings yet, so no backend change is needed. This file is the single place that knows the keys, the defaults, the length
 * limits and how a stored value is read. It has no imports, so the settings definitions can use it without a cycle.
 *
 * What each setting controls:
 * - `addToBagLabel`: the "Add to bag" button on the product page and on Boutique and Sport product cards. Market keeps its own
 *   "Add to cart" wording, and "Sold out" / "Select options" are not part of this.
 * - `emptyCartTitle`: the empty bag on the bag page, in the bag drawer and at checkout.
 * - `emptyCartMessage`: the line under the title on the bag page only.
 * - `emptyWishlistTitle` / `emptyWishlistMessage`: the empty wishlist page only.
 */
export const WORDING_GROUP = "productCards";

export const WORDING_KEYS = ["addToBagLabel", "emptyCartTitle", "emptyCartMessage", "emptyWishlistTitle", "emptyWishlistMessage"] as const;
export type WordingKey = (typeof WORDING_KEYS)[number];
export type Wording = Record<WordingKey, string>;

/** Exactly the words the storefront used before these settings existed. */
export const DEFAULT_WORDING: Wording = {
  addToBagLabel: "Add to bag",
  emptyCartTitle: "Your bag is empty",
  emptyCartMessage: "Pieces you add appear here, saved in this browser for this store.",
  emptyWishlistTitle: "Nothing saved yet",
  emptyWishlistMessage: "Tap the heart on any piece to keep it here, saved in this browser for this store.",
};

/** Longest value each setting accepts (a button label is short, a title is a heading, a message is a sentence or two). */
export const WORDING_MAX: Record<WordingKey, number> = {
  addToBagLabel: 30,
  emptyCartTitle: 60,
  emptyCartMessage: 160,
  emptyWishlistTitle: 60,
  emptyWishlistMessage: 160,
};

/** What the merchant sees for each setting in the Theme editor. */
export const WORDING_LABELS: Record<WordingKey, { label: string; help: string }> = {
  addToBagLabel: { label: "Add to bag label", help: "The button on product pages and on product cards. Market themes keep their own Add to cart wording." },
  emptyCartTitle: { label: "Empty cart title", help: "Shown on the bag page, in the bag drawer and at checkout when the bag is empty." },
  emptyCartMessage: { label: "Empty cart message", help: "The line under the title on the bag page." },
  emptyWishlistTitle: { label: "Empty wishlist title", help: "Shown on the wishlist page when nothing is saved." },
  emptyWishlistMessage: { label: "Empty wishlist message", help: "The line under the title on the wishlist page." },
};

/**
 * The wording of a theme: each value trimmed, and the default wherever a value is missing, blank, not text or (should a stored
 * value ever be too long, as a hand-edited document could be) cut to the limit. Accepts the stored theme document (`{ settings }`),
 * or just its settings, or nothing at all. Never throws.
 */
export function wordingOf(theme: unknown): Wording {
  const root = theme && typeof theme === "object" ? (theme as { settings?: unknown }) : undefined;
  const settings = root && root.settings && typeof root.settings === "object" ? root.settings : root;
  const group = settings && typeof settings === "object" ? (settings as Record<string, unknown>)[WORDING_GROUP] : undefined;
  const stored = group && typeof group === "object" && !Array.isArray(group) ? (group as Record<string, unknown>) : {};
  const out = { ...DEFAULT_WORDING };
  for (const key of WORDING_KEYS) {
    const value = Object.hasOwn(stored, key) ? stored[key] : undefined;
    if (typeof value !== "string") continue;
    const text = value.trim().slice(0, WORDING_MAX[key]).trim();
    if (text) out[key] = text;
  }
  return out;
}
