/**
 * What the item dialog sends about an item's picture. Pure functions (no browser, no server) so the rules are tested on their own.
 *
 * The picture is uploaded first (straight to storage, with a link the API issued for this item's own folder) and only its storage path
 * is saved with the item. A new item therefore needs its id before it exists: the dialog makes one and sends it with the item.
 */

/** The part of the uploader's state these rules read. */
export type PickedImage = { status: "uploading" | "done" | "error"; path: string | null };

export const IMAGE_ALT_MAX = 200;

/** Why the item cannot be saved yet because of its picture, or null when it can. */
export function imageProblem(images: readonly PickedImage[]): string | null {
  if (images.some((i) => i.status === "uploading")) return "Wait for the image to finish uploading.";
  if (images.some((i) => i.status === "error")) return "Remove the image that failed to upload, or upload it again.";
  return null;
}

/** The storage path of the finished upload, or null when there is none. */
export const pickedPath = (images: readonly PickedImage[]): string | null => images.find((i) => i.status === "done" && i.path)?.path ?? null;

const cleanAlt = (alt: string): string | null => alt.trim() || null;

/** A new item: the picture and its description only when there is a picture. */
export function createImageFields(images: readonly PickedImage[], alt: string): { imagePath?: string; imageAlt?: string } {
  const path = pickedPath(images);
  if (!path) return {};
  const text = cleanAlt(alt);
  return { imagePath: path, ...(text ? { imageAlt: text } : {}) };
}

/**
 * An existing item: nothing when nothing changed, the new path (with its description) for a replacement, and `null` for both when the
 * picture was removed (the API clears the description with it). A changed description alone is sent without the path.
 */
export function updateImageFields(initial: { imagePath: string | null; imageAlt: string | null }, images: readonly PickedImage[], alt: string): { imagePath?: string | null; imageAlt?: string | null } {
  const path = pickedPath(images);
  const text = cleanAlt(alt);
  if (path !== initial.imagePath) return path === null ? { imagePath: null, imageAlt: null } : { imagePath: path, imageAlt: text };
  if (path !== null && text !== (initial.imageAlt?.trim() || null)) return { imageAlt: text };
  return {};
}
