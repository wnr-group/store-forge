/**
 * A tiny external store over one browser storage key, for `useSyncExternalStore`. The cart and the wishlist both use it,
 * each under its own per-store key, so two stores in one browser never share data.
 *
 * `persist: false` (editor and theme preview) keeps the value in memory only, so a merchant previewing a theme never
 * touches a shopper's saved bag. A blocked or full localStorage falls back to memory for the rest of the page.
 */
export type RawStore = {
  read: () => string | null;
  /** null removes the value. */
  write: (raw: string | null) => void;
  subscribe: (listener: () => void) => () => void;
};

const memory = new Map<string, string>();
const memoryListeners = new Set<() => void>();

export function createBrowserStore(key: string, persist: boolean): RawStore {
  if (!persist) {
    return {
      read: () => memory.get(key) ?? null,
      write: (raw) => {
        if (raw === null) memory.delete(key);
        else memory.set(key, raw);
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
    write: (raw) => {
      try {
        if (raw === null) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, raw);
        memory.delete(key);
      } catch {
        if (raw === null) memory.delete(key);
        else memory.set(key, raw);
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
