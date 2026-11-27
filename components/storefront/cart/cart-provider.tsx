"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { addLine, clampQuantity, emptyCart, itemCount, reconcile, removeLine, setQuantity, subtotalMinor, type AddInput, type Cart, type CartLine, type LineCheck } from "@/lib/cart/cart";
import { checkCartAction } from "@/app/s/[slug]/cart/actions";
import { createCartStore, parseSnapshot } from "./cart-store";
import { useTracker } from "../tracking/tracking-provider";

export type CartToast = { id: number; message: string };

export type CartApi = {
  storeSlug: string;
  currency: string;
  /** True in the theme editor and theme preview, where the bag is in memory and nothing is saved. */
  preview: boolean;
  lines: CartLine[];
  count: number;
  subtotalMinor: number;
  /** False until the browser's saved cart has been read, so the first paint matches the server's. */
  ready: boolean;
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  /** `silent`: restoring a saved bag, not the shopper choosing an item now (no toast, no add-to-bag analytics event). */
  add: (input: AddInput, options?: { openDrawer?: boolean; silent?: boolean }) => boolean;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  /** Empties the bag (after an order has been placed). */
  clear: () => void;
  /** Re-checks every line against the store's live products and applies the result. Null when the check could not run. */
  revalidate: () => Promise<{ removed: string[]; priceChanged: string[] } | null>;
  toast: CartToast | null;
  dismissToast: () => void;
  /** Shows a message in the bottom-left toast (used by actions that are not an add, such as "Sold out"). */
  notify: (message: string) => void;
};

const CartContext = createContext<CartApi | null>(null);

/** The cart, or null where no cart exists (themes without one, pages outside a store). */
export const useOptionalCart = () => useContext(CartContext);

export function useCart(): CartApi {
  const cart = useContext(CartContext);
  if (!cart) throw new Error("useCart must be used inside a CartProvider");
  return cart;
}

export function CartProvider({ storeSlug, currency, persist, children }: { storeSlug: string; currency: string; persist: boolean; children: React.ReactNode }) {
  const { track } = useTracker();
  const store = useMemo(() => createCartStore(storeSlug, persist), [storeSlug, persist]);
  const raw = useSyncExternalStore(store.subscribe, store.read, () => null);
  const ready = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const cart: Cart = useMemo(() => parseSnapshot(raw), [raw]);
  // Always the saved bag as it is NOW (read from storage), never a copy kept in a ref: an effect in a child component (the bag
  // page's "check on open") can run before this provider's own effects, and a stale copy would see an empty bag.
  const current = useCallback((): Cart => parseSnapshot(store.read()), [store]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toast, setToast] = useState<CartToast | null>(null);
  const toastId = useRef(0);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast((t) => (t?.id === toast.id ? null : t)), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const commit = useCallback(
    (next: Cart) => {
      store.write(next);
    },
    [store],
  );

  const api = useMemo<CartApi>(
    () => ({
      storeSlug,
      currency,
      preview: !persist,
      lines: cart.lines,
      count: itemCount(cart),
      subtotalMinor: subtotalMinor(cart),
      ready,
      drawerOpen,
      openDrawer: () => setDrawerOpen(true),
      closeDrawer: () => setDrawerOpen(false),
      add: (input, options) => {
        const result = addLine(current(), input);
        if (!result.ok) {
          setToast({ id: ++toastId.current, message: result.reason === "full" ? "Your bag is full" : "This item could not be added" });
          return false;
        }
        commit(result.cart);
        // Analytics never sees the theme editor's or the preview's in-memory bag, and can never get in the way of adding.
        if (persist && !options?.silent) track({ type: "add_to_cart", currency, items: [{ id: result.line.productSlug, name: result.line.name, variant: result.line.variantTitle, priceMinor: result.line.unitPriceMinor, quantity: clampQuantity(input.quantity ?? 1) }] });
        const label = result.line.variantTitle ? `${result.line.name} (${result.line.variantTitle})` : result.line.name;
        if (!options?.silent) setToast({ id: ++toastId.current, message: `${label} added to your bag` });
        if (options?.openDrawer !== false && !options?.silent) setDrawerOpen(true);
        return true;
      },
      setQuantity: (key, quantity) => commit(setQuantity(current(), key, quantity)),
      remove: (key) => commit(removeLine(current(), key)),
      clear: () => commit(emptyCart()),
      revalidate: async () => {
        const before = current();
        if (before.lines.length === 0) return { removed: [], priceChanged: [] };
        let checks: LineCheck[];
        try {
          checks = await checkCartAction({ storeSlug, lines: before.lines.map((l) => ({ productSlug: l.productSlug, variantId: l.variantId })) });
        } catch {
          return null;
        }
        // Lines may have changed while the check ran, so the result is applied to the cart as it is now.
        const latest = current();
        const result = reconcile(latest, checks);
        if (JSON.stringify(result.cart) !== JSON.stringify(latest)) commit(result.cart);
        return { removed: result.removed, priceChanged: result.priceChanged };
      },
      toast,
      dismissToast: () => setToast(null),
      notify: (message) => setToast({ id: ++toastId.current, message }),
    }),
    [storeSlug, currency, persist, cart, ready, drawerOpen, toast, commit, current, track],
  );

  return <CartContext.Provider value={api}>{children}</CartContext.Provider>;
}
