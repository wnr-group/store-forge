"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ROUTES } from "@/config/app";
import { run } from "@/lib/actions/run";
import { categoryInputSchema } from "@/lib/validations/catalog";
import { parseInput } from "@/lib/validations/parse";
import { createCategory, deleteCategory, normalize, updateCategory } from "@/services/category.service";
import { invalidateStorefront } from "@/lib/storefront/cache";

const refresh = async () => {
  revalidatePath(ROUTES.categories);
  revalidatePath(ROUTES.products);
  // What a shopper sees changed: drop this store's cached storefront data.
  await invalidateStorefront();
};

export async function saveCategoryAction(id: unknown, input: unknown) {
  return run(async () => {
    const values = normalize(parseInput(categoryInputSchema, input));
    if (id) await updateCategory(parseInput(z.uuid(), id), values);
    else await createCategory(values);
    await refresh();
  });
}

export async function deleteCategoryAction(id: unknown) {
  return run(async () => {
    await deleteCategory(parseInput(z.uuid(), id));
    await refresh();
  });
}
