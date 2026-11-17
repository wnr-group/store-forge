"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ROUTES } from "@/config/app";
import { run } from "@/lib/actions/run";
import { idsSchema, productInputSchema, productStatusSchema } from "@/lib/validations/catalog";
import { parseInput } from "@/lib/validations/parse";
import { createProduct, deleteProducts, duplicateProduct, setProductsStatus, updateProduct } from "@/services/product.service";
import { invalidateStorefront } from "@/lib/storefront/cache";

const refresh = async () => {
  revalidatePath(ROUTES.products);
  revalidatePath(ROUTES.dashboard);
  revalidatePath(ROUTES.inventory);
  // What a shopper sees changed: drop this store's cached storefront data.
  await invalidateStorefront();
};

export async function createProductAction(input: unknown) {
  return run(async () => {
    const values = parseInput(productInputSchema, input);
    const result = await createProduct(values);
    await refresh();
    return result;
  });
}

export async function updateProductAction(input: unknown) {
  return run(async () => {
    const values = parseInput(productInputSchema, input);
    const result = await updateProduct(values);
    await refresh();
    revalidatePath(`${ROUTES.products}/${values.id}`);
    return result;
  });
}

export async function deleteProductsAction(ids: unknown) {
  return run(async () => {
    const count = await deleteProducts(parseInput(idsSchema, ids));
    await refresh();
    return { count };
  });
}

export async function setProductsStatusAction(ids: unknown, status: unknown) {
  return run(async () => {
    const count = await setProductsStatus(parseInput(idsSchema, ids), parseInput(productStatusSchema, status));
    await refresh();
    return { count };
  });
}

export async function duplicateProductAction(id: unknown) {
  return run(async () => {
    const result = await duplicateProduct(parseInput(z.uuid(), id));
    await refresh();
    return result;
  });
}
