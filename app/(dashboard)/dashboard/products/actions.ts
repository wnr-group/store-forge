"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ROUTES } from "@/config/app";
import { run } from "@/lib/actions/run";
import { idsSchema, productInputSchema, productStatusSchema } from "@/lib/validations/catalog";
import { parseInput } from "@/lib/validations/parse";
import { createProduct, deleteProducts, duplicateProduct, setProductsStatus, updateProduct } from "@/services/product.service";

const refresh = () => {
  revalidatePath(ROUTES.products);
  revalidatePath(ROUTES.dashboard);
  revalidatePath(ROUTES.inventory);
};

export async function createProductAction(input: unknown) {
  return run(async () => {
    const values = parseInput(productInputSchema, input);
    const result = await createProduct(values);
    refresh();
    return result;
  });
}

export async function updateProductAction(input: unknown) {
  return run(async () => {
    const values = parseInput(productInputSchema, input);
    const result = await updateProduct(values);
    refresh();
    revalidatePath(`${ROUTES.products}/${values.id}`);
    return result;
  });
}

export async function deleteProductsAction(ids: unknown) {
  return run(async () => {
    const count = await deleteProducts(parseInput(idsSchema, ids));
    refresh();
    return { count };
  });
}

export async function setProductsStatusAction(ids: unknown, status: unknown) {
  return run(async () => {
    const count = await setProductsStatus(parseInput(idsSchema, ids), parseInput(productStatusSchema, status));
    refresh();
    return { count };
  });
}

export async function duplicateProductAction(id: unknown) {
  return run(async () => {
    const result = await duplicateProduct(parseInput(z.uuid(), id));
    refresh();
    return result;
  });
}
