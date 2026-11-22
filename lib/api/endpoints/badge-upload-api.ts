import "server-only";
import { apiRequest } from "@/lib/api/client";
import type { AttestationInput } from "@/lib/studio/badge-upload";

/**
 * Endpoints behind the uploaded trust badge flow. Answers are returned as `unknown` and read by the defensive parsers in
 * `lib/studio/badge-upload.ts`, because the API owns these shapes.
 */

/** `GET /store/legal/wordings/:key`: the approved wording a merchant attests to. */
export const getLegalWordingApi = async (organizationId: string, key: string): Promise<unknown> =>
  (await apiRequest<unknown>(`/store/legal/wordings/${encodeURIComponent(key)}`, { organizationId })).data;

/** `POST /store/media-assets/upload-requests`: reserves an asset and returns where to upload it. */
export const requestMediaUploadApi = async (organizationId: string, input: { mimeType: string; sizeBytes: number; filename?: string }): Promise<unknown> =>
  (await apiRequest<unknown>("/store/media-assets/upload-requests", { method: "POST", json: input, organizationId })).data;

/** `POST /store/media-assets/:id/finalize`: marks the uploaded file as ready. */
export const finalizeMediaAssetApi = async (organizationId: string, assetId: string): Promise<unknown> =>
  (await apiRequest<unknown>(`/store/media-assets/${encodeURIComponent(assetId)}/finalize`, { method: "POST", json: {}, organizationId })).data;

/** `POST /store/attestations`: records that the member confirmed the wording for this asset. */
export const createAttestationApi = async (organizationId: string, input: AttestationInput): Promise<unknown> =>
  (await apiRequest<unknown>("/store/attestations", { method: "POST", json: input, organizationId })).data;
