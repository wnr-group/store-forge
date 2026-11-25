import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import { FULFILLMENT_LABELS, labelFor, METHOD_LABELS, OrderStatusBadge, PaymentStatusBadge, ORDER_STATUS_LABELS, ShipmentStatusBadge } from "@/components/orders/order-labels";
import { OrderActions } from "@/components/orders/order-actions";
import { TaxBreakdownTable } from "@/components/orders/tax-breakdown-table";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROUTES } from "@/config/app";
import type { OrderAddressApi } from "@/lib/api/endpoints/orders-api";
import { canManageOrders } from "@/lib/auth/permissions";
import { formatDateTime } from "@/lib/format-date";
import { formatMoney } from "@/lib/money";
import { requireWorkspaceCan } from "@/lib/tenant/context";
import { getOrder } from "@/services/order.service";

export const metadata: Metadata = { title: "Order" };

function Address({ title, a }: { title: string; a: OrderAddressApi | null }) {
  return (
    <SectionCard title={title}>
      {a ? (
        <address className="space-y-0.5 text-sm not-italic">
          <p className="font-medium">{a.fullName}</p>
          <p>{[a.line1, a.line2].filter(Boolean).join(", ")}</p>
          <p>
            {a.city}, {a.state} {a.postalCode}
          </p>
          <p className="text-muted-foreground">{a.phone}</p>
        </address>
      ) : (
        <p className="text-sm text-muted-foreground">Not recorded.</p>
      )}
    </SectionCard>
  );
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { active, store } = await requireWorkspaceCan("orders:view");
  const data = await getOrder(id);
  if (!data) notFound();
  const { order, shipments } = data;
  const timezone = store?.timezone ?? "UTC";
  const money = (m: number) => formatMoney(m, order.currency);
  const canManage = canManageOrders(active);

  return (
    <>
      <Link href={ROUTES.orders} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> All orders
      </Link>
      <PageHeader
        title={`Order #${order.orderNumber}`}
        description={`Placed ${formatDateTime(new Date(order.placedAt), timezone)}`}
        actions={
          <>
            <OrderStatusBadge status={order.status} />
            <PaymentStatusBadge status={order.paymentStatus} />
          </>
        }
      />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid gap-5">
          <SectionCard title="Items">
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((i, n) => (
                    <TableRow key={n}>
                      <TableCell>
                        {i.name}
                        {i.sku ? <span className="block text-xs text-muted-foreground">SKU {i.sku}</span> : null}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{money(i.unitPriceMinor)}</TableCell>
                      <TableCell className="text-right tabular-nums">{i.quantity}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(i.totalMinor)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <dl className="ml-auto grid max-w-xs gap-1.5 text-sm">
              <div className="flex justify-between gap-6"><dt className="text-muted-foreground">Subtotal</dt><dd className="tabular-nums">{money(order.subtotalMinor)}</dd></div>
              {order.discountMinor > 0 ? <div className="flex justify-between gap-6"><dt className="text-muted-foreground">Discount</dt><dd className="tabular-nums">− {money(order.discountMinor)}</dd></div> : null}
              <div className="flex justify-between gap-6"><dt className="text-muted-foreground">Shipping{order.shippingMethodName ? ` (${order.shippingMethodName})` : ""}</dt><dd className="tabular-nums">{money(order.shippingMinor)}</dd></div>
              {order.codFeeMinor > 0 ? <div className="flex justify-between gap-6"><dt className="text-muted-foreground">COD charge</dt><dd className="tabular-nums">{money(order.codFeeMinor)}</dd></div> : null}
              <div className="flex justify-between gap-6"><dt className="text-muted-foreground">{order.taxInclusive ? "GST (included)" : "GST"}</dt><dd className="tabular-nums">{money(order.taxMinor)}</dd></div>
              <div className="flex justify-between gap-6 border-t pt-2 font-semibold"><dt>Total</dt><dd className="tabular-nums">{money(order.totalMinor)}</dd></div>
            </dl>
          </SectionCard>

          <SectionCard title="Tax breakdown" description="Saved when the order was placed.">
            <TaxBreakdownTable tax={order.tax} currency={order.currency} />
          </SectionCard>

          <SectionCard title="Shipments" description={`Fulfilment: ${labelFor(FULFILLMENT_LABELS, order.fulfillmentStatus)}`}>
            {shipments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No shipment has been booked for this order yet.</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {shipments.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                    <div>
                      <Link href={`${ROUTES.shipments}/${s.id}`} className="font-medium hover:text-primary hover:underline">
                        {s.courierName ?? s.providerCode}
                        {s.awb ? ` · AWB ${s.awb}` : ""}
                      </Link>
                      <span className="block text-xs text-muted-foreground">Booked {formatDateTime(new Date(s.createdAt), timezone)}</span>
                    </div>
                    <ShipmentStatusBadge status={s.status} />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="History">
            <ol className="space-y-3 border-l pl-4">
              {order.history.map((h, i) => (
                <li key={i} className="text-sm">
                  <p className="font-medium">{labelFor(ORDER_STATUS_LABELS, h.toStatus)}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(new Date(h.createdAt), timezone)} · {h.actorType}
                    {h.note ? ` · ${h.note}` : ""}
                  </p>
                </li>
              ))}
            </ol>
          </SectionCard>
        </div>

        <div className="grid gap-5">
          {canManage ? (
            <SectionCard title="Actions">
              <OrderActions orderId={order.id} status={order.status} paymentMethod={order.paymentMethod} paymentStatus={order.paymentStatus} fulfillmentStatus={order.fulfillmentStatus} nextStatuses={order.nextStatuses} canBookShipment />
            </SectionCard>
          ) : null}
          <SectionCard title="Customer">
            <div className="space-y-0.5 text-sm">
              <p className="font-medium">{order.customerName ?? "Guest"}</p>
              <p className="text-muted-foreground">{order.customerEmail ?? "—"}</p>
              <p className="text-muted-foreground">{order.customerPhone ?? "—"}</p>
            </div>
          </SectionCard>
          <SectionCard title="Payment">
            <p className="text-sm">{order.paymentMethod ? METHOD_LABELS[order.paymentMethod] : "—"}</p>
            <PaymentStatusBadge status={order.paymentStatus} />
          </SectionCard>
          <Address title="Shipping address" a={order.shippingAddress} />
          <Address title="Billing address" a={order.billingAddress} />
          {order.cancelReason ? (
            <SectionCard title="Cancellation">
              <p className="text-sm">{order.cancelReason}</p>
            </SectionCard>
          ) : null}
        </div>
      </div>
    </>
  );
}
