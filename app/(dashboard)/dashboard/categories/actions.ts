"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ROUTES } from "@/config/app";
import { run } from "@/lib/actions/run";
import { categoryInputSchema } from "@/lib/validations/catalog";
import { parseInput } from "@/lib/validations/parse";
import { orderCategories } from "@/lib/categories/hierarchy";
import { createCategory, deleteCategory, listCategories, normalize, updateCategory } from "@/services/category.service";
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

/** Every category with its parent, for the parent picker of the category form. */
export async function listCategoryRowsAction() {
  return run(async () => (await listCategories()).map((c) => ({ id: c.id, name: c.name, parentId: c.parentId })));
}

/** The store's categories as a flat, indented list for a picker (a parent before its children). */
export async function listCategoryChoicesAction() {
  return run(async () => orderCategories(await listCategories()).map((c) => ({ id: c.id, label: c.label })));
}
