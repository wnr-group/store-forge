/**
 * What the storefront tells an analytics provider, in the store's own terms, and how that becomes Google Analytics 4 events.
 * Pure functions: no browser, no storage, so every rule here is testable.
 *
 * Money in the store is integer paise; GA4 wants the amount in rupees (a number with at most two decimals).
 * Product ids are the product URL handle everywhere (view, bag, checkout, purchase), so one product is one row in the reports.
 */
export type TrackItem = {
  /** The product URL handle. */
  id: string;
  name: string;
  /** Text like "S / Oat" for a variant. */
  variant?: string | null;
  /** Price of ONE unit, in paise. */
  priceMinor: number;
  quantity: number;
};

export type TrackEvent =
  | { type: "page_view"; path: string; title?: string }
  | { type: "view_item"; currency: string; items: TrackItem[] }
  | { type: "add_to_cart"; currency: string; items: TrackItem[] }
  | { type: "begin_checkout"; currency: string; items: TrackItem[]; couponCode?: string | null }
  | {
      type: "purchase";
      /** The order number: unique within the store, and what lets Google ignore a repeated purchase. */
      transactionId: string;
      currency: string;
      items: TrackItem[];
      discountMinor: number;
      shippingMinor: number;
      taxMinor: number;
      couponCode?: string | null;
      /** Overrides the event id Meta is given (default: `purchaseEventId(transactionId)`). */
      eventId?: string;
    };

/** GA4 accepts at most 200 items per event; a store bag holds at most 50 lines. */
const MAX_ITEMS = 50;

/** Paise to rupees, never producing floating point noise (12345 -> 123.45). */
export const toMajor = (minor: number): number => (Number.isFinite(minor) ? Math.round(minor) / 100 : 0);

const itemsValueMinor = (items: readonly TrackItem[]) => items.reduce((n, i) => n + Math.round(i.priceMinor) * i.quantity, 0);

export function ga4Items(items: readonly TrackItem[]) {
  return items.slice(0, MAX_ITEMS).map((i) => ({
    item_id: i.id,
    item_name: i.name,
    ...(i.variant ? { item_variant: i.variant } : {}),
    price: toMajor(i.priceMinor),
    quantity: i.quantity,
  }));
}

export type Ga4Event = { name: string; params: Record<string, unknown> };

/**
 * The GA4 event for `event`. `value` is the worth of the items (for a purchase: after the discount, before delivery and tax,
 * which GA4 takes as separate fields), `currency` always travels with a value, and a purchase always carries its transaction id.
 */
export function toGa4(event: TrackEvent): Ga4Event {
  switch (event.type) {
    case "page_view":
      return { name: "page_view", params: { page_path: event.path, ...(event.title ? { page_title: event.title } : {}) } };
    case "view_item":
    case "add_to_cart":
      return { name: event.type, params: { currency: event.currency, value: toMajor(itemsValueMinor(event.items)), items: ga4Items(event.items) } };
    case "begin_checkout":
      return {
        name: "begin_checkout",
        params: {
          currency: event.currency,
          value: toMajor(itemsValueMinor(event.items)),
          ...(event.couponCode ? { coupon: event.couponCode } : {}),
          items: ga4Items(event.items),
        },
      };
    case "purchase":
      return {
        name: "purchase",
        params: {
          transaction_id: event.transactionId,
          currency: event.currency,
          value: toMajor(Math.max(0, itemsValueMinor(event.items) - event.discountMinor)),
          shipping: toMajor(event.shippingMinor),
          tax: toMajor(event.taxMinor),
          ...(event.couponCode ? { coupon: event.couponCode } : {}),
          items: ga4Items(event.items),
        },
      };
  }
}

/** A Measurement ID as the API stores it; checked again in the browser before it is put into a script address. */
export const GA4_MEASUREMENT_ID = /^G-[A-Z0-9]{10}$/;

// --- Meta Pixel ---------------------------------------------------------------------------------------------------------------

/** A Meta Pixel ID as the API stores it (15 or 16 digits); checked again in the browser before it reaches a script call. */
export const META_PIXEL_ID = /^[0-9]{15,16}$/;

/**
 * The event id of a purchase. It is the same on every report of that order, from this browser now and from a server later
 * (a Conversions API call carrying this id), which is how Meta knows they are ONE purchase and counts it once.
 */
export const purchaseEventId = (transactionId: string) => `purchase_${transactionId}`;

export type MetaEvent = { name: string; params: Record<string, unknown>; eventId: string };

const metaContents = (items: readonly TrackItem[]) => items.slice(0, MAX_ITEMS).map((i) => ({ id: i.id, quantity: i.quantity, item_price: toMajor(i.priceMinor) }));

/**
 * The Meta standard event for `event`: PageView, ViewContent, AddToCart, InitiateCheckout, Purchase. `newId` makes the event id of
 * the events that have no natural one (a page view is not an order); a purchase always uses its order's id.
 */
export function toMeta(event: TrackEvent, newId: () => string): MetaEvent {
  if (event.type === "page_view") return { name: "PageView", params: {}, eventId: newId() };
  const items = event.items;
  const base = { content_type: "product", content_ids: items.slice(0, MAX_ITEMS).map((i) => i.id), contents: metaContents(items), currency: event.currency };
  switch (event.type) {
    case "view_item":
      return { name: "ViewContent", params: { ...base, ...(items.length === 1 ? { content_name: items[0].name } : {}), value: toMajor(itemsValueMinor(items)) }, eventId: newId() };
    case "add_to_cart":
      return { name: "AddToCart", params: { ...base, ...(items.length === 1 ? { content_name: items[0].name } : {}), value: toMajor(itemsValueMinor(items)) }, eventId: newId() };
    case "begin_checkout":
      return { name: "InitiateCheckout", params: { ...base, num_items: items.reduce((n, i) => n + i.quantity, 0), value: toMajor(itemsValueMinor(items)) }, eventId: newId() };
    case "purchase":
      return {
        name: "Purchase",
        params: { ...base, num_items: items.reduce((n, i) => n + i.quantity, 0), value: toMajor(Math.max(0, itemsValueMinor(items) - event.discountMinor)) },
        eventId: event.eventId ?? purchaseEventId(event.transactionId),
      };
  }
}
