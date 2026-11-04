"use server";

import { inArray } from "drizzle-orm";
import { z } from "zod";
import { run } from "@/lib/actions/run";
import { collections, productImages, stores } from "@/lib/db/schema";
import { AppError } from "@/lib/errors";
import { removeObjects } from "@/lib/storage/server";
import { requireActiveTenant, withTenantDb } from "@/lib/tenant/context";
import { parseInput } from "@/lib/validations/parse";

/**
 * Deletes files that were uploaded but never saved against a record (the editor removed
 * them, or the user replaced them). Every path must sit under the caller's own tenant
 * folder AND must not be referenced by the database - referenced images are only ever
 * removed by the save transaction that unlinks them.
 */
export async function discardUploadsAction(paths: unknown) {
  return run(async () => {
    const list = parseInput(z.array(z.string().min(10).max(300)).min(1).max(20), paths);
    const { tenant } = await requireActiveTenant("catalog:manage");
    const prefix = `${tenant.id}/`;
    if (list.some((p) => !p.startsWith(prefix) || p.includes(".."))) throw new AppError("FORBIDDEN", "You can only remove your own uploads.");
    const referenced = await withTenantDb({ tenantId: tenant.id }, async (tx) => {
      const [a, b, c] = await Promise.all([
        tx.select({ p: productImages.storagePath }).from(productImages).where(inArray(productImages.storagePath, list)),
        tx.select({ p: collections.imagePath }).from(collections).where(inArray(collections.imagePath, list)),
        tx.select({ p: stores.logoUrl }).from(stores).where(inArray(stores.logoUrl, list)),
      ]);
      return new Set([...a, ...b, ...c].map((r) => r.p));
    });
    await removeObjects(list.filter((p) => !referenced.has(p)));
  });
}
