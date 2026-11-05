/**
 * Storage object paths. Pure helpers shared by the server and the tests.
 * Layout inside the `products` bucket:
 *   {tenantId}/{productId}/{file}        product media
 *   {tenantId}/collections/{id}/{file}   collection images
 *   {tenantId}/store/{file}              store logo
 * The database CHECK constraints and the Storage policies enforce the same layout.
 */
export const PRODUCT_BUCKET = "products";

export const EXTENSIONS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export const productFolder = (tenantId: string, productId: string) => `${tenantId}/${productId}`;
export const collectionFolder = (tenantId: string, collectionId: string) => `${tenantId}/collections/${collectionId}`;
export const storeFolder = (tenantId: string) => `${tenantId}/store`;

/** True when `path` is a direct child file of `folder` with no traversal tricks. */
export function isDirectChild(path: string, folder: string): boolean {
  if (!path.startsWith(`${folder}/`)) return false;
  const name = path.slice(folder.length + 1);
  return name.length > 0 && name.length <= 120 && !name.includes("/") && !name.includes("..") && /^[A-Za-z0-9._-]+$/.test(name);
}

export function newObjectName(mimeType: string): string | null {
  const ext = EXTENSIONS[mimeType];
  return ext ? `${crypto.randomUUID()}.${ext}` : null;
}

/** Public (CDN) URL of an object in the products bucket. Safe in the browser: the bucket is public-read. */
export function publicImageUrl(path: string | null | undefined): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!path || !base) return null;
  return `${base.replace(/\/$/, "")}/storage/v1/object/public/${PRODUCT_BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`;
}
