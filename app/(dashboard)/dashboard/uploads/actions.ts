"use server";

import { z } from "zod";
import { run } from "@/lib/actions/run";
import { requestSignedUploadsApi, type UploadTarget } from "@/lib/api/endpoints/upload-api";
import { requireActiveTenant } from "@/lib/tenant/context";
import { IMAGE_TYPES, MAX_IMAGES_PER_PRODUCT, VIDEO_TYPES } from "@/lib/validations/catalog";
import { parseInput } from "@/lib/validations/parse";

const requestSchema = z.object({
  scope: z.enum(["product", "collection", "store", "catalog"]),
  /** Product / collection / catalog item id the files will belong to (ignored for the store logo). */
  ownerId: z.uuid().optional(),
  files: z.array(z.object({ type: z.enum([...IMAGE_TYPES, ...VIDEO_TYPES]), size: z.number().int().positive() })).min(1).max(MAX_IMAGES_PER_PRODUCT),
}).refine((v) => v.scope === "store" || v.files.every((f) => !(VIDEO_TYPES as readonly string[]).includes(f.type)), { message: "Videos can only be uploaded for the store" });

/**
 * Asks the StoreForge API for one-time signed upload URLs. The role is checked here first and again by the API, which
 * derives the tenant folder from the verified organization (never from the browser); Supabase Storage policies then
 * enforce the same rule independently. The file itself is still uploaded by the browser straight to Supabase Storage.
 */
export async function requestUploadsAction(input: unknown) {
  return run<UploadTarget[]>(async () => {
    const v = parseInput(requestSchema, input);
    const { tenant } = await requireActiveTenant(v.scope === "store" ? "store:manage" : "catalog:manage");
    if (v.scope !== "store" && !v.ownerId) throw new Error("ownerId is required");
    return requestSignedUploadsApi(tenant.id, { scope: v.scope, ownerId: v.scope === "store" ? undefined : v.ownerId, files: v.files });
  });
}
