"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { formatBagPrice } from "@/lib/cart/format";
import { publicImageUrl } from "@/lib/storage/paths";
import { cn } from "@/lib/utils";
import { useWording, useWordingMarker } from "../engine/use-wording";
import { useCart } from "./cart-provider";
import { QtyStepper } from "./qty-stepper";

const DISPLAY = { fontFamily: "var(--sf-font-heading)", fontWeight: "var(--sf-font-heading-weight, 500)" } as const;
const LABEL = "text-[11px] font-medium uppercase tracking-[0.2em]";

/** The bag drawer (slides in from the right) and the "added to your bag" toast. Rendered once per page, inside the themed wrapper. */
export function CartChrome() {
  return (
    <>
      <CartDrawer />
      <CartToast />
    </>
  );
}

function CartDrawer() {
  const cart = useCart();
  const { emptyCartTitle } = useWording();
  // Editor and preview only: a click on the open drawer jumps to Theme > Shopping wording > Empty cart title.
  const themeTarget = useWordingMarker("emptyCartTitle");
  const panel = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const { drawerOpen, closeDrawer } = cart;

  // Escape closes, focus moves into the panel and returns to what opened it, and the page behind does not scroll.
  useEffect(() => {
    if (!drawerOpen) return;
    const opener = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return closeDrawer();
      if (e.key !== "Tab" || !panel.current) return;
      const focusable = panel.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), [tabindex]:not([tabindex='-1'])");
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      opener?.focus?.();
    };
  }, [drawerOpen, closeDrawer]);

  if (!drawerOpen) return null;
  const empty = cart.lines.length === 0;

  return (
    <div className="fixed inset-0 z-[60]">
      <button type="button" aria-label="Close bag" tabIndex={-1} onClick={closeDrawer} className="absolute inset-0 cursor-default bg-primary/25 animate-in fade-in duration-300" />
      <div ref={panel} {...themeTarget} role="dialog" aria-modal="true" aria-label={`Your bag, ${cart.count} ${cart.count === 1 ? "item" : "items"}`} className="absolute inset-y-0 right-0 flex w-full max-w-[26rem] flex-col bg-white text-foreground shadow-[0_0_60px_rgba(31,28,25,0.08)] animate-in slide-in-from-right duration-300 motion-reduce:animate-none">
        <div className="flex h-[63px] shrink-0 items-center justify-between border-b border-border px-6">
          <h2 className={cn(LABEL, "text-foreground")}>Your bag ({cart.count})</h2>
          <button ref={closeButton} type="button" onClick={closeDrawer} aria-label="Close bag" className="-mr-2 flex size-9 items-center justify-center text-[color:var(--sf-color-muted)] transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
            <X className="size-4" strokeWidth={1.5} aria-hidden />
          </button>
        </div>

        {empty ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
            <p className="text-[1.75rem] leading-tight" style={DISPLAY}>
              {emptyCartTitle}
            </p>
            <Link href="/products" onClick={closeDrawer} className="inline-flex h-11 items-center rounded-full border border-border px-6 text-[14px] font-medium transition-colors hover:bg-primary hover:text-primary-foreground">
              Continue shopping
            </Link>
          </div>
        ) : (
          <>
            <ul className="min-h-0 flex-1 overflow-y-auto px-6">
              {cart.lines.map((line) => {
                const img = publicImageUrl(line.imagePath);
                return (
                  <li key={line.key} className="flex gap-4 border-b border-border/50 py-5 last:border-b-0">
                    <Link href={`/products/${line.productSlug}`} onClick={closeDrawer} className="relative block aspect-[3/4] w-20 shrink-0 overflow-hidden bg-secondary" tabIndex={-1} aria-hidden>
                      {img ? <Image src={img} alt="" fill sizes="80px" className="object-cover" /> : null}
                    </Link>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-3">
                        <Link href={`/products/${line.productSlug}`} onClick={closeDrawer} className="text-[1.0625rem] leading-[1.25] hover:underline" style={DISPLAY}>
                          {line.name}
                        </Link>
                        <p className="shrink-0 text-[14px] tabular-nums">{formatBagPrice(line.unitPriceMinor * line.quantity, cart.currency)}</p>
                      </div>
                      {line.variantTitle ? <p className="mt-1 text-[12px] text-[color:var(--sf-color-muted)]">{line.variantTitle}</p> : null}
                      <div className="mt-auto flex items-center justify-between pt-3">
                        <QtyStepper value={line.quantity} onChange={(n) => cart.setQuantity(line.key, n)} label={line.name} />
                        <button type="button" onClick={() => cart.remove(line.key)} aria-label={`Remove ${line.name}`} className="text-[11px] uppercase tracking-[0.14em] text-[color:var(--sf-color-muted)] transition-colors hover:text-foreground hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                          Remove
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="shrink-0 border-t border-border px-6 pb-6 pt-[25px]">
              <div className="flex items-baseline justify-between">
                <span className={cn(LABEL, "text-[color:var(--sf-color-muted)]")}>Subtotal</span>
                <span className="text-base tabular-nums">
                  {formatBagPrice(cart.subtotalMinor, cart.currency)}
                </span>
              </div>
              <p className="mt-2 text-[11px] leading-snug text-[color:var(--sf-color-muted)]">Delivery and GST are calculated at checkout.</p>
              <div className="mt-5 grid gap-3">
                <CheckoutButton onNavigate={closeDrawer} />
                <Link href="/cart" onClick={closeDrawer} className="flex h-[44px] items-center justify-center border border-border text-[11px] font-medium uppercase tracking-[0.15em] text-foreground transition-colors hover:border-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                  View bag
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Goes to the checkout page. In the theme editor and preview the bag is in memory only, so there the button is inert. */
export function CheckoutButton({ className, onNavigate }: { className?: string; onNavigate?: () => void }) {
  const cart = useCart();
  const base = "flex h-12 w-full items-center justify-center bg-primary text-[11px] font-[450] uppercase tracking-[0.15em] text-primary-foreground";
  if (cart.preview || cart.lines.length === 0) {
    return (
      <button type="button" disabled aria-disabled="true" title={cart.preview ? "Checkout is not available while previewing" : "Your bag is empty"} className={cn(base, "cursor-not-allowed opacity-60", className)}>
        Proceed to checkout
      </button>
    );
  }
  return (
    <Link href="/checkout" onClick={onNavigate} className={cn(base, "transition-colors hover:bg-[var(--primary-hover,var(--primary))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary", className)}>
      Proceed to checkout
    </Link>
  );
}

function CartToast() {
  const { toast, dismissToast } = useCart();
  if (!toast) return null;
  return (
    <div role="status" className="fixed bottom-6 left-4 z-[70] flex max-w-[calc(100vw-2rem)] items-center gap-3 border border-border bg-white py-2.5 pl-4 pr-3 text-[13px] text-foreground shadow-[0_0_60px_rgba(31,28,25,0.08)] animate-in fade-in slide-in-from-bottom-2 duration-300 sm:left-8">
      <Check className="size-3.5 shrink-0 text-primary" strokeWidth={1.75} aria-hidden />
      <span className="min-w-0">{toast.message}</span>
      <button type="button" onClick={dismissToast} aria-label="Dismiss" className="ml-1 flex size-6 shrink-0 items-center justify-center text-[color:var(--sf-color-muted)] hover:text-foreground">
        <X className="size-3.5" strokeWidth={1.5} aria-hidden />
      </button>
    </div>
  );
}
