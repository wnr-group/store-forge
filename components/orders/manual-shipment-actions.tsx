"use client";

import { useState } from "react";
import { updateManualShipmentAction } from "@/app/(dashboard)/dashboard/orders/actions";
import { ActionDialog } from "@/components/shared/action-dialog";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";

/** Where a hand-recorded parcel can go next (only forward). The API enforces the same order; the customer's tracking page follows. */
const NEXT: Record<string, { value: string; label: string }[]> = {
  created: [
    { value: "picked_up", label: "Picked up by the courier" },
    { value: "in_transit", label: "In transit" },
    { value: "out_for_delivery", label: "Out for delivery" },
    { value: "delivered", label: "Delivered" },
  ],
  picked_up: [
    { value: "in_transit", label: "In transit" },
    { value: "out_for_delivery", label: "Out for delivery" },
    { value: "delivered", label: "Delivered" },
  ],
  in_transit: [
    { value: "out_for_delivery", label: "Out for delivery" },
    { value: "delivered", label: "Delivered" },
    { value: "returned", label: "Returned to the store" },
  ],
  out_for_delivery: [
    { value: "delivered", label: "Delivered" },
    { value: "returned", label: "Returned to the store" },
  ],
};

export function ManualShipmentActions({ orderId, shipmentId, status }: { orderId: string; shipmentId: string; status: string }) {
  const options = NEXT[status] ?? [];
  const [open, setOpen] = useState(false);
  const [next, setNext] = useState(options[0]?.value ?? "");
  if (options.length === 0) return null;
  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        Update
      </Button>
      <ActionDialog
        open={open}
        onOpenChange={setOpen}
        title="Update shipment"
        description="The order and the customer's tracking page change with it."
        submitLabel="Update shipment"
        success="Shipment updated"
        onSubmit={() => updateManualShipmentAction(orderId, shipmentId, { status: next })}
      >
        <FormField id={`ms-next-${shipmentId}`} label="New status" required>
          <NativeSelect id={`ms-next-${shipmentId}`} value={next} onChange={(e) => setNext(e.target.value)}>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </FormField>
      </ActionDialog>
    </>
  );
}
