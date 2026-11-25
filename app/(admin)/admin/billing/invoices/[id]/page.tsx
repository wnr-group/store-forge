import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { z } from "zod";
import { BillingTabs } from "@/components/admin/billing-tabs";
import { InvoiceBadge, PaymentBadge } from "@/components/admin/billing-badges";
import { InvoiceActions, RefundButton } from "@/components/admin/invoice-actions";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROUTES } from "@/config/app";
import { dateTime, money, shortDate } from "@/lib/admin/format";
import { getPlatformAccess, requirePlatformPagePermission } from "@/lib/auth/platform";
import { AppError } from "@/lib/errors";
import { getInvoice } from "@/services/platform-commercial.service";

export const metadata: Metadata = { title: "Invoice" };

const Row = ({ label, value }: { label: React.ReactNode; value: React.ReactNode }) => (
  <div className="flex justify-between gap-4 py-1.5 text-sm">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="text-right tabular-nums">{value}</dd>
  </div>
);

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformPagePermission("billing:read");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [inv, access] = await Promise.all([
    getInvoice(id).catch((e) => {
      if (e instanceof AppError && e.code === "NOT_FOUND") return null;
      throw e;
    }),
    getPlatformAccess(),
  ]);
  if (!inv) notFound();
  const canManage = access?.permissions.includes("billing:manage") ?? false;

  return (
    <>
      <PageHeader
        title={inv.number}
        description={
          <>
            <Link href={`${ROUTES.adminCompanies}/${inv.tenantId}`} className="hover:underline">{inv.tenantName}</Link> · {inv.planName} plan, {inv.billingInterval}
          </>
        }
        actions={
          <>
            <InvoiceBadge status={inv.status} overdue={inv.overdue} />
            <a href={`${ROUTES.adminInvoices}/${inv.id}/download`} className={buttonVariants({ variant: "outline" })}>
              <Download aria-hidden /> Download PDF
            </a>
            {canManage ? <InvoiceActions invoiceId={inv.id} number={inv.number} status={inv.status} totalMinor={inv.totalMinor} currency={inv.currency} /> : null}
          </>
        }
      />
      <BillingTabs />

      <div className="space-y-6">
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
              {inv.voidedAt ? <Row label="Voided" value={`${dateTime(inv.voidedAt)}${inv.voidReason ? `: ${inv.voidReason}` : ""}`} /> : null}
              <Row label="Billed by" value={inv.seller.legalName} />
            </dl>
          </SectionCard>
        </div>

        <SectionCard title="Payments" description="Every attempt to pay this invoice, including failed ones. A payment is only counted after the server has verified it with Razorpay.">
          {inv.payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payment has been attempted yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead>Payment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Refunded</TableHead>
                    {canManage ? <TableHead><span className="sr-only">Actions</span></TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inv.payments.map((p) => {
                    const remaining = p.amountMinor - p.refundedMinor;
                    const refundable = canManage && (p.status === "succeeded" || p.status === "partially_refunded") && remaining > 0;
                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          <span className="block font-medium">{p.provider === "razorpay" ? `Razorpay${p.method ? ` · ${p.method}` : ""}` : `Offline · ${p.method ?? ""}`}</span>
                          <span className="block text-xs text-muted-foreground">
                            {p.provider === "razorpay" ? (p.razorpayPaymentId ?? p.razorpayOrderId ?? "") : (p.reference ?? "")} · {dateTime(p.capturedAt ?? p.createdAt)}
                          </span>
                          {p.failureDescription ? <span className="block text-xs text-destructive">{p.failureDescription}</span> : null}
                          {p.refundRequired ? <span className="block text-xs text-warning-text">Received after the invoice was paid or voided: refund it.</span> : null}
                        </TableCell>
                        <TableCell><PaymentBadge status={p.status} /></TableCell>
                        <TableCell className="text-right tabular-nums">{money(p.amountMinor, p.currency)}</TableCell>
                        <TableCell className="text-right tabular-nums">{p.refundedMinor > 0 ? money(p.refundedMinor, p.currency) : "—"}</TableCell>
                        {canManage ? (
                          <TableCell className="text-right">
                            {refundable ? <RefundButton paymentId={p.id} remainingMinor={remaining} currency={p.currency} label={`${inv.number}, paid ${shortDate(p.capturedAt)}`} /> : null}
                          </TableCell>
                        ) : null}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </SectionCard>

        {inv.refunds.length > 0 ? (
          <SectionCard title="Refunds">
            <ul className="divide-y text-sm">
              {inv.refunds.map((r) => (
                <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                  <span>
                    {money(r.amountMinor, r.currency)} <span className="text-muted-foreground">· {r.reason ?? "No reason given"}</span>
                    {r.failureReason ? <span className="block text-xs text-destructive">{r.failureReason}</span> : null}
                  </span>
                  <span className="text-xs text-muted-foreground">{r.status === "processed" ? "Processed" : r.status === "failed" ? "Failed" : "Pending"} · {dateTime(r.processedAt ?? r.createdAt)}</span>
                </li>
              ))}
            </ul>
          </SectionCard>
        ) : null}
      </div>
    </>
  );
}
