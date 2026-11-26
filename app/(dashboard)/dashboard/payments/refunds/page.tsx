import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SearchX, Undo2 } from "lucide-react";
import { REFUND_STATUS_LABELS, RefundStatusBadge } from "@/components/orders/order-labels";
import { PaymentsNav } from "@/components/payments/payments-nav";
import { RefundSyncButton } from "@/components/payments/refund-sync-button";
import { EmptyState } from "@/components/shared/empty-state";
import { ListFilters } from "@/components/shared/list-filters";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROUTES } from "@/config/app";
import { canManagePayments } from "@/lib/auth/permissions";
import { formatDateTime } from "@/lib/format-date";
import { formatMoney } from "@/lib/money";
import { requireWorkspace } from "@/lib/tenant/context";
import { flatten, refundListQuerySchema } from "@/lib/validations/commerce-lists";
import { listRefunds } from "@/services/payment-ledger.service";

export const metadata: Metadata = { title: "Refunds" };

export default async function RefundsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = refundListQuerySchema.parse(flatten(await searchParams));
  const { active, store } = await requireWorkspace();
  if (!canManagePayments(active)) redirect(ROUTES.dashboard);
  const result = await listRefunds({ page: query.page, search: query.q || undefined, status: query.status });
  const timezone = store?.timezone ?? "UTC";
  const filtered = Boolean(query.q || query.status);

  return (
    <>
      <PageHeader title="Payments" description="Refunds sent to customers through Razorpay. Start a refund from a transaction." />
      <PaymentsNav />
      {result.total === 0 && !filtered ? (
        <EmptyState icon={Undo2} title="No refunds yet" description="Refunds you make, and those made in the Razorpay dashboard, appear here." />
      ) : (
        <>
          <ListFilters searchPlaceholder="Search order number or refund id" filters={[{ key: "status", label: "Status", options: Object.entries(REFUND_STATUS_LABELS).map(([value, label]) => ({ value, label })) }]} />
          {result.items.length === 0 ? (
            <EmptyState icon={SearchX} title="No refunds match" description="Try a different search or clear the filter." />
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead>Refund</TableHead>
                      <TableHead>Order</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden md:table-cell">Reason</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.items.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <Link href={`${ROUTES.transactions}/${r.paymentTransactionId}`} className="font-mono text-xs hover:text-primary hover:underline">
                            {r.razorpayRefundId ?? r.id.slice(0, 8)}
                          </Link>
                          <span className="block text-xs text-muted-foreground">{formatDateTime(new Date(r.createdAt), timezone)}</span>
                        </TableCell>
                        <TableCell>
                          <Link href={`${ROUTES.orders}/${r.orderId}`} className="hover:text-primary hover:underline">
                            #{r.orderNumber}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <RefundStatusBadge status={r.status} />
                          {r.failureReason ? <span className="mt-0.5 block text-xs text-destructive">{r.failureReason}</span> : null}
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground md:table-cell">{r.reason ?? (r.source === "razorpay_dashboard" ? "Made in the Razorpay dashboard" : "—")}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(r.amountMinor, r.currency)}</TableCell>
                        <TableCell>{["pending", "processing"].includes(r.status) ? <RefundSyncButton refundId={r.id} /> : null}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Pagination page={result.page} pageSize={result.pageSize} total={result.total} basePath={ROUTES.refunds} params={{ q: query.q, status: query.status }} />
            </>
          )}
        </>
      )}
    </>
  );
}
