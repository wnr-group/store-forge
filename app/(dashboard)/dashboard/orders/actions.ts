"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ROUTES } from "@/config/app";
import { run } from "@/lib/actions/run";
import { parseInput } from "@/lib/validations/parse";
import { bookShipment, cancelOrder, changeOrderStatus, collectCod } from "@/services/order.service";

// The tenant is never an argument: order.service resolves it from the verified session. The API decides whether a status
// change is allowed; these actions only check the shape of what the browser sent.
const id = z.uuid();
const refresh = (orderId: string) => {
  revalidatePath(ROUTES.orders);
  revalidatePath(`${ROUTES.orders}/${orderId}`);
  revalidatePath(ROUTES.shipments);
};

export async function changeOrderStatusAction(orderId: unknown, input: unknown) {
  return run(
    async () => {
      const oid = parseInput(id, orderId);
      const v = parseInput(z.object({ status: z.string().min(1).max(40), note: z.string().trim().max(500).optional() }), input);
      await changeOrderStatus(oid, { status: v.status, note: v.note || undefined });
      refresh(oid);
    },
    { operation: "orders.status" },
  );
}

export async function cancelOrderAction(orderId: unknown, input: unknown) {
  return run(
    async () => {
      const oid = parseInput(id, orderId);
      const v = parseInput(z.object({ reason: z.string({ error: "Give a reason." }).trim().min(1, "Give a reason for cancelling.").max(500) }), input);
      await cancelOrder(oid, v.reason);
      refresh(oid);
    },
    { operation: "orders.cancel" },
  );
}

export async function collectCodAction(orderId: unknown) {
  return run(
    async () => {
      const oid = parseInput(id, orderId);
      await collectCod(oid);
      refresh(oid);
    },
    { operation: "orders.cod.collect" },
  );
}

const dim = z.number().int().min(1).max(1_000_000_000).optional();

export async function bookShipmentAction(orderId: unknown, input: unknown) {
  return run(
    async () => {
      const oid = parseInput(id, orderId);
      const v = parseInput(
        z.object({
          providerCode: z.string().regex(/^[a-z][a-z0-9_]{1,31}$/).optional(),
          serviceCode: z.string().min(1).max(100).optional(),
          weightGrams: dim,
          lengthCm: z.number().int().min(1).max(1000).optional(),
          breadthCm: z.number().int().min(1).max(1000).optional(),
          heightCm: z.number().int().min(1).max(1000).optional(),
        }),
        input,
      );
      const shipment = await bookShipment(oid, v);
      refresh(oid);
      return { id: shipment.id, status: shipment.status, awb: shipment.awb };
    },
    { operation: "orders.shipment.book" },
  );
}
