"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ROUTES } from "@/config/app";
import { run } from "@/lib/actions/run";
import { AppError } from "@/lib/errors";
import { parseMoney } from "@/lib/money";
import { parseInput } from "@/lib/validations/parse";
import { refundTransaction, saveCodSettings, syncRefund } from "@/services/payment-ledger.service";

// Owner-only (payments:manage), checked by payment-ledger.service before anything is sent; the API checks again.
const bad = (field: string, message: string): never => {
  throw new AppError("VALIDATION", "Please correct the highlighted fields.", { [field]: message });
};

export async function saveCodSettingsAction(input: unknown) {
  return run(
    async () => {
      const v = parseInput(z.object({ enabled: z.boolean(), min: z.string().max(20), max: z.string().max(20), fee: z.string().max(20), currency: z.string().length(3) }), input);
      const minOrderMinor = v.min.trim() === "" ? 0 : (parseMoney(v.min, v.currency) ?? bad("min", "Enter a valid amount."));
      const feeMinor = v.fee.trim() === "" ? 0 : (parseMoney(v.fee, v.currency) ?? bad("fee", "Enter a valid amount."));
      const maxOrderMinor = v.max.trim() === "" ? null : (parseMoney(v.max, v.currency) ?? bad("max", "Enter a valid amount."));
      if (maxOrderMinor !== null && maxOrderMinor < minOrderMinor) bad("max", "The maximum must be at least the minimum.");
      await saveCodSettings({ enabled: v.enabled, minOrderMinor, maxOrderMinor, feeMinor });
      revalidatePath(ROUTES.payments);
    },
    { operation: "payments.cod.save" },
  );
}

export async function refundAction(transactionId: unknown, input: unknown) {
  return run(
    async () => {
      const tid = parseInput(z.uuid(), transactionId);
      const v = parseInput(
        z.object({
          amount: z.string().max(20),
          currency: z.string().length(3),
          full: z.boolean(),
          reason: z.string({ error: "Give a reason." }).trim().min(1, "Give a reason for the refund.").max(500),
          idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{8,128}$/),
        }),
        input,
      );
      let amountMinor: number | undefined;
      if (!v.full) amountMinor = parseMoney(v.amount, v.currency) ?? bad("amount", "Enter the amount to refund.");
      if (amountMinor !== undefined && amountMinor < 1) bad("amount", "Enter an amount above zero.");
      const refund = await refundTransaction(tid, { amountMinor, reason: v.reason }, v.idempotencyKey);
      revalidatePath(ROUTES.transactions);
      revalidatePath(ROUTES.refunds);
      revalidatePath(ROUTES.orders);
      return { id: refund.id, status: refund.status };
    },
    { operation: "payments.refund" },
  );
}

export async function syncRefundAction(refundId: unknown) {
  return run(
    async () => {
      await syncRefund(parseInput(z.uuid(), refundId));
      revalidatePath(ROUTES.transactions);
      revalidatePath(ROUTES.refunds);
    },
    { operation: "payments.refund.sync" },
  );
}
