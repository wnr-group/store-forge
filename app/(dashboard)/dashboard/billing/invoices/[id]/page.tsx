import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { InvoiceBadge, PaymentBadge } from "@/components/admin/billing-badges";
import { DownloadInvoiceButton } from "@/components/billing/download-invoice-button";
import { PayInvoiceButton } from "@/components/billing/pay-invoice-button";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { ROUTES } from "@/config/app";
import { dateTime, money, shortDate } from "@/lib/admin/format";
import { canManageBilling } from "@/lib/auth/permissions";
import { AppError } from "@/lib/errors";
import { requireWorkspace } from "@/lib/tenant/context";
import { getMyInvoice } from "@/services/billing.service";

export const metadata: Metadata = { title: "Invoice" };

const Row = ({ label, value }: { label: React.ReactNode; value: React.ReactNode }) => (
  <div className="flex justify-between gap-4 py-1.5 text-sm">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="text-right tabular-nums">{value}</dd>
  </div>
);

export default async function MyInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { active } = await requireWorkspace();
  if (!canManageBilling(active)) redirect(ROUTES.dashboard);
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const inv = await getMyInvoice(id).catch((e) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") return null;
    throw e;
  });
  if (!inv) notFound();

  return (
    <>
      <PageHeader
        title={inv.number}
        description={<>{inv.planName} plan, {inv.billingInterval} · <Link href={`${ROUTES.billing}/invoices`} className="underline">All invoices</Link></>}
        actions={
          <>
            <InvoiceBadge status={inv.status} overdue={inv.overdue} />
            <DownloadInvoiceButton href={`${ROUTES.billing}/invoices/${inv.id}/download`} fileName={`${inv.number}.pdf`} />
          </>
        }
      />
      <div className="space-y-6">
        {inv.status === "open" ? (
          <SectionCard title="Pay this invoice" description="You pay the full amount in Razorpay's window. Your card or bank details never reach Kanova Store, and the invoice is marked paid only once Razorpay confirms it.">
            <PayInvoiceButton invoiceId={inv.id} number={inv.number} totalMinor={inv.totalMinor} currency={inv.currency} />
          </SectionCard>
        ) : null}
        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard title="Amount">
            <dl className="divide-y">
              <Row label="Subtotal" value={money(inv.subtotalMinor, inv.currency)} />
              <Row label={`${inv.seller.taxLabel} (${inv.taxRateBps / 100}%)`} value={money(inv.taxMinor, inv.currency)} />
              <Row label={<span className="font-medium text-foreground">Total</span>} value={<span className="font-semibold">{money(inv.totalMinor, inv.currency)}</span>} />
            </dl>
          </SectionCard>
          <SectionCard title="Details">
            <dl className="divide-y">
              <Row label="Billing period" value={`${shortDate(inv.periodStart)} to ${shortDate(inv.periodEnd)}`} />
              <Row label="Issued" value={shortDate(inv.issuedAt)} />
              <Row label="Due" value={shortDate(inv.dueAt)} />
              {inv.paidAt ? <Row label="Paid" value={dateTime(inv.paidAt)} /> : null}
              {inv.voidedAt ? <Row label="Voided" value={dateTime(inv.voidedAt)} /> : null}
              <Row label="Billed by" value={inv.seller.legalName} />
            </dl>
          </SectionCard>
        </div>
        <SectionCard title="Payments" description="Every attempt to pay this invoice.">
          {inv.payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payment has been attempted yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {inv.payments.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    {p.provider === "razorpay" ? `Razorpay${p.method ? ` · ${p.method}` : ""}` : `Offline · ${p.method ?? ""}`}
                    <span className="block text-xs text-muted-foreground">{dateTime(p.capturedAt ?? p.createdAt)}</span>
                    {p.failureDescription ? <span className="block text-xs text-destructive">{p.failureDescription}</span> : null}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="tabular-nums">{money(p.amountMinor, p.currency)}</span>
                    <PaymentBadge status={p.status} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </>
  );
}
