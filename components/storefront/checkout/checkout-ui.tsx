"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { OrderTaxApi } from "@/lib/api/endpoints/checkout-api";
import { formatBagPrice } from "@/lib/cart/format";

/** Shared look of the storefront checkout and order pages, matching the bag page (same shell, display font and hairlines). */
export const DISPLAY = { fontFamily: "var(--sf-font-heading)", fontWeight: "var(--sf-font-heading-weight, 500)" } as const;
export const MUTED = "text-[color:var(--sf-color-muted)]";
export const SHELL = "mx-auto w-full max-w-[var(--sf-page-width,96rem)] px-5 md:px-10";
export const INPUT = "h-12 w-full border border-border bg-white px-4 text-[14px] text-foreground outline-none transition-colors placeholder:text-[color:var(--sf-color-muted)] focus-visible:border-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60";
export const PRIMARY_BUTTON = "flex h-12 w-full items-center justify-center rounded-none bg-primary text-[11px] font-[450] uppercase tracking-[0.15em] text-primary-foreground transition-colors hover:bg-[var(--primary-hover,var(--primary))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60";
export const SECONDARY_BUTTON = "flex h-12 w-full items-center justify-center border border-border bg-white text-[11px] font-medium uppercase tracking-[0.15em] text-foreground transition-colors hover:border-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60";

export function PageTitle({ crumbs, title }: { crumbs: { label: string; href?: string }[]; title: string }) {
  return (
    <>
      <nav aria-label="Breadcrumb" className={cn("text-[11px] uppercase tracking-[0.16em]", MUTED)}>
        <ol className="flex items-center gap-2">
          {crumbs.map((c, i) => (
            <li key={c.label} className="flex items-center gap-2">
              {i > 0 ? (
                <span aria-hidden className="opacity-50">
                  /
                </span>
              ) : null}
              {c.href ? (
                <Link href={c.href} className="transition-colors hover:text-foreground">
                  {c.label}
                </Link>
              ) : (
                <span aria-current="page" className="text-foreground">
                  {c.label}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <h1 className="mt-6 border-b border-border pb-8 text-[2.5rem] leading-[1.05] tracking-[-0.01em] text-foreground md:mt-[30px] md:pb-10 md:text-[3.5rem]" style={DISPLAY}>
        {title}
      </h1>
    </>
  );
}

export function Field({ label, error, children, className, htmlFor }: { label: string; error?: string; children: React.ReactNode; className?: string; htmlFor: string }) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <label htmlFor={htmlFor} className={cn("text-[11px] font-medium uppercase tracking-[0.14em]", MUTED)}>
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-[12px] text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "error" | "success"; children: React.ReactNode }) {
  return (
    <p role={tone === "error" ? "alert" : "status"} className={cn("border px-4 py-3 text-[13px]", tone === "error" ? "border-destructive/40 bg-destructive/5 text-destructive" : tone === "success" ? "border-primary/30 bg-primary/5 text-foreground" : "border-border bg-white text-foreground")}>
      {children}
    </p>
  );
}

export function Row({ label, value, strong }: { label: React.ReactNode; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-4", strong && "border-t border-border pt-4 text-[1.05rem]")}>
      <dt className={strong ? "text-[11px] font-medium uppercase tracking-[0.18em]" : MUTED}>{label}</dt>
      <dd className="text-right tabular-nums">{value}</dd>
    </div>
  );
}

/** The GST of an order, as the server worked it out: CGST + SGST (or UTGST) within the seller's state, IGST across states. */
export function TaxBreakdown({ tax, currency }: { tax: OrderTaxApi; currency: string }) {
  if (tax.regime === "none" || tax.taxMinor === 0) return null;
  const money = (m: number) => formatBagPrice(m, currency);
  const stateName = tax.stateTaxKind === "utgst" ? "UTGST" : "SGST";
  return (
    <div className="grid gap-1.5 text-[12px]">
      {tax.regime === "intra" ? (
        <>
          <Row label="CGST" value={money(tax.cgstMinor)} />
          <Row label={stateName} value={money(tax.sgstMinor)} />
        </>
      ) : (
        <Row label="IGST" value={money(tax.igstMinor)} />
      )}
    </div>
  );
}

export const formatDays = (d: { min: number; max: number } | null) => (d ? (d.min === d.max ? `${d.min} day${d.min === 1 ? "" : "s"}` : `${d.min}-${d.max} days`) : null);

export const STATUS_LABELS: Record<string, string> = {
  pending_payment: "Awaiting payment",
  confirmed: "Confirmed",
  processing: "Processing",
  ready_to_ship: "Ready to ship",
  shipped: "Shipped",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  failed: "Failed",
  returned: "Returned",
};

export const PAYMENT_LABELS: Record<string, string> = {
  unpaid: "Awaiting payment",
  pending_collection: "Pay on delivery",
  paid: "Paid",
  collected: "Paid on delivery",
  failed: "Payment failed",
  partially_refunded: "Partially refunded",
  refunded: "Refunded",
};

export const labelOf = (map: Record<string, string>, value: string) => map[value] ?? value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
