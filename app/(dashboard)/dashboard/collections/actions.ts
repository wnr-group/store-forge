"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ROUTES } from "@/config/app";
import { run } from "@/lib/actions/run";
import { collectionInputSchema } from "@/lib/validations/catalog";
import { parseInput } from "@/lib/validations/parse";
import { buildCollectionQuickEditValues, createCollection, deleteCollection, getCollectionForQuickEdit, listProductOptions, updateCollection } from "@/services/collection.service";
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

/** The collection behind a card in the theme editor, with the few fields the card shows. */
export async function getCollectionQuickEditAction(id: unknown) {
  return run(async () => getCollectionForQuickEdit(parseInput(z.uuid(), id)));
}

const quickEditSchema = z.object({ id: z.uuid(), name: z.string(), description: z.string(), imagePath: z.string().max(300).nullable() });

/**
 * Saves the name, description and picture of one collection from the theme editor. The rest of the collection (status, address,
 * products) is sent back unchanged and the whole collection goes through the same schema and update as the collection page.
 */
export async function quickEditCollectionAction(input: unknown) {
  return run(async () => {
    const v = parseInput(quickEditSchema, input);
    const values = parseInput(collectionInputSchema, await buildCollectionQuickEditValues(v));
    await updateCollection(v.id, values);
    await refresh();
    revalidatePath(`${ROUTES.collections}/${v.id}`);
    return getCollectionForQuickEdit(v.id);
  });
}
