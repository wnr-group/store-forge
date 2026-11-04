"use server";

import { z } from "zod";
import { run } from "@/lib/actions/run";
import { collectionFolder, productFolder, storeFolder } from "@/lib/storage/paths";
import { createUploadTargets, type UploadTarget } from "@/lib/storage/server";
import { requireActiveTenant } from "@/lib/tenant/context";
import { IMAGE_TYPES, MAX_IMAGES_PER_PRODUCT } from "@/lib/validations/catalog";
import { parseInput } from "@/lib/validations/parse";

const requestSchema = z.object({
  scope: z.enum(["product", "collection", "store"]),
  /** Product / collection id the files will belong to (ignored for the store logo). */
  ownerId: z.uuid().optional(),
  files: z.array(z.object({ type: z.enum(IMAGE_TYPES), size: z.number().int().positive() })).min(1).max(MAX_IMAGES_PER_PRODUCT),
});

/**
 * Issues one-time signed upload URLs. The tenant folder comes from the server-verified
 * membership - never from the browser - and the role is checked before any URL is
 * issued. Supabase Storage policies then enforce the same rule independently.
 */
export async function requestUploadsAction(input: unknown) {
  return run<UploadTarget[]>(async () => {
    const v = parseInput(requestSchema, input);
    const { tenant } = await requireActiveTenant(v.scope === "store" ? "store:manage" : "catalog:manage");
    if (v.scope !== "store" && !v.ownerId) throw new Error("ownerId is required");
    const folder =
      v.scope === "store" ? storeFolder(tenant.id) : v.scope === "collection" ? collectionFolder(tenant.id, v.ownerId!) : productFolder(tenant.id, v.ownerId!);
    return createUploadTargets(folder, v.files);
  });
}
