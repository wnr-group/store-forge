/**
 * Guest cart logic. Pure functions only (no React, no storage), so the rules are easy to test.
 *
 * A cart belongs to ONE store: the browser keeps it under a key that contains the store slug, and a line only ever
 * describes a product of that store. Lines are a snapshot of what the shopper saw (name, price, picture); the server
 * action in `app/s/[slug]/cart/actions.ts` re-checks them against the store's live public products before they are
 * trusted for anything.
 */

export const MAX_LINE_QUANTITY = 10;
export const MAX_LINES = 50;
const STORAGE_PREFIX = "sf-cart:v1:";

export type CartLine = {
  /** `<productSlug>::<variantId or "-">`: one line per product and variant. */
  key: string;
  productSlug: string;
  variantId: string | null;
  name: string;
  /** Text like "S / Oat" for a variant, null for a product without variants. */
  variantTitle: string | null;
  imagePath: string | null;
  unitPriceMinor: number;
  compareAtMinor: number | null;
  quantity: number;
};

export type Cart = { lines: CartLine[] };

export const emptyCart = (): Cart => ({ lines: [] });

export const lineKey = (productSlug: string, variantId: string | null) => `${productSlug}::${variantId ?? "-"}`;
export const storageKey = (storeSlug: string) => `${STORAGE_PREFIX}${storeSlug}`;

export const clampQuantity = (n: number) => (Number.isFinite(n) ? Math.min(MAX_LINE_QUANTITY, Math.max(1, Math.trunc(n))) : 1);

export type AddInput = Omit<CartLine, "key" | "quantity"> & { quantity?: number };

export type AddResult = { cart: Cart; ok: true; line: CartLine } | { cart: Cart; ok: false; reason: "full" | "invalid" };

/** Adds to an existing line (up to the quantity cap) or starts a new one. */
export function addLine(cart: Cart, input: AddInput): AddResult {
  if (!input.productSlug || !input.name || !Number.isSafeInteger(input.unitPriceMinor) || input.unitPriceMinor < 0) {
    return { cart, ok: false, reason: "invalid" };
  }
  const key = lineKey(input.productSlug, input.variantId);
  const quantity = clampQuantity(input.quantity ?? 1);
  const existing = cart.lines.find((l) => l.key === key);
  if (existing) {
    const merged: CartLine = { ...existing, ...input, key, quantity: clampQuantity(existing.quantity + quantity) };
    return { cart: { lines: cart.lines.map((l) => (l.key === key ? merged : l)) }, ok: true, line: merged };
  }
  if (cart.lines.length >= MAX_LINES) return { cart, ok: false, reason: "full" };
  const line: CartLine = { ...input, key, quantity };
  return { cart: { lines: [...cart.lines, line] }, ok: true, line };
}

export function setQuantity(cart: Cart, key: string, quantity: number): Cart {
  if (!Number.isFinite(quantity) || quantity < 1) return removeLine(cart, key);
  return { lines: cart.lines.map((l) => (l.key === key ? { ...l, quantity: clampQuantity(quantity) } : l)) };
}

export const removeLine = (cart: Cart, key: string): Cart => ({ lines: cart.lines.filter((l) => l.key !== key) });

export const itemCount = (cart: Cart): number => cart.lines.reduce((n, l) => n + l.quantity, 0);

/** Sum of price x quantity in minor units. */
export const subtotalMinor = (cart: Cart): number => cart.lines.reduce((sum, l) => sum + l.unitPriceMinor * l.quantity, 0);

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, max: number): string | null => (typeof v === "string" && v.length > 0 && v.length <= max ? v : null);

/** Reads a stored cart. Anything malformed (hand-edited, from an older version) is dropped line by line, never trusted. */
export function parseCart(raw: string | null): Cart {
  if (!raw || raw.length > 200_000) return emptyCart();
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return emptyCart();
  }
  if (!isRecord(data) || !Array.isArray(data.lines)) return emptyCart();
  const lines: CartLine[] = [];
  const seen = new Set<string>();
  for (const item of data.lines) {
    if (!isRecord(item) || lines.length >= MAX_LINES) continue;
    const productSlug = str(item.productSlug, 200);
    const name = str(item.name, 300);
    const price = item.unitPriceMinor;
    if (!productSlug || !name || typeof price !== "number" || !Number.isSafeInteger(price) || price < 0) continue;
    const variantId = item.variantId == null ? null : str(item.variantId, 100);
    if (item.variantId != null && variantId === null) continue;
    const key = lineKey(productSlug, variantId);
    if (seen.has(key)) continue;
    seen.add(key);
    const compare = item.compareAtMinor;
    lines.push({
      key,
      productSlug,
      variantId,
      name,
      variantTitle: item.variantTitle == null ? null : str(item.variantTitle, 200),
      imagePath: item.imagePath == null ? null : str(item.imagePath, 500),
      unitPriceMinor: price,
      compareAtMinor: typeof compare === "number" && Number.isSafeInteger(compare) && compare > price ? compare : null,
      quantity: clampQuantity(typeof item.quantity === "number" ? item.quantity : 1),
    });
  }
  return { lines };
}

export const serializeCart = (cart: Cart): string => JSON.stringify({ lines: cart.lines });

/** What the server found for one cart line when it checked the store's live products. */
export type LineCheck =
  | { key: string; status: "ok"; name: string; variantTitle: string | null; imagePath: string | null; unitPriceMinor: number; compareAtMinor: number | null }
  | { key: string; status: "gone" | "unavailable" };

export type Reconciled = { cart: Cart; removed: string[]; priceChanged: string[] };

/**
 * Applies the server's check: lines whose product or variant no longer exists or can no longer be bought are removed,
 * the others take the current name, picture and price. Lines the server did not answer for are left as they are.
 */
export function reconcile(cart: Cart, checks: LineCheck[]): Reconciled {
  const byKey = new Map(checks.map((c) => [c.key, c]));
  const removed: string[] = [];
  const priceChanged: string[] = [];
  const lines: CartLine[] = [];
  for (const line of cart.lines) {
    const check = byKey.get(line.key);
    if (!check) {
      lines.push(line);
      continue;
    }
    if (check.status !== "ok") {
      removed.push(line.name);
      continue;
    }
    if (check.unitPriceMinor !== line.unitPriceMinor) priceChanged.push(check.name);
    lines.push({ ...line, name: check.name, variantTitle: check.variantTitle, imagePath: check.imagePath, unitPriceMinor: check.unitPriceMinor, compareAtMinor: check.compareAtMinor });
  }
  return { cart: { lines }, removed, priceChanged };
}
