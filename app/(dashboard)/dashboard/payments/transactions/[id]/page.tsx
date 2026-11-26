import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import { labelFor, METHOD_LABELS, RefundStatusBadge, TransactionStatusBadge } from "@/components/orders/order-labels";
import { PaymentsNav } from "@/components/payments/payments-nav";
import { RefundButton } from "@/components/payments/refund-dialog";
import { RefundSyncButton } from "@/components/payments/refund-sync-button";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROUTES } from "@/config/app";
import { canManagePayments } from "@/lib/auth/permissions";
import { formatDateTime } from "@/lib/format-date";
import { formatMoney } from "@/lib/money";
import { requireWorkspace } from "@/lib/tenant/context";
import { getTransaction } from "@/services/payment-ledger.service";

export const metadata: Metadata = { title: "Transaction" };

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-all text-sm">{children}</dd>
    </div>
  );
}

export default async function TransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { active, store } = await requireWorkspace();
  if (!canManagePayments(active)) redirect(ROUTES.dashboard);
  const t = await getTransaction(id);
  if (!t) notFound();
  const timezone = store?.timezone ?? "UTC";
  const at = (iso: string | null) => (iso ? formatDateTime(new Date(iso), timezone) : "—");
  const money = (m: number) => formatMoney(m, t.currency);
  const refundableMinor = t.provider === "razorpay" && ["captured"].includes(t.status) ? t.amountMinor - t.refundedMinor - t.refundPendingMinor : 0;

  return (
    <>
      <Link href={ROUTES.transactions} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> All transactions
      </Link>
      <PageHeader title={`Transaction ${t.id.slice(0, 8)}`} description={`Order #${t.orderNumber}`} actions={<><TransactionStatusBadge status={t.status} />{t.provider === "razorpay" ? <RefundButton transactionId={t.id} currency={t.currency} refundableMinor={refundableMinor} /> : null}</>} />
      <PaymentsNav />
      {t.refundRequired ? <p role="status" className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">This payment was received but the order could not be fulfilled. It needs a refund.</p> : null}
      <div className="grid max-w-5xl gap-5">
        <SectionCard title="Payment">
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Item label="Internal ID">{t.id}</Item>
            <Item label="Order"><Link className="hover:text-primary hover:underline" href={`${ROUTES.orders}/${t.orderId}`}>#{t.orderNumber}</Link></Item>
            <Item label="Amount">{money(t.amountMinor)}</Item>
            <Item label="Provider">{labelFor(METHOD_LABELS, t.provider)}</Item>
            <Item label="Method">{t.method ? labelFor(METHOD_LABELS, t.method) : "—"}</Item>
            <Item label="Attempts">{t.attempts}</Item>
            <Item label="Razorpay order ID">{t.razorpayOrderId ?? "—"}</Item>
            <Item label="Razorpay payment ID">{t.razorpayPaymentId ?? "—"}</Item>
            <Item label="Created">{at(t.createdAt)}</Item>
            <Item label={t.provider === "cod" ? "Cash collected" : "Captured"}>{at(t.provider === "cod" ? t.collectedAt : t.capturedAt)}</Item>
            <Item label="Refunded">{money(t.refundedMinor)}{t.refundPendingMinor ? ` (+ ${money(t.refundPendingMinor)} pending)` : ""}</Item>
          </dl>
          {t.failureDescription || t.failureCode ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <p className="font-medium text-destructive">Payment failed</p>
              <p>{t.failureDescription ?? "The payment did not go through."}</p>
              {t.failureCode ? <p className="text-xs text-muted-foreground">Code: {t.failureCode}</p> : null}
            </div>
          ) : null}
        </SectionCard>

        <SectionCard title="Refunds">
          {t.refunds.length === 0 ? (
            <p className="text-sm text-muted-foreground">No refunds on this payment.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Requested</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden sm:table-cell">Reason</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {t.refunds.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        {at(r.createdAt)}
                        <span className="block text-xs text-muted-foreground">{r.razorpayRefundId ?? (r.source === "razorpay_dashboard" ? "From Razorpay dashboard" : "")}</span>
                      </TableCell>
                      <TableCell>
                        <RefundStatusBadge status={r.status} />
                        {r.failureReason ? <span className="mt-0.5 block text-xs text-destructive">{r.failureReason}</span> : null}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">{r.reason ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(r.amountMinor)}</TableCell>
                      <TableCell>{["pending", "processing"].includes(r.status) ? <RefundSyncButton refundId={r.id} /> : null}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Razorpay events" description="What Razorpay told Kanova Store about this payment, oldest first.">
          {t.events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events received.</p>
          ) : (
            <ol className="space-y-2 border-l pl-4">
              {t.events.map((e) => (
                <li key={e.eventId} className="text-sm">
                  <span className="font-medium">{e.eventType}</span> <span className="text-xs text-muted-foreground">· {e.status} · {at(e.receivedAt)}</span>
                  {e.note ? <p className="text-xs text-muted-foreground">{e.note}</p> : null}
                </li>
              ))}
            </ol>
          )}
        </SectionCard>
      </div>
    </>
  );
}
