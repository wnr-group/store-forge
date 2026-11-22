/**
 * Pure helpers for the uploaded-badge flow. The API answers are read defensively: a shape that is not understood is an error, never
 * guessed at. Nothing here talks to the network.
 *
 * Flow (all calls go through server actions; only the file bytes go straight from the browser to storage):
 *   1. GET  store/legal/wordings/badge_upload     -> the approved wording (shown word for word in the dialog)
 *   2. POST store/media-assets/upload-requests    -> asset id, path, signed upload address
 *   3. browser uploads the file to that address
 *   4. POST store/media-assets/:id/finalize       -> the asset is ready
 *   5. POST store/attestations {type, wordingKey, wordingVersion, assetId}
 * A badge stores only the asset id and its path (plus the alt text).
 */
export const BADGE_ATTESTATION_TYPE = "badge_upload";
export const BADGE_WORDING_KEY = "badge_upload";
export const BADGE_UPLOAD_TYPES = Object.freeze(["image/png", "image/jpeg", "image/webp"] as const);
export const BADGE_UPLOAD_MAX_BYTES = 1024 * 1024;

export type BadgeWording = { key: string; version: string; text: string };
export type BadgeUploadTarget = { assetId: string; path: string; uploadUrl: string };
export type BadgeAsset = { assetId: string; path: string };
export type AttestationInput = { type: typeof BADGE_ATTESTATION_TYPE; wordingKey: typeof BADGE_WORDING_KEY; wordingVersion: string | number; assetId: string };

const rec = (v: unknown): Record<string, unknown> | null => (v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const text = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);
const first = (r: Record<string, unknown> | null, keys: string[]): unknown => {
  for (const k of keys) if (r && r[k] !== undefined && r[k] !== null) return r[k];
  return undefined;
};

/** The approved wording as the API returns it, or null when the answer has no wording text or version (the dialog then cannot open). */
export function parseWording(raw: unknown): BadgeWording | null {
  const r = rec(raw);
  const body = text(first(r, ["text", "wording", "body", "content"]));
  const versionRaw = first(r, ["version", "wordingVersion"]);
  const version = typeof versionRaw === "number" && Number.isFinite(versionRaw) ? String(versionRaw) : text(versionRaw);
  if (!body || !version) return null;
  return { key: text(first(r, ["key", "wordingKey"])) ?? BADGE_WORDING_KEY, version, text: body };
}

/** The upload request answer: asset id, storage path and the address the browser uploads to. Accepts a flat or a nested answer. */
export function parseUploadTarget(raw: unknown): BadgeUploadTarget | null {
  const r = rec(raw);
  const asset = rec(first(r, ["asset"]));
  const upload = rec(first(r, ["upload"]));
  const assetId = text(first(asset, ["id", "assetId"])) ?? text(first(r, ["assetId", "id"]));
  const path = text(first(asset, ["path", "storagePath"])) ?? text(first(r, ["path", "storagePath"]));
  const uploadUrl = text(first(upload, ["signedUrl", "uploadUrl", "url"])) ?? text(first(r, ["signedUrl", "uploadUrl", "url"]));
  if (!assetId || !path || !uploadUrl) return null;
  return { assetId, path, uploadUrl };
}

/** The finalized asset: id and path. `fallback` (from the upload request) fills a field the finalize answer leaves out. */
export function parseFinalized(raw: unknown, fallback: BadgeAsset): BadgeAsset | null {
  const r = rec(raw);
  const inner = rec(first(r, ["asset"])) ?? r;
  const assetId = text(first(inner, ["id", "assetId"])) ?? fallback.assetId;
  const path = text(first(inner, ["path", "storagePath"])) ?? fallback.path;
  return assetId && path ? { assetId, path } : null;
}

export const attestationFor = (wording: Pick<BadgeWording, "version">, assetId: string): AttestationInput => ({
  type: BADGE_ATTESTATION_TYPE,
  wordingKey: BADGE_WORDING_KEY,
  wordingVersion: /^\d+$/.test(wording.version) ? Number(wording.version) : wording.version,
  assetId,
});

/** Why a file cannot be used as a badge image, or null when it can. */
export function badgeFileProblem(file: { type: string; size: number }): string | null {
  if (!(BADGE_UPLOAD_TYPES as readonly string[]).includes(file.type)) return "Use a PNG, JPEG or WebP image.";
  if (file.size <= 0) return "That file is empty.";
  if (file.size > BADGE_UPLOAD_MAX_BYTES) return "The image must be 1 MB or smaller.";
  return null;
}
