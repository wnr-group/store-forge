"use client";

import { useEffect, useRef, useState } from "react";
import { recoverCartAction } from "@/app/s/[slug]/cart/actions";
import { lineKey } from "@/lib/cart/cart";
import { savePrefill } from "@/lib/checkout/cart-key";
import { clearRecoveryToken, pendingRecoveryToken } from "@/lib/tracking/url-scrub";
import { useOptionalCart } from "./cart-provider";

const TOKEN = /^[A-Za-z0-9_-]{43}$/;

/** This tab's storage, or null when the browser blocks it (reading the property itself can throw). */
const tabStorage = (): Storage | null => {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

/**
 * Opened from a recovery link (`/cart?recover=TOKEN`): puts the saved items back in the bag and says so. Items the shopper already
 * has are left alone (so following the link twice never doubles a quantity), prices are today's, and anything that is no longer
 * available is named instead of silently dropped. A wrong, spent or expired link just says so and changes nothing. The email and
 * name saved with the bag are kept for the checkout form.
 */
export function CartRecovery() {
  const cart = useOptionalCart();
  const [message, setMessage] = useState<{ tone: "ok" | "problem"; text: string } | null>(null);
  const done = useRef<string | null>(null);

  const ready = cart?.ready ?? false;
  useEffect(() => {
    if (!cart || !ready) return;
    // The storefront layout already took the token out of the address (so no analytics script could report it) and kept it for this tab.
    const tab = tabStorage();
    const token = pendingRecoveryToken(tab);
    if (!token || !TOKEN.test(token) || done.current === token) return;
    done.current = token;
    clearRecoveryToken(tab);
    void recoverCartAction({ storeSlug: cart.storeSlug, token }).then((r) => {
      if (!r.ok || !r.data) {
        setMessage({ tone: "problem", text: "This link no longer works: the bag it saved has expired or already been used. Your current bag is untouched." });
        return;
      }
      const have = new Set(cart.lines.map((l) => l.key));
      let restored = 0;
      for (const l of r.data.lines) {
        if (have.has(lineKey(l.productSlug, l.variantId))) continue;
        const added = cart.add({ productSlug: l.productSlug, variantId: l.variantId, name: l.name, variantTitle: null, imagePath: null, unitPriceMinor: l.unitPriceMinor, compareAtMinor: null, quantity: l.quantity }, { openDrawer: false, silent: true });
        if (added) restored += 1;
      }
      if (r.data.email || r.data.customerName) {
        try {
          savePrefill(cart.storeSlug, { email: r.data.email, fullName: r.data.customerName }, window.localStorage);
        } catch {
          // Not remembered: the shopper types it again.
        }
      }
      const unavailable = r.data.issues.length;
      const changed = r.data.lines.filter((l) => l.priceChanged).length;
      const parts = [restored > 0 ? `Welcome back. We put ${restored === 1 ? "an item" : `${restored} items`} from your saved bag back in your bag.` : "Welcome back. Everything from your saved bag is already in your bag."];
      if (changed > 0) parts.push("Some prices have changed since you were last here.");
      if (unavailable > 0) parts.push(`${unavailable === 1 ? "One item is" : `${unavailable} items are`} no longer available and could not be added.`);
      setMessage({ tone: "ok", text: parts.join(" ") });
    });
  }, [cart, ready]);

  if (!message) return null;
  return (
    <p role="status" className={`mt-6 border bg-white px-4 py-3 text-[13px] ${message.tone === "problem" ? "border-destructive/40 text-destructive" : "border-border text-foreground"}`}>
      {message.text}
    </p>
  );
}
