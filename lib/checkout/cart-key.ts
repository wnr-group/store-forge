/**
 * The random id a browser keeps for its cart, so the store can save that one cart for recovery (and mark it bought) without ever
 * knowing who holds it. The API stores only a hash of it: whoever knows it can refresh that one cart, so it stays in this browser.
 * Also the little the checkout keeps after someone follows a recovery link, so their email and name are already filled in.
 */
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const KEY_PREFIX = "sf-cart-key:v1:";
const PREFILL_PREFIX = "sf-checkout-prefill:v1:";
const ALPHABET = /^[A-Za-z0-9_-]{16,128}$/;
/** Used when storage is blocked, so the same page visit still keeps one key. */
const memory = new Map<string, string>();

export const cartKeyStorageKey = (storeSlug: string) => `${KEY_PREFIX}${storeSlug}`;

/** 24 random bytes as URL-safe text (32 characters). */
export function newCartKey(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  const bytes = random(24);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** The cart id of this store in this browser: the saved one, or a new one that is saved now. A damaged saved value is replaced. */
export function getCartKey(storeSlug: string, storage: Store | null, make: () => string = newCartKey): string {
  const key = cartKeyStorageKey(storeSlug);
  try {
    const saved = storage?.getItem(key) ?? memory.get(key) ?? null;
    if (saved && ALPHABET.test(saved)) return saved;
  } catch {
    const saved = memory.get(key);
    if (saved && ALPHABET.test(saved)) return saved;
  }
  const fresh = make();
  memory.set(key, fresh);
  try {
    storage?.setItem(key, fresh);
  } catch {
    // Blocked or full: the in-memory copy keeps this visit consistent.
  }
  return fresh;
}

/** After an order is placed the cart is a new one: forget the id so the next bag starts a new saved cart. */
export function clearCartKey(storeSlug: string, storage: Store | null): void {
  const key = cartKeyStorageKey(storeSlug);
  memory.delete(key);
  try {
    storage?.removeItem(key);
  } catch {
    // Nothing to do.
  }
}

export type Prefill = { email: string | null; fullName: string | null };

export const prefillKey = (storeSlug: string) => `${PREFILL_PREFIX}${storeSlug}`;

export function savePrefill(storeSlug: string, value: Prefill, storage: Pick<Storage, "setItem"> | null): void {
  try {
    storage?.setItem(prefillKey(storeSlug), JSON.stringify(value));
  } catch {
    // Not remembered: the shopper types it again.
  }
}

/** Reads and forgets what a recovery link saved. Anything that is not exactly the expected shape is ignored. */
export function takePrefill(storeSlug: string, storage: Pick<Storage, "getItem" | "removeItem"> | null): Prefill | null {
  try {
    const raw = storage?.getItem(prefillKey(storeSlug));
    if (!raw) return null;
    storage?.removeItem(prefillKey(storeSlug));
    const data = JSON.parse(raw) as unknown;
    if (typeof data !== "object" || data === null) return null;
    const { email, fullName } = data as Record<string, unknown>;
    return {
      email: typeof email === "string" && email.length <= 254 ? email : null,
      fullName: typeof fullName === "string" && fullName.length <= 120 ? fullName : null,
    };
  } catch {
    return null;
  }
}
