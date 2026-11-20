"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ROUTES } from "@/config/app";
import { run } from "@/lib/actions/run";
import { collectionInputSchema } from "@/lib/validations/catalog";
import { parseInput } from "@/lib/validations/parse";
import { createCollection, deleteCollection, listProductOptions, updateCollection } from "@/services/collection.service";
import { invalidateStorefront } from "@/lib/storefront/cache";

const refresh = async () => {
  revalidatePath(ROUTES.collections);
  revalidatePath(ROUTES.products);
  // What a shopper sees changed: drop this store's cached storefront data.
  await invalidateStorefront();
};

/** `id` is client-generated for new collections so the image can be uploaded under its folder first. */
export async function saveCollectionAction(mode: unknown, id: unknown, input: unknown) {
  return run(async () => {
    const collectionId = parseInput(z.uuid(), id);
    const values = parseInput(collectionInputSchema, input);
    if (mode === "create") await createCollection(collectionId, values);
    else await updateCollection(collectionId, values);
    await refresh();
    return { id: collectionId };
  });
}

export async function deleteCollectionAction(id: unknown) {
  return run(async () => {
    await deleteCollection(parseInput(z.uuid(), id));
    await refresh();
  });
}

/** The store's products (id and name) for the product picker of the collection form. */
export async function listProductOptionsAction() {
  return run(async () => listProductOptions());
}
