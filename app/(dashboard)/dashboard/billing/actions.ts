"use server";

import { revalidatePath } from "next/cache";
import { ROUTES } from "@/config/app";
import { run } from "@/lib/actions/run";
import { invoiceIdSchema, verifyPaymentSchema } from "@/lib/validations/billing";
import { parseInput } from "@/lib/validations/parse";
import { startInvoicePayment, verifyInvoicePayment } from "@/services/billing.service";

// Tenant scope is NEVER an argument: billing.service resolves it from the validated session's Owner membership.
// The amount is NEVER an argument either: the API takes it from the stored invoice.

/** Creates the Razorpay order for an invoice. Returns only what Checkout needs (the public key id, never a secret). */
export async function startInvoicePaymentAction(invoiceId: unknown) {
  return run(() => startInvoicePayment(parseInput(invoiceIdSchema, invoiceId)), { operation: "billing.pay.start" });
}

/** Sends Razorpay's success values to the API. The invoice only becomes paid when the API says so, never because the browser did. */
export async function verifyInvoicePaymentAction(input: unknown) {
  return run(
    async () => {
      const result = await verifyInvoicePayment(parseInput(verifyPaymentSchema, input));
      revalidatePath(ROUTES.billing);
      return result;
    },
    { operation: "billing.pay.verify" },
  );
}
