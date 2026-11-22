"use server";

import { revalidatePath } from "next/cache";
import { ROUTES } from "@/config/app";
import { run } from "@/lib/actions/run";
import { parseInput } from "@/lib/validations/parse";
import { paymentConfigSchema } from "@/lib/validations/payments";
import { removePaymentConfig, savePaymentConfig } from "@/services/payment.service";

// Tenant scope is NEVER an argument: payment.service resolves it from the validated session's Owner membership.
// Neither action ever returns the Key Secret: a save returns the safe status only.

export async function savePaymentConfigAction(input: unknown) {
  return run(
    async () => {
      const config = await savePaymentConfig(parseInput(paymentConfigSchema, input));
      revalidatePath(ROUTES.payments);
      return config;
    },
    { operation: "payments.save" },
  );
}

export async function removePaymentConfigAction() {
  return run(
    async () => {
      await removePaymentConfig();
      revalidatePath(ROUTES.payments);
    },
    { operation: "payments.remove" },
  );
}
