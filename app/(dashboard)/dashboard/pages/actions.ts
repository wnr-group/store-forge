"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ROUTES } from "@/config/app";
import { run } from "@/lib/actions/run";
import { pageInputSchema } from "@/lib/validations/pages";
import { parseInput } from "@/lib/validations/parse";
import { createPage, deletePage, updatePage } from "@/services/pages.service";
import { getActiveStore } from "@/lib/tenant/context";
import { invalidateStorefront } from "@/lib/storefront/cache";

/**
 * Server actions behind Online Store > Pages. Each one checks the member's permission through the service, forwards to
 * the StoreForge API, and refreshes this store's public pages so a change shows on the storefront straight away.
 */

async function refresh() {
  revalidatePath(ROUTES.pages);
  await invalidateStorefront();
  const store = await getActiveStore();
  if (store) revalidatePath(`/s/${store.slug}`, "layout");
}

export async function savePageAction(id: unknown, input: unknown) {
  return run(
    async () => {
      const pageId = id === null ? null : parseInput(z.uuid(), id);
      const values = parseInput(pageInputSchema, input);
      const saved = pageId ? await updatePage(pageId, values) : await createPage(values);
      await refresh();
      return { id: saved.id, slug: saved.slug };
    },
    { operation: "page.save" },
  );
}

export async function deletePageAction(id: unknown) {
  return run(
    async () => {
      await deletePage(parseInput(z.uuid(), id));
      await refresh();
    },
    { operation: "page.delete" },
  );
}
