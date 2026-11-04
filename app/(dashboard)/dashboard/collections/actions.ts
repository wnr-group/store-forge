"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ROUTES } from "@/config/app";
import { run } from "@/lib/actions/run";
import { collectionInputSchema } from "@/lib/validations/catalog";
import { parseInput } from "@/lib/validations/parse";
import { createCollection, deleteCollection, updateCollection } from "@/services/collection.service";

const refresh = () => {
  revalidatePath(ROUTES.collections);
  revalidatePath(ROUTES.products);
};

/** `id` is client-generated for new collections so the image can be uploaded under its folder first. */
export async function saveCollectionAction(mode: unknown, id: unknown, input: unknown) {
  return run(async () => {
    const collectionId = parseInput(z.uuid(), id);
    const values = parseInput(collectionInputSchema, input);
    if (mode === "create") await createCollection(collectionId, values);
    else await updateCollection(collectionId, values);
    refresh();
    return { id: collectionId };
  });
}

export async function deleteCollectionAction(id: unknown) {
  return run(async () => {
    await deleteCollection(parseInput(z.uuid(), id));
    refresh();
  });
}

