"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ROUTES } from "@/config/app";
import { run } from "@/lib/actions/run";
import { customerInputSchema } from "@/lib/validations/catalog";
import { parseInput } from "@/lib/validations/parse";
import { createCustomer, deleteCustomer, updateCustomer } from "@/services/customer.service";

export async function saveCustomerAction(id: unknown, input: unknown) {
  return run(async () => {
    const values = parseInput(customerInputSchema, input);
    let result: { id: string } | undefined;
    if (id) await updateCustomer(parseInput(z.uuid(), id), values);
    else result = await createCustomer(values);
    revalidatePath(ROUTES.customers);
    revalidatePath(ROUTES.dashboard);
    return result;
  });
}

export async function deleteCustomerAction(id: unknown) {
  return run(async () => {
    await deleteCustomer(parseInput(z.uuid(), id));
    revalidatePath(ROUTES.customers);
    revalidatePath(ROUTES.dashboard);
  });
}
