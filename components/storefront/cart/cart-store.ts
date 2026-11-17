import { emptyCart, parseCart, serializeCart, storageKey, type Cart } from "@/lib/cart/cart";

/**
 * Where a store's cart is kept. `local` is the browser's localStorage under a per-store key (so two stores on the same
 * browser never share a cart); `memory` is used in the editor and theme preview, which must not touch a shopper's cart.
 * Both give `useSyncExternalStore` a raw string snapshot, so the server render and the first client render agree (empty).
 */
export type CartStore = {
  read: () => string | null;
  write: (cart: Cart) => void;
  subscribe: (listener: () => void) => () => void;
};

const memory = new Map<string, string>();
const memoryListeners = new Set<() => void>();

export function createCartStore(storeSlug: string, persist: boolean): CartStore {
  const key = storageKey(storeSlug);
  if (!persist) {
    return {
      read: () => memory.get(key) ?? null,
      write: (cart) => {
        memory.set(key, serializeCart(cart));
        memoryListeners.forEach((l) => l());
      },
      subscribe: (listener) => {
        memoryListeners.add(listener);
        return () => void memoryListeners.delete(listener);
      },
    };
  }
  const listeners = new Set<() => void>();
  const onStorage = (e: StorageEvent) => {
    if (e.key === key || e.key === null) listeners.forEach((l) => l());
  };
  return {
    read: () => {
      try {
        return window.localStorage.getItem(key) ?? memory.get(key) ?? null;
      } catch {
        return memory.get(key) ?? null;
      }
    },
    write: (cart) => {
      try {
        if (cart.lines.length === 0) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, serializeCart(cart));
        memory.delete(key);
      } catch {
        // Storage blocked or full: the cart then lasts only until the page closes.
        memory.set(key, serializeCart(cart));
      }
      listeners.forEach((l) => l());
    },
    subscribe: (listener) => {
      if (listeners.size === 0) window.addEventListener("storage", onStorage);
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) window.removeEventListener("storage", onStorage);
      };
    },
  };
}

export const parseSnapshot = (raw: string | null): Cart => (raw ? parseCart(raw) : emptyCart());
