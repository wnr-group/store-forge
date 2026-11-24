"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ROUTES } from "@/config/app";
import { run } from "@/lib/actions/run";
import { parseInput } from "@/lib/validations/parse";
import { deleteAbandonedCart, saveAbandonedCartSettings } from "@/services/marketing.service";

// The tenant is never an argument: marketing.service resolves it from the verified session and checks the permission first.
export async function saveAbandonedCartSettingsAction(input: unknown) {
  return run(
    async () => {
      const v = parseInput(
        z.object({
          abandonmentThresholdMinutes: z.number({ error: "Enter the number of minutes." }).int("Enter a whole number.").min(15, "At least 15 minutes.").max(10080, "At most 7 days (10080 minutes)."),
          recoveryLinkDays: z.number({ error: "Enter the number of days." }).int("Enter a whole number.").min(1, "At least 1 day.").max(90, "At most 90 days."),
        }),
        input,
      );
      await saveAbandonedCartSettings(v);
      revalidatePath(ROUTES.abandonedCarts);
    },
    { operation: "marketing.carts.settings" },
  );
}

/** Erases a saved cart and the customer details kept with it. Its recovery link stops working. */
export async function deleteAbandonedCartAction(cartId: unknown) {
  return run(
    async () => {
      await deleteAbandonedCart(parseInput(z.string().uuid(), cartId));
      revalidatePath(ROUTES.abandonedCarts);
    },
    { operation: "marketing.carts.erase" },
  );
}
