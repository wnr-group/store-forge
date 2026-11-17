"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { formatBagPrice } from "@/lib/cart/format";
import { publicImageUrl } from "@/lib/storage/paths";
import { cn } from "@/lib/utils";
import type { SectionProps } from "../engine/looks";
import { useOptionalCart } from "./cart-provider";
import { CheckoutButton } from "./cart-drawer";
import { QtyStepper } from "./qty-stepper";

const DISPLAY = { fontFamily: "var(--sf-font-heading)", fontWeight: "var(--sf-font-heading-weight, 500)" } as const;
const MUTED = "text-[color:var(--sf-color-muted)]";
const SHELL = "mx-auto w-full max-w-[var(--sf-page-width,96rem)] px-5 md:px-10";

/**
 * The bag page: breadcrumb, a large serif title under a hairline, the lines on the left and an order summary card on the
 * right (stacked on phones). Lines are the shopper's own browser cart for THIS store; on opening, they are re-checked
 * against the store's live products, so a removed product or a changed price shows up here and not at checkout.
 */
export function CartPageSection({ context, sectionId }: SectionProps) {
  const cart = useOptionalCart();
  const [notice, setNotice] = useState<string | null>(null);
  const isPreview = context.mode === "preview" || context.mode === "editor";
  const sfProps = isPreview && sectionId ? { "data-sf-section": sectionId } : {};

  const ready = cart?.ready ?? false;
  const hasLines = (cart?.lines.length ?? 0) > 0;
  const revalidate = cart?.revalidate;
  useEffect(() => {
    if (!ready || !hasLines || !revalidate || isPreview) return;
    let cancelled = false;
    void revalidate().then((result) => {
      if (cancelled || !result) return;
      const parts: string[] = [];
      if (result.removed.length > 0) parts.push(`${result.removed.join(", ")} ${result.removed.length === 1 ? "is" : "are"} no longer available and ${result.removed.length === 1 ? "was" : "were"} removed from your bag.`);
      if (result.priceChanged.length > 0) parts.push(`The price of ${result.priceChanged.join(", ")} has changed.`);
      setNotice(parts.length > 0 ? parts.join(" ") : null);
    });
    return () => {
      cancelled = true;
    };
    // Re-check once when the saved bag has been read, not on every quantity change.
  }, [ready, hasLines, revalidate, isPreview]);

  if (!cart) return null;
  const { lines } = cart;
  const currency = cart.currency;

  return (
    <section className={cn(SHELL, "pb-16 pt-8 md:pb-24 md:pt-[50px]")} {...sfProps}>
      <nav aria-label="Breadcrumb" className={cn("text-[11px] uppercase tracking-[0.16em]", MUTED)}>
        <ol className="flex items-center gap-2">
          <li>
            <Link href="/" className="transition-colors hover:text-foreground">
              Home
            </Link>
          </li>
          <li aria-hidden className="opacity-50">
            /
          </li>
          <li aria-current="page" className="text-foreground">
            Your bag
          </li>
        </ol>
      </nav>
      <h1 className="mt-6 border-b border-border pb-8 text-[2.5rem] leading-[1.05] tracking-[-0.01em] text-foreground md:mt-[30px] md:pb-10 md:text-[3.5rem]" style={DISPLAY}>
        Your bag
      </h1>

      {notice ? (
        <p role="status" className="mt-6 border border-border bg-white px-4 py-3 text-[13px] text-foreground">
          {notice}
        </p>
      ) : null}

      {!ready ? (
        <div className="grid gap-10 pt-10 md:pt-12 lg:grid-cols-[minmax(0,1fr)_25.25rem] lg:gap-16" aria-busy="true" aria-label="Loading your bag">
          <div className="h-48 animate-pulse bg-secondary/60" />
          <div className="hidden h-72 animate-pulse bg-secondary/60 lg:block" />
        </div>
      ) : lines.length === 0 ? (
        <div className="flex flex-col items-start gap-6 py-16 md:py-24">
          <p className="text-[1.75rem] leading-tight md:text-[2.25rem]" style={DISPLAY}>
            Your bag is empty
          </p>
          <p className={cn("max-w-md text-[15px] leading-7", MUTED)}>Pieces you add appear here, saved in this browser for this store.</p>
          <Link href="/products" className="inline-flex h-12 items-center rounded-full bg-primary px-7 text-[14px] font-medium text-primary-foreground transition-colors hover:bg-[var(--primary-hover,var(--primary))]">
            Continue shopping
          </Link>
        </div>
      ) : (
        <div className="grid items-start gap-10 pt-10 md:pt-12 lg:grid-cols-[minmax(0,1fr)_25.25rem] lg:gap-16">
          <div>
            <ul className="border-b border-border">
              {lines.map((line) => {
                const img = publicImageUrl(line.imagePath);
                const href = `/products/${line.productSlug}`;
                return (
                  <li key={line.key} className="flex gap-4 border-t border-border py-6 first:border-t md:gap-5 md:py-7">
                    <Link href={href} tabIndex={-1} aria-hidden className="relative block aspect-[3/4] w-24 shrink-0 self-start overflow-hidden bg-secondary md:w-32">
                      {img ? <Image src={img} alt="" fill sizes="(min-width: 768px) 128px, 96px" className="object-cover" /> : null}
                    </Link>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-4 pt-0.5">
                        <Link href={href} className="text-[1.125rem] leading-[1.3] hover:underline md:text-[1.22rem]" style={DISPLAY}>
                          {line.name}
                        </Link>
                        <p className="shrink-0 text-[15px] tabular-nums">{formatBagPrice(line.unitPriceMinor * line.quantity, currency)}</p>
                      </div>
                      {line.variantTitle ? <p className={cn("mt-2 text-[13px]", MUTED)}>{line.variantTitle}</p> : null}
                      {line.quantity > 1 ? <p className={cn("mt-1 text-[12px]", MUTED)}>{formatBagPrice(line.unitPriceMinor, currency)} each</p> : null}
                      <div className="mt-auto flex items-center gap-6 pt-5">
                        <QtyStepper value={line.quantity} onChange={(n) => cart.setQuantity(line.key, n)} label={line.name} />
                        <button type="button" onClick={() => cart.remove(line.key)} aria-label={`Remove ${line.name}`} className={cn("text-[11px] uppercase tracking-[0.14em] transition-colors hover:text-foreground hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary", MUTED)}>
                          Remove
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <Link href="/products" className="mt-6 inline-block text-[12px] font-medium uppercase tracking-[0.16em] text-foreground underline underline-offset-4 decoration-border transition-colors hover:decoration-foreground">
              Continue shopping
            </Link>
          </div>

          <aside aria-label="Order summary" className="border border-border bg-white px-6 pb-8 pt-6 sm:px-8 sm:pb-8 sm:pt-[30px]">
            <h2 className="text-[11px] font-normal uppercase tracking-[0.2em] text-[color:var(--sf-color-muted)]" style={{ fontFamily: "var(--sf-font-heading)" }}>
              Order summary
            </h2>
            <dl className="mt-[21px] grid gap-[13px] text-[14px]">
              <div className="flex justify-between gap-4">
                <dt className={MUTED}>Subtotal</dt>
                <dd className="tabular-nums">{formatBagPrice(cart.subtotalMinor, currency)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className={MUTED}>Shipping</dt>
                <dd>Calculated at checkout</dd>
              </div>
            </dl>
            <div className="mt-6 border-t border-border pt-6">
              <div className="flex items-center justify-between gap-4">
                <span className={cn("text-[11px] font-medium uppercase tracking-[0.18em]", MUTED)}>Estimated total</span>
                <span className="text-[1.14rem] leading-none tabular-nums">
                  {formatBagPrice(cart.subtotalMinor, currency)}
                </span>
              </div>
              <p className={cn("mt-[11px] text-[11px]", MUTED)}>Online checkout is not available yet for this store.</p>
            </div>
            <CheckoutButton className="mt-[23px]" />
          </aside>
        </div>
      )}
    </section>
  );
}
