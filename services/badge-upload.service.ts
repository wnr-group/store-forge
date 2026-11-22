import "server-only";
import {
  createAttestationApi,
  finalizeMediaAssetApi,
  getLegalWordingApi,
  requestMediaUploadApi,
} from "@/lib/api/endpoints/badge-upload-api";
import { AppError } from "@/lib/errors";
import { requireActiveTenant } from "@/lib/tenant/context";
import {
  attestationFor,
  badgeFileProblem,
  BADGE_WORDING_KEY,
  parseFinalized,
  parseUploadTarget,
  parseWording,
  type BadgeAsset,
  type BadgeUploadTarget,
  type BadgeWording,
} from "@/lib/studio/badge-upload";
import { getStudioStatus } from "@/services/studio.service";

/**
 * Uploading a badge image. Needs the `design:attest` capability (checked here, again by the API) and the `badge_upload` feature
 * to be available for the store. The member must attest to the approved wording for every uploaded image.
 */
async function requireBadgeUpload() {
  const { tenant } = await requireActiveTenant("design:attest");
  const status = await getStudioStatus();
  if (status.features.badge_upload !== "available") throw new AppError("FORBIDDEN", "Uploading badge images is not available for your store yet.");
  return tenant;
}

/** The approved wording, exactly as the API returns it. */
export async function getBadgeWording(): Promise<BadgeWording> {
  const tenant = await requireBadgeUpload();
  const wording = parseWording(await getLegalWordingApi(tenant.id, BADGE_WORDING_KEY));
  if (!wording) throw new AppError("UNKNOWN", "The confirmation wording is not available right now. Please try again later.");
  return wording;
}

export async function requestBadgeUpload(input: { mimeType: string; sizeBytes: number; filename?: string }): Promise<BadgeUploadTarget> {
  const tenant = await requireBadgeUpload();
  const problem = badgeFileProblem({ type: input.mimeType, size: input.sizeBytes });
  if (problem) throw new AppError("VALIDATION", problem);
  const target = parseUploadTarget(await requestMediaUploadApi(tenant.id, input));
  if (!target) throw new AppError("UNKNOWN", "The upload could not be started. Please try again.");
  return target;
}

export async function finalizeBadgeUpload(asset: BadgeAsset): Promise<BadgeAsset> {
  const tenant = await requireBadgeUpload();
  const done = parseFinalized(await finalizeMediaAssetApi(tenant.id, asset.assetId), asset);
  if (!done) throw new AppError("UNKNOWN", "The upload could not be finished. Please try again.");
  return done;
}

/** Records the attestation for `assetId` against the wording version the member was shown. */
export async function attestBadgeUpload(input: { wordingVersion: string; assetId: string }): Promise<void> {
  const tenant = await requireBadgeUpload();
  await createAttestationApi(tenant.id, attestationFor({ version: input.wordingVersion }, input.assetId));
}
