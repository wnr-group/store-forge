"use client";

import { Download, ExternalLink, FileText, RefreshCw, RotateCcw, XCircle } from "lucide-react";
import { cancelShipmentAction, generateLabelAction, refreshShipmentAction, retryShipmentAction } from "@/app/(dashboard)/dashboard/shipping/actions";
import { ActionButton } from "@/components/shared/action-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = { shipmentId: string; status: string; hasLabel: boolean; labelUrl: string | null; trackingUrl: string | null; canManage: boolean };

const TERMINAL = ["delivered", "returned", "cancelled", "failed"];

/** What can be done with a shipment. Booking, cancelling and tracking go through the carrier; the API enforces what each carrier supports. */
export function ShipmentActions({ shipmentId, status, hasLabel, labelUrl, trackingUrl, canManage }: Props) {
  const open = !TERMINAL.includes(status);
  return (
    <div className="flex flex-wrap gap-2">
      {hasLabel ? (
        <a href={`/dashboard/shipping/shipments/${shipmentId}/label`} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: "default" }))}>
          <Download aria-hidden /> Download label
        </a>
      ) : labelUrl ? (
        <a href={labelUrl} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: "default" }))}>
          <ExternalLink aria-hidden /> Open label
        </a>
      ) : null}
      {canManage && !hasLabel && !labelUrl && status !== "creating" && status !== "failed" && status !== "cancelled" ? (
        <ActionButton variant="default" size="default" action={() => generateLabelAction(shipmentId)} success="Label generated">
          <FileText aria-hidden /> Generate label
        </ActionButton>
      ) : null}
      {trackingUrl ? (
        <a href={trackingUrl} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: "outline" }))}>
          <ExternalLink aria-hidden /> Carrier tracking page
        </a>
      ) : null}
      {canManage && open && status !== "creating" && status !== "failed" ? (
        <ActionButton size="default" action={() => refreshShipmentAction(shipmentId)} success="Tracking updated">
          <RefreshCw aria-hidden /> Refresh tracking
        </ActionButton>
      ) : null}
      {canManage && status === "failed" ? (
        <ActionButton size="default" action={() => retryShipmentAction(shipmentId)} success="Shipment booked">
          <RotateCcw aria-hidden /> Retry booking
        </ActionButton>
      ) : null}
      {canManage && ["created"].includes(status) ? (
        <ActionButton size="default" variant="outline" action={() => cancelShipmentAction(shipmentId)} success="Shipment cancelled" confirm="Cancel this shipment with the carrier?">
          <XCircle aria-hidden /> Cancel shipment
        </ActionButton>
      ) : null}
    </div>
  );
}
