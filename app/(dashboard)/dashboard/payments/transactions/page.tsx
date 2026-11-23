import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Receipt, SearchX } from "lucide-react";
import { labelFor, METHOD_LABELS, TRANSACTION_STATUS_LABELS, TransactionStatusBadge } from "@/components/orders/order-labels";
import { PaymentsNav } from "@/components/payments/payments-nav";
import { EmptyState } from "@/components/shared/empty-state";
import { ListFilters } from "@/components/shared/list-filters";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROUTES } from "@/config/app";
import { canManagePayments } from "@/lib/auth/permissions";
import { formatDateTime } from "@/lib/format-date";
import { formatMoney } from "@/lib/money";
import { requireWorkspace } from "@/lib/tenant/context";
import { flatten, transactionListQuerySchema } from "@/lib/validations/commerce-lists";
import { listTransactions } from "@/services/payment-ledger.service";

export const metadata: Metadata = { title: "Transactions" };

const REFUND_TONE = { none: "draft", pending: "warning", partial: "info", full: "neutral" } as const;
const REFUND_LABEL = { none: "No refund", pending: "Refund pending", partial: "Partly refunded", full: "Refunded" } as const;

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = transactionListQuerySchema.parse(flatten(await searchParams));
  const { active, store } = await requireWorkspace();
  if (!canManagePayments(active)) redirect(ROUTES.dashboard);
  const result = await listTransactions({ page: query.page, search: query.q || undefined, status: query.status, provider: query.provider, refundStatus: query.refund, from: query.from, to: query.to });
  const timezone = store?.timezone ?? "UTC";
  const filtered = Boolean(query.q || query.status || query.provider || query.refund || query.from || query.to);

  return (
    <>
      <PageHeader title="Payments" description="Every payment attempt and cash collection, with its Razorpay ids and refund status." />
      <PaymentsNav />
      {result.total === 0 && !filtered ? (
        <EmptyState icon={Receipt} title="No transactions yet" description="Payments appear here once customers check out." />
      ) : (
        <>
          <ListFilters
            searchPlaceholder="Search order number or Razorpay id"
            filters={[
              { key: "status", label: "Status", options: Object.entries(TRANSACTION_STATUS_LABELS).map(([value, label]) => ({ value, label })) },
              { key: "provider", label: "Provider", options: [{ value: "razorpay", label: "Razorpay" }, { value: "cod", label: "Cash on delivery" }] },
              { key: "refund", label: "Refund", options: Object.entries(REFUND_LABEL).map(([value, label]) => ({ value, label })) },
            ]}
            dateFilters={[
              { key: "from", label: "From" },
              { key: "to", label: "To" },
            ]}
          />
          {result.items.length === 0 ? (
            <EmptyState icon={SearchX} title="No transactions match" description="Try a different search or clear the filters." />
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead>Transaction</TableHead>
                      <TableHead>Order</TableHead>
                      <TableHead className="hidden lg:table-cell">Razorpay</TableHead>
                      <TableHead className="hidden md:table-cell">Method</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden sm:table-cell">Refund</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.items.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell>
                          <Link href={`${ROUTES.transactions}/${t.id}`} className="font-mono text-xs hover:text-primary hover:underline">
                            {t.id.slice(0, 8)}
                          </Link>
                          <span className="block text-xs text-muted-foreground">{formatDateTime(new Date(t.createdAt), timezone)}</span>
                        </TableCell>
                        <TableCell>
                          <Link href={`${ROUTES.orders}/${t.orderId}`} className="hover:text-primary hover:underline">
                            #{t.orderNumber}
                          </Link>
                        </TableCell>
                        <TableCell className="hidden font-mono text-xs text-muted-foreground lg:table-cell">
                          {t.razorpayPaymentId ?? t.razorpayOrderId ?? "—"}
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground md:table-cell">{t.method ? labelFor(METHOD_LABELS, t.method) : labelFor(METHOD_LABELS, t.provider)}</TableCell>
                        <TableCell>
                          <TransactionStatusBadge status={t.status} />
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <StatusBadge tone={REFUND_TONE[t.refundStatus]}>{REFUND_LABEL[t.refundStatus]}</StatusBadge>
                          {t.refundRequired ? <span className="mt-0.5 block text-xs text-destructive">Refund needed</span> : null}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(t.amountMinor, t.currency)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Pagination page={result.page} pageSize={result.pageSize} total={result.total} basePath={ROUTES.transactions} params={{ q: query.q, status: query.status, provider: query.provider, refund: query.refund, from: query.from, to: query.to }} />
            </>
          )}
        </>
      )}
    </>
  );
}
