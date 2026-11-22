"use server";

import { z } from "zod";
import { run } from "@/lib/actions/run";
import { BADGE_UPLOAD_TYPES, BADGE_UPLOAD_MAX_BYTES } from "@/lib/studio/badge-upload";
import { attestBadgeUpload, finalizeBadgeUpload, getBadgeWording, requestBadgeUpload } from "@/services/badge-upload.service";
import { parseInput } from "@/lib/validations/parse";

/** Server actions behind the uploaded trust badge dialog. Each one re-checks the attest capability and the feature on the server. */

const uploadSchema = z.object({
  mimeType: z.enum(BADGE_UPLOAD_TYPES),
  sizeBytes: z.number().int().positive().max(BADGE_UPLOAD_MAX_BYTES),
  filename: z.string().trim().max(120).optional(),
});
const assetSchema = z.object({ assetId: z.string().trim().min(1).max(64), path: z.string().trim().min(1).max(300) });
const attestSchema = z.object({ wordingVersion: z.string().trim().min(1).max(40), assetId: z.string().trim().min(1).max(64) });

export const getBadgeWordingAction = async () => run(() => getBadgeWording());
export const requestBadgeUploadAction = async (input: unknown) => run(() => requestBadgeUpload(parseInput(uploadSchema, input)));
export const finalizeBadgeUploadAction = async (input: unknown) => run(() => finalizeBadgeUpload(parseInput(assetSchema, input)));
export const attestBadgeUploadAction = async (input: unknown) => run(() => attestBadgeUpload(parseInput(attestSchema, input)));
