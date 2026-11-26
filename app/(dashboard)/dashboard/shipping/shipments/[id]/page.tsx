import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import { ShipmentStatusBadge, labelFor, SHIPMENT_STATUS_LABELS } from "@/components/orders/order-labels";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { ShipmentActions } from "@/components/shipping/shipment-actions";
import { ShippingNav } from "@/components/shipping/shipping-nav";
import { ROUTES } from "@/config/app";
import { canManageOrders } from "@/lib/auth/permissions";
import { formatDateTime } from "@/lib/format-date";
import { formatMoney } from "@/lib/money";
import { requireWorkspaceCan } from "@/lib/tenant/context";
import { getShipment } from "@/services/shipping.service";

export const metadata: Metadata = { title: "Shipment" };

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-all text-sm">{children}</dd>
    </div>
  );
}

export default async function ShipmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { active, store } = await requireWorkspaceCan("orders:view");
  const s = await getShipment(id);
  if (!s) notFound();
  const timezone = store?.timezone ?? "UTC";
  const at = (iso: string | null) => (iso ? formatDateTime(new Date(iso), timezone) : "—");

  return (
    <>
      <Link href={ROUTES.shipments} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> All shipments
      </Link>
      <PageHeader title={s.awb ? `AWB ${s.awb}` : "Shipment"} description={`Order #${s.orderNumber} · ${s.courierName ?? s.providerCode}`} actions={<ShipmentStatusBadge status={s.status} />} />
      <ShippingNav />
      {s.failureReason ? (
        <p role="alert" className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {s.failureReason}
        </p>
      ) : null}
      <div className="grid max-w-5xl gap-5">
        <SectionCard title="Actions">
          <ShipmentActions shipmentId={s.id} status={s.status} hasLabel={s.hasLabel} labelUrl={s.labelUrl} trackingUrl={s.trackingUrl} canManage={canManageOrders(active)} />
        </SectionCard>
        <SectionCard title="Details">
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Item label="Order"><Link className="hover:text-primary hover:underline" href={`${ROUTES.orders}/${s.orderId}`}>#{s.orderNumber}</Link></Item>
            <Item label="Carrier">{s.courierName ?? s.providerCode}</Item>
            <Item label="Service">{s.serviceCode ?? "—"}</Item>
            <Item label="AWB">{s.awb ?? "—"}</Item>
            <Item label="Payment">{s.paymentMode === "cod" ? `Cash on delivery · collect ${formatMoney(s.codAmountMinor, store?.currency ?? "INR")}` : "Prepaid"}</Item>
            <Item label="Declared value">{formatMoney(s.declaredValueMinor, store?.currency ?? "INR")}</Item>
            <Item label="Weight">{s.weightGrams} g</Item>
            <Item label="Estimated delivery">{at(s.estimatedDelivery)}</Item>
            <Item label="Booked">{at(s.createdAt)}</Item>
            <Item label="Picked up">{at(s.pickedUpAt)}</Item>
            <Item label="Delivered">{at(s.deliveredAt)}</Item>
            <Item label="Last tracking sync">{at(s.lastSyncedAt)}</Item>
          </dl>
        </SectionCard>
        <SectionCard title="Items in this parcel">
          <ul className="divide-y rounded-md border text-sm">
            {s.items.map((i) => (
              <li key={i.orderItemId} className="flex justify-between gap-3 px-3 py-2">
                <span>{i.name}{i.sku ? <span className="text-xs text-muted-foreground"> · {i.sku}</span> : null}</span>
                <span className="tabular-nums">× {i.quantity}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
        <SectionCard title="Tracking history" description="Newest first.">
          {s.events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tracking events yet.</p>
          ) : (
            <ol className="space-y-3 border-l pl-4">
              {s.events.map((e, i) => (
                <li key={i} className="text-sm">
                  <p className="font-medium">{e.description || labelFor(SHIPMENT_STATUS_LABELS, e.status)}</p>
                  <p className="text-xs text-muted-foreground">
                    {[labelFor(SHIPMENT_STATUS_LABELS, e.status), e.location, at(e.occurredAt ?? e.recordedAt), e.source.replace(/_/g, " ")].filter(Boolean).join(" · ")}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </SectionCard>
      </div>
    </>
  );
}
