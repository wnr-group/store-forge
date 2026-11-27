"use client";

import { useState } from "react";
import { Ban, PackageCheck, Truck } from "lucide-react";
import { bookShipmentAction, cancelOrderAction, changeOrderStatusAction, collectCodAction, recordShipmentAction } from "@/app/(dashboard)/dashboard/orders/actions";
import { ActionButton, ActionDialog } from "@/components/shared/action-dialog";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { labelFor, ORDER_STATUS_LABELS } from "./order-labels";

type Props = {
  orderId: string;
  status: string;
  paymentMethod: string | null;
  paymentStatus: string;
  fulfillmentStatus: string;
  nextStatuses: string[];
  canBookShipment: boolean;
};

const CARRIERS = [
  { value: "", label: "Automatic (your carrier preference)" },
  { value: "shiprocket", label: "Shiprocket" },
  { value: "delhivery", label: "Delhivery" },
  { value: "bluedart", label: "Blue Dart" },
];

/** What the merchant can do to an order. The buttons shown follow the API's own state machine (`nextStatuses`); the API enforces it again. */
export function OrderActions({ orderId, status, paymentMethod, paymentStatus, fulfillmentStatus, nextStatuses, canBookShipment }: Props) {
  const moves = nextStatuses.filter((s) => s !== "cancelled");
  const canCancel = nextStatuses.includes("cancelled");
  const [dialog, setDialog] = useState<"status" | "cancel" | "ship" | "manual" | null>(null);
  const [next, setNext] = useState(moves[0] ?? "");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [ship, setShip] = useState({ providerCode: "", weight: "", length: "", breadth: "", height: "" });
  const [manual, setManual] = useState({ courierName: "", trackingNumber: "", trackingUrl: "", estimatedDelivery: "" });

  const canCollect = paymentMethod === "cod" && paymentStatus === "pending_collection" && !["cancelled", "failed", "pending_payment"].includes(status);
  const shippable = canBookShipment && ["confirmed", "processing", "ready_to_ship"].includes(status) && fulfillmentStatus !== "fulfilled";

  const num = (v: string) => (v.trim() ? Number(v) : undefined);
  const close = (o: boolean) => !o && setDialog(null);

  if (!moves.length && !canCancel && !canCollect && !shippable) return <p className="text-sm text-muted-foreground">No actions are available for this order.</p>;

  return (
    <div className="flex flex-col gap-2">
      {shippable ? (
        <Button type="button" onClick={() => setDialog("ship")}>
          <Truck aria-hidden /> Book shipment
        </Button>
      ) : null}
      {shippable ? (
        <Button type="button" variant="outline" onClick={() => setDialog("manual")}>
          <Truck aria-hidden /> Add courier &amp; tracking number
        </Button>
      ) : null}
      {moves.length ? (
        <Button type="button" variant="outline" onClick={() => setDialog("status")}>
          <PackageCheck aria-hidden /> Update status
        </Button>
      ) : null}
      {canCollect ? (
        <ActionButton variant="outline" size="default" success="Cash marked as collected" action={() => collectCodAction(orderId)} confirm="Confirm that the cash for this order was collected?">
          Mark cash collected
        </ActionButton>
      ) : null}
      {canCancel ? (
        <Button type="button" variant="outline" className="text-destructive" onClick={() => setDialog("cancel")}>
          <Ban aria-hidden /> Cancel order
        </Button>
      ) : null}

      <ActionDialog
        open={dialog === "manual"}
        onOpenChange={close}
        title="Add courier and tracking number"
        description="For parcels you send with your own courier. The customer sees the provider, tracking number and link in their account straight away."
        submitLabel="Save shipment"
        success="Shipment recorded"
        onSubmit={() => recordShipmentAction(orderId, { courierName: manual.courierName, trackingNumber: manual.trackingNumber, trackingUrl: manual.trackingUrl || undefined, estimatedDelivery: manual.estimatedDelivery || undefined })}
      >
        <FormField id="ms-courier" label="Shipping provider" required>
          <Input id="ms-courier" maxLength={60} placeholder="India Post, DTDC…" value={manual.courierName} onChange={(e) => setManual({ ...manual, courierName: e.target.value })} />
        </FormField>
        <FormField id="ms-awb" label="Tracking number" required>
          <Input id="ms-awb" maxLength={60} value={manual.trackingNumber} onChange={(e) => setManual({ ...manual, trackingNumber: e.target.value })} />
        </FormField>
        <FormField id="ms-url" label="Tracking link" optional hint="Starts with https://">
          <Input id="ms-url" inputMode="url" maxLength={500} value={manual.trackingUrl} onChange={(e) => setManual({ ...manual, trackingUrl: e.target.value })} />
        </FormField>
        <FormField id="ms-eta" label="Expected delivery date" optional>
          <Input id="ms-eta" type="date" value={manual.estimatedDelivery} onChange={(e) => setManual({ ...manual, estimatedDelivery: e.target.value })} />
        </FormField>
      </ActionDialog>

      <ActionDialog open={dialog === "status"} onOpenChange={close} title="Update order status" description="Only the next steps this order can take are listed." submitLabel="Update status" success="Order updated" onSubmit={() => changeOrderStatusAction(orderId, { status: next, note })}>
        <FormField id="os-status" label="New status" required>
          <NativeSelect id="os-status" value={next} onChange={(e) => setNext(e.target.value)}>
            {moves.map((s) => (
              <option key={s} value={s}>
                {labelFor(ORDER_STATUS_LABELS, s)}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField id="os-note" label="Note" optional>
          <Textarea id="os-note" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        </FormField>
      </ActionDialog>

      <ActionDialog open={dialog === "cancel"} onOpenChange={close} title="Cancel this order" description="Stock held or sold for it goes back on sale. A paid online order has to be refunded from Payments first." submitLabel="Cancel order" pendingLabel="Cancelling…" destructive success="Order cancelled" onSubmit={() => cancelOrderAction(orderId, { reason })}>
        <FormField id="oc-reason" label="Reason" required>
          <Textarea id="oc-reason" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
        </FormField>
      </ActionDialog>

      <ActionDialog
        open={dialog === "ship"}
        onOpenChange={close}
        title="Book a shipment"
        description="Books every item not yet shipped with one of your connected carriers. The carrier must serve the delivery PIN code."
        submitLabel="Book shipment"
        pendingLabel="Booking with the carrier…"
        success="Shipment booked"
        onSubmit={() => bookShipmentAction(orderId, { providerCode: ship.providerCode || undefined, weightGrams: num(ship.weight), lengthCm: num(ship.length), breadthCm: num(ship.breadth), heightCm: num(ship.height) })}
      >
        <FormField id="bs-carrier" label="Carrier">
          <NativeSelect id="bs-carrier" value={ship.providerCode} onChange={(e) => setShip({ ...ship, providerCode: e.target.value })}>
            {CARRIERS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField id="bs-weight" label="Parcel weight (grams)" optional hint="Leave empty to use the weight worked out from the items.">
          <Input id="bs-weight" inputMode="numeric" value={ship.weight} onChange={(e) => setShip({ ...ship, weight: e.target.value.replace(/\D/g, "") })} />
        </FormField>
        <div className="grid grid-cols-3 gap-3">
          <FormField id="bs-l" label="Length (cm)" optional>
            <Input id="bs-l" inputMode="numeric" value={ship.length} onChange={(e) => setShip({ ...ship, length: e.target.value.replace(/\D/g, "") })} />
          </FormField>
          <FormField id="bs-b" label="Breadth (cm)" optional>
            <Input id="bs-b" inputMode="numeric" value={ship.breadth} onChange={(e) => setShip({ ...ship, breadth: e.target.value.replace(/\D/g, "") })} />
          </FormField>
          <FormField id="bs-h" label="Height (cm)" optional>
            <Input id="bs-h" inputMode="numeric" value={ship.height} onChange={(e) => setShip({ ...ship, height: e.target.value.replace(/\D/g, "") })} />
          </FormField>
        </div>
      </ActionDialog>
    </div>
  );
}
