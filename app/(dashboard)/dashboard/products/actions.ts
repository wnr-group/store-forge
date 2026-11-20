"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ROUTES } from "@/config/app";
import { run } from "@/lib/actions/run";
import { idsSchema, productInputSchema, productStatusSchema } from "@/lib/validations/catalog";
import { parseInput } from "@/lib/validations/parse";
import { buildQuickEditPayload, createProduct, deleteProducts, duplicateProduct, getProductForQuickEdit, readQuickEdit, setProductsStatus, updateProduct } from "@/services/product.service";
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

const quickLookupSchema = z.object({ slug: z.string().min(1).max(200), name: z.string().max(300) });

/** The product behind a card in the theme editor, with the few fields the card shows. */
export async function getProductQuickEditAction(input: unknown) {
  return run(async () => {
    const v = parseInput(quickLookupSchema, input);
    return getProductForQuickEdit(v.slug, v.name);
  });
}

const quickEditSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  shortDescription: z.string(),
  price: z.string(),
  compareAtPrice: z.string(),
  imagePath: z.string().max(300).nullable(),
});

/**
 * Saves the name, short description, price and main picture of one product from the theme editor. The rest of the product is sent
 * back unchanged and the whole product goes through the same schema and update as the product page.
 */
export async function quickEditProductAction(input: unknown) {
  return run(async () => {
    const v = parseInput(quickEditSchema, input);
    const values = parseInput(productInputSchema, await buildQuickEditPayload(v));
    await updateProduct(values);
    await refresh();
    revalidatePath(`${ROUTES.products}/${v.id}`);
    return readQuickEdit(v.id);
  });
}
