"use server";

import { z } from "zod";
import { run } from "@/lib/actions/run";
import { AppError } from "@/lib/errors";
import { removeUnreferencedObjects } from "@/services/storage-references.service";
import { requireActiveTenant } from "@/lib/tenant/context";
import { parseInput } from "@/lib/validations/parse";

/**
 * Deletes files that were uploaded but never saved against a record (the editor removed
 * them, or the user replaced them). Every path must sit under the caller's own tenant
 * folder AND must not be referenced anywhere (catalog rows, V1 template settings, template
 * drafts or any published version); removeUnreferencedObjects checks that under a per-path lock.
 */
export async function discardUploadsAction(paths: unknown) {
  return run(async () => {
    const list = parseInput(z.array(z.string().min(10).max(300)).min(1).max(20), paths);
    const { tenant } = await requireActiveTenant("catalog:manage");
    const prefix = `${tenant.id}/`;
    if (list.some((p) => !p.startsWith(prefix) || p.includes(".."))) throw new AppError("FORBIDDEN", "You can only remove your own uploads.");
    await removeUnreferencedObjects(tenant.id, list);
  });
}
