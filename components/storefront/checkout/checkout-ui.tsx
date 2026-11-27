"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { lookOf } from "@/lib/templates/engine/theme-style";
import type { OrderTaxApi } from "@/lib/api/endpoints/checkout-api";
import { formatBagPrice } from "@/lib/cart/format";

/** Shared look of the storefront checkout and order pages, matching the bag page (same shell, display font and hairlines). */
export const DISPLAY = { fontFamily: "var(--sf-font-heading)", fontWeight: "var(--sf-font-heading-weight, 500)" } as const;
/** The page title under the breadcrumb: Boutique a large serif over a hairline, Market a compact bold heading, Sport a heavy slanted capital headline with an accent bar. */
export const TITLE = "mt-[var(--pg-title-mt,1.5rem)] border-b-[length:var(--pg-title-border,1px)] border-border pb-[var(--pg-title-pb,2rem)] text-[length:var(--pg-title-size,2.75rem)] leading-[1.05] tracking-[var(--pg-title-track,-0.01em)] text-foreground [text-transform:var(--pg-title-case,none)] [font-style:var(--pg-title-style,normal)] md:mt-[var(--pg-title-mt,30px)] md:pb-[var(--pg-title-pb-md,2.5rem)] md:text-[length:var(--pg-title-size-md,4rem)] after:mt-5 after:block after:h-[var(--pg-title-bar,0px)] after:w-[70px] after:rounded-full after:bg-accent";
export const TITLE_STYLE = { fontFamily: "var(--sf-font-heading)", fontWeight: "var(--pg-title-weight, var(--sf-font-heading-weight, 500))" } as const;
export const MUTED = "text-[color:var(--sf-color-muted)]";
export const SHELL = "mx-auto w-full max-w-[var(--sf-page-width,96rem)] px-5 md:px-10";
export const INPUT = "h-[var(--pg-field-h,3.5rem)] w-full rounded-[var(--pg-radius,0px)] border border-border bg-white px-5 text-[16px] text-foreground outline-none transition-colors placeholder:text-[color:var(--sf-color-muted)] focus-visible:border-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60";
const BUTTON = "flex h-[var(--pg-btn-h,3.5rem)] w-full items-center justify-center rounded-[var(--pg-btn-radius,0px)] text-[length:var(--pg-btn-size,13px)] font-[number:var(--pg-btn-weight,450)] [text-transform:var(--pg-btn-case,uppercase)] tracking-[var(--pg-btn-track,0.15em)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60";
export const PRIMARY_BUTTON = BUTTON + " bg-[color:var(--pg-btn-bg,var(--primary))] text-[color:var(--pg-btn-fg,var(--primary-foreground))] hover:brightness-110";
export const SECONDARY_BUTTON = BUTTON + " border border-border bg-white text-foreground hover:border-foreground";

/**
 * The checkout, bag, order and account pages are one set of pages for every store, but each look (Boutique, Market, Sport)
 * draws buttons, fields, panels and the page title its own way. A page puts `pageStyle(theme)` on its root and the classes
 * above and below read these `--pg-*` properties; with none set (Boutique and the standard look) the fallbacks in the classes
 * are the Boutique design.
 */
const PAGE_STYLES: Record<string, Record<string, string>> = {
  market: {
    "--pg-radius": "0.375rem", "--pg-field-h": "3.25rem", "--pg-panel-radius": "0.75rem", "--pg-panel-shadow": "0 1px 2px rgb(0 0 0 / 0.06)",
    "--pg-btn-radius": "0.5rem", "--pg-btn-h": "3.25rem", "--pg-btn-bg": "var(--accent)", "--pg-btn-fg": "var(--accent-foreground)", "--pg-btn-size": "16px", "--pg-btn-weight": "600", "--pg-btn-case": "none", "--pg-btn-track": "0em",
    "--pg-label-case": "none", "--pg-label-track": "0em",
    "--pg-title-size": "1.875rem", "--pg-title-size-md": "2.375rem", "--pg-title-weight": "700", "--pg-title-track": "-0.01em", "--pg-title-case": "none", "--pg-title-style": "normal",
    "--pg-title-border": "0px", "--pg-title-pb": "0.25rem", "--pg-title-pb-md": "0.25rem", "--pg-title-mt": "1rem", "--pg-title-bar": "0px",
  },
  sport: {
    "--pg-radius": "0.75rem", "--pg-field-h": "3.5rem", "--pg-panel-radius": "1.25rem", "--pg-panel-shadow": "0 10px 30px -18px rgb(0 0 0 / 0.25)",
    "--pg-btn-radius": "9999px", "--pg-btn-h": "3.5rem", "--pg-btn-bg": "var(--primary)", "--pg-btn-fg": "var(--primary-foreground)", "--pg-btn-size": "16px", "--pg-btn-weight": "600", "--pg-btn-case": "none", "--pg-btn-track": "0em",
    "--pg-label-case": "uppercase", "--pg-label-track": "0.14em",
    "--pg-title-size": "2.25rem", "--pg-title-size-md": "3.5rem", "--pg-title-weight": "800", "--pg-title-track": "-0.025em", "--pg-title-case": "uppercase", "--pg-title-style": "italic",
    "--pg-title-border": "0px", "--pg-title-pb": "0rem", "--pg-title-pb-md": "0rem", "--pg-title-mt": "1.5rem", "--pg-title-bar": "4px",
  },
};

export function pageStyle(theme: unknown): React.CSSProperties {
  return (PAGE_STYLES[lookOf(theme)] ?? {}) as React.CSSProperties;
}

export function PageTitle({ crumbs, title }: { crumbs: { label: string; href?: string }[]; title: string }) {
  return (
    <>
      <nav aria-label="Breadcrumb" className={cn("text-[13px] [text-transform:var(--pg-label-case,uppercase)] tracking-[var(--pg-label-track,0.16em)]", MUTED)}>
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
      <h1 className={TITLE} style={TITLE_STYLE}>
        {title}
      </h1>
    </>
  );
}

export function Field({ label, error, children, className, htmlFor }: { label: string; error?: string; children: React.ReactNode; className?: string; htmlFor: string }) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <label htmlFor={htmlFor} className={cn("text-[13px] font-medium [text-transform:var(--pg-label-case,uppercase)] tracking-[var(--pg-label-track,0.14em)]", MUTED)}>
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-[14px] text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "error" | "success"; children: React.ReactNode }) {
  return (
    <p role={tone === "error" ? "alert" : "status"} className={cn("border px-4 py-3 text-[15px]", tone === "error" ? "border-destructive/40 bg-destructive/5 text-destructive" : tone === "success" ? "border-primary/30 bg-primary/5 text-foreground" : "border-border bg-white text-foreground")}>
      {children}
    </p>
  );
}

export function Row({ label, value, strong }: { label: React.ReactNode; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-4", strong && "border-t border-border pt-4 text-[1.05rem]")}>
      <dt className={strong ? "text-[13px] font-medium [text-transform:var(--pg-label-case,uppercase)] tracking-[var(--pg-label-track,0.18em)]" : MUTED}>{label}</dt>
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
    <div className="grid gap-1.5 text-[14px]">
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
