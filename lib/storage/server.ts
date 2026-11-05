import "server-only";
import { AppError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { IMAGE_MAX_BYTES, IMAGE_TYPES } from "@/lib/validations/catalog";
import { isDirectChild, newObjectName, PRODUCT_BUCKET } from "./paths";

/**
 * Storage runs with the signed-in user's own Supabase session (cookie client),
 * so the Storage policies from migration 0006 are the authority: they require
 * tenant membership by path. Callers must ALSO have checked the tenant role
 * (requireTenantRole) - this is defence in depth, not a replacement.
 * The service-role key is never used.
 */

export type UploadTarget = { path: string; token: string; signedUrl: string };

type FileMeta = { type: string; size: number };

export async function createUploadTargets(folder: string, files: FileMeta[]): Promise<UploadTarget[]> {
  for (const f of files) {
    if (!(IMAGE_TYPES as readonly string[]).includes(f.type)) throw new AppError("VALIDATION", "Only JPEG, PNG and WebP images are allowed.");
    if (f.size <= 0 || f.size > IMAGE_MAX_BYTES) throw new AppError("VALIDATION", "Each image must be 5 MB or smaller.");
  }
  const supabase = await createClient();
  const targets: UploadTarget[] = [];
  for (const f of files) {
    const name = newObjectName(f.type);
    if (!name) throw new AppError("VALIDATION", "Unsupported image type.");
    const path = `${folder}/${name}`;
    const { data, error } = await supabase.storage.from(PRODUCT_BUCKET).createSignedUploadUrl(path);
    if (error || !data) {
      console.error("[storage] createSignedUploadUrl", error?.message);
      throw new AppError("FORBIDDEN", "You are not allowed to upload here.");
    }
    targets.push({ path, token: data.token, signedUrl: data.signedUrl });
  }
  return targets;
}

export type VerifiedObject = { path: string; mimeType: string; sizeBytes: number };

/**
 * Confirms each path is a direct child of `folder` AND really exists in the
 * bucket, taking type and size from Storage (never from the browser).
 */
export async function verifyObjects(folder: string, paths: string[]): Promise<VerifiedObject[]> {
  if (paths.length === 0) return [];
  for (const p of paths) if (!isDirectChild(p, folder)) throw new AppError("VALIDATION", "An uploaded image has an invalid path.");
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(PRODUCT_BUCKET).list(folder, { limit: 1000 });
  if (error) {
    console.error("[storage] list", error.message);
    throw new AppError("UNKNOWN", "Could not verify the uploaded images. Please try again.");
  }
  const byName = new Map((data ?? []).map((o) => [o.name, o]));
  return paths.map((path) => {
    const obj = byName.get(path.slice(folder.length + 1));
    const mimeType = (obj?.metadata as { mimetype?: string } | null)?.mimetype;
    const sizeBytes = (obj?.metadata as { size?: number } | null)?.size;
    if (!obj || !mimeType || !sizeBytes) throw new AppError("VALIDATION", "An image upload did not finish. Please upload it again.");
    if (!(IMAGE_TYPES as readonly string[]).includes(mimeType) || sizeBytes > IMAGE_MAX_BYTES)
      throw new AppError("VALIDATION", "An uploaded image is not an allowed type or size.");
    return { path, mimeType, sizeBytes };
  });
}

/** Best-effort removal; a failure leaves an unreferenced object, never a dangling DB reference. */
export async function removeObjects(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  try {
    const supabase = await createClient();
    const { error } = await supabase.storage.from(PRODUCT_BUCKET).remove(paths);
    if (error) console.error("[storage] remove", error.message);
  } catch (e) {
    console.error("[storage] remove", e);
  }
}
