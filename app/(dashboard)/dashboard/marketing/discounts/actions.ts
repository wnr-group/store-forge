"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ROUTES } from "@/config/app";
import { run } from "@/lib/actions/run";
import { discountPayloadSchema } from "@/lib/marketing/forms";
import { parseInput } from "@/lib/validations/parse";
import { createDiscount, deleteDiscount, getDiscount, setDiscountActive, updateDiscount } from "@/services/marketing.service";

const id = z.string().uuid();

// The tenant is never an argument: marketing.service resolves it from the verified session and checks the permission first.
// The API decides whether a code applies to an order; nothing here (or in the browser) prices anything.
export async function saveDiscountAction(discountId: string | null, input: unknown) {
  return run(
    async () => {
      const v = parseInput(discountPayloadSchema, input);
      if (discountId === null) {
        const created = await createDiscount(v);
        revalidatePath(ROUTES.discounts);
        return { id: created.id };
      }
      const { code: _code, ...rest } = v;
      void _code;
      await updateDiscount(parseInput(id, discountId), rest);
      revalidatePath(ROUTES.discounts);
      revalidatePath(ROUTES.campaigns);
      return { id: discountId };
    },
    { operation: "marketing.discount.save" },
  );
}

/** The full code (targets included), for the edit form. */
export async function getDiscountAction(discountId: unknown) {
  return run(async () => getDiscount(parseInput(id, discountId)));
}

export async function setDiscountActiveAction(discountId: unknown, isActive: unknown) {
  return run(
    async () => {
      await setDiscountActive(parseInput(id, discountId), parseInput(z.boolean(), isActive));
      revalidatePath(ROUTES.discounts);
    },
    { operation: "marketing.discount.toggle" },
  );
}

export async function deleteDiscountAction(discountId: unknown) {
  return run(
    async () => {
      await deleteDiscount(parseInput(id, discountId));
      revalidatePath(ROUTES.discounts);
    },
    { operation: "marketing.discount.delete" },
  );
}
