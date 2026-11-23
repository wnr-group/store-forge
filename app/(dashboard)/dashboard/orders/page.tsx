import type { Metadata } from "next";
import Link from "next/link";
import { SearchX, ShoppingCart } from "lucide-react";
import { OrderStatusBadge, PaymentStatusBadge, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, METHOD_LABELS } from "@/components/orders/order-labels";
import { EmptyState } from "@/components/shared/empty-state";
import { ListFilters } from "@/components/shared/list-filters";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROUTES } from "@/config/app";
import { formatDateTime } from "@/lib/format-date";
import { formatMoney } from "@/lib/money";
import { requireWorkspaceCan } from "@/lib/tenant/context";
import { flatten, orderListQuerySchema } from "@/lib/validations/commerce-lists";
import { listOrders } from "@/services/order.service";

export const metadata: Metadata = { title: "Orders" };

const options = (labels: Record<string, string>) => Object.entries(labels).map(([value, label]) => ({ value, label }));

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = flatten(await searchParams);
  const query = orderListQuerySchema.parse(raw);
  const { store } = await requireWorkspaceCan("orders:view");
  const result = await listOrders({ page: query.page, search: query.q || undefined, status: query.status, paymentStatus: query.payment, paymentMethod: query.method });
  const timezone = store?.timezone ?? "UTC";
  const filtered = Boolean(query.q || query.status || query.payment || query.method);

  return (
    <>
      <PageHeader title="Orders" description="Orders placed on your storefront, newest first." />
      {result.total === 0 && !filtered ? (
        <EmptyState icon={ShoppingCart} title="No orders yet" description="Orders appear here as soon as a customer checks out." />
      ) : (
        <>
          <ListFilters
            searchPlaceholder="Search order number, name or email"
            filters={[
              { key: "status", label: "Status", options: options(ORDER_STATUS_LABELS) },
              { key: "payment", label: "Payment", options: options(PAYMENT_STATUS_LABELS) },
              { key: "method", label: "Method", options: [{ value: "razorpay", label: METHOD_LABELS.razorpay }, { value: "cod", label: METHOD_LABELS.cod }] },
            ]}
          />
          {result.items.length === 0 ? (
            <EmptyState icon={SearchX} title="No orders match" description="Try a different search or clear the filters." />
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead>Order</TableHead>
                      <TableHead className="hidden md:table-cell">Customer</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden sm:table-cell">Payment</TableHead>
                      <TableHead className="hidden lg:table-cell">Placed</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.items.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell>
                          <Link href={`${ROUTES.orders}/${o.id}`} className="font-medium hover:text-primary hover:underline">
                            #{o.orderNumber}
                          </Link>
                          <span className="block text-xs text-muted-foreground md:hidden">{o.customerName ?? "Guest"}</span>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {o.customerName ?? "Guest"}
                          <span className="block text-xs text-muted-foreground">{o.customerEmail ?? ""}</span>
                        </TableCell>
                        <TableCell>
                          <OrderStatusBadge status={o.status} />
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <PaymentStatusBadge status={o.paymentStatus} />
                          <span className="mt-0.5 block text-xs text-muted-foreground">{o.paymentMethod ? METHOD_LABELS[o.paymentMethod] : "—"}</span>
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground lg:table-cell">{formatDateTime(new Date(o.placedAt), timezone)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(o.totalMinor, o.currency)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Pagination page={result.page} pageSize={result.pageSize} total={result.total} basePath={ROUTES.orders} params={{ q: query.q, status: query.status, payment: query.payment, method: query.method }} />
            </>
          )}
        </>
      )}
    </>
  );
}
