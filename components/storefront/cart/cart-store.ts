import { emptyCart, parseCart, serializeCart, storageKey, type Cart } from "@/lib/cart/cart";
import { createBrowserStore } from "../browser-store";

/** The bag's storage: the shared browser store under this store's cart key. */
export type CartStore = {
  read: () => string | null;
  write: (cart: Cart) => void;
  subscribe: (listener: () => void) => () => void;
};

export function createCartStore(storeSlug: string, persist: boolean): CartStore {
  const raw = createBrowserStore(storageKey(storeSlug), persist);
  return {
    read: raw.read,
    write: (cart) => raw.write(cart.lines.length === 0 ? null : serializeCart(cart)),
    subscribe: raw.subscribe,
  };
}

export const parseSnapshot = (raw: string | null): Cart => (raw ? parseCart(raw) : emptyCart());
