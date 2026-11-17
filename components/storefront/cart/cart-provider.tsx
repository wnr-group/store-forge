"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { addLine, itemCount, reconcile, removeLine, setQuantity, subtotalMinor, type AddInput, type Cart, type CartLine, type LineCheck } from "@/lib/cart/cart";
import { checkCartAction } from "@/app/s/[slug]/cart/actions";
import { createCartStore, parseSnapshot } from "./cart-store";

export type CartToast = { id: number; message: string };

export type CartApi = {
  storeSlug: string;
  currency: string;
  lines: CartLine[];
  count: number;
  subtotalMinor: number;
  /** False until the browser's saved cart has been read, so the first paint matches the server's. */
  ready: boolean;
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  add: (input: AddInput, options?: { openDrawer?: boolean }) => boolean;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  /** Re-checks every line against the store's live products and applies the result. Null when the check could not run. */
  revalidate: () => Promise<{ removed: string[]; priceChanged: string[] } | null>;
  toast: CartToast | null;
  dismissToast: () => void;
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
  const store = useMemo(() => createCartStore(storeSlug, persist), [storeSlug, persist]);
  const raw = useSyncExternalStore(store.subscribe, store.read, () => null);
  const ready = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const cart: Cart = useMemo(() => parseSnapshot(raw), [raw]);
  const cartRef = useRef(cart);
  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

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
      cartRef.current = next;
      store.write(next);
    },
    [store],
  );

  const api = useMemo<CartApi>(
    () => ({
      storeSlug,
      currency,
      lines: cart.lines,
      count: itemCount(cart),
      subtotalMinor: subtotalMinor(cart),
      ready,
      drawerOpen,
      openDrawer: () => setDrawerOpen(true),
      closeDrawer: () => setDrawerOpen(false),
      add: (input, options) => {
        const result = addLine(cartRef.current, input);
        if (!result.ok) {
          setToast({ id: ++toastId.current, message: result.reason === "full" ? "Your bag is full" : "This item could not be added" });
          return false;
        }
        commit(result.cart);
        const label = result.line.variantTitle ? `${result.line.name} (${result.line.variantTitle})` : result.line.name;
        setToast({ id: ++toastId.current, message: `${label} added to your bag` });
        if (options?.openDrawer !== false) setDrawerOpen(true);
        return true;
      },
      setQuantity: (key, quantity) => commit(setQuantity(cartRef.current, key, quantity)),
      remove: (key) => commit(removeLine(cartRef.current, key)),
      revalidate: async () => {
        const current = cartRef.current;
        if (current.lines.length === 0) return { removed: [], priceChanged: [] };
        let checks: LineCheck[];
        try {
          checks = await checkCartAction({ storeSlug, lines: current.lines.map((l) => ({ productSlug: l.productSlug, variantId: l.variantId })) });
        } catch {
          return null;
        }
        // Lines may have changed while the check ran, so the result is applied to the cart as it is now.
        const result = reconcile(cartRef.current, checks);
        if (JSON.stringify(result.cart) !== JSON.stringify(cartRef.current)) commit(result.cart);
        return { removed: result.removed, priceChanged: result.priceChanged };
      },
      toast,
      dismissToast: () => setToast(null),
    }),
    [storeSlug, currency, cart, ready, drawerOpen, toast, commit],
  );

  return <CartContext.Provider value={api}>{children}</CartContext.Provider>;
}
