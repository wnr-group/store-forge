"use server";

import { revalidatePath } from "next/cache";
import { ROUTES } from "@/config/app";
import { run } from "@/lib/actions/run";
import { inventoryAdjustSchema } from "@/lib/validations/catalog";
import { parseInput } from "@/lib/validations/parse";
import { adjustStock } from "@/services/inventory.service";
import { invalidateStorefront } from "@/lib/storefront/cache";

export async function adjustStockAction(input: unknown) {
  return run(async () => {
    const result = await adjustStock(parseInput(inventoryAdjustSchema, input));
    revalidatePath(ROUTES.inventory);
    revalidatePath(ROUTES.products);
    revalidatePath(ROUTES.dashboard);
    await invalidateStorefront();
    return result;
  });
}
