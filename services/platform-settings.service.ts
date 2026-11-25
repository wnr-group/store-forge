import { unstable_cache } from "next/cache";
import "server-only";
import { cache } from "react";
import type { z } from "zod";
import { requirePlatformAdmin, requireSuperAdmin } from "@/lib/auth/platform";
import {
  getPlatformSettingsApi,
  getPublicBrandingApi,
  removePlatformLogoApi,
  requestPlatformLogoUploadApi,
  setPlatformLogoApi,
  updatePlatformSettingsApi,
  type LogoUploadTargetApi,
} from "@/lib/api/endpoints/platform-api";
import type { platformSettingsSchema } from "@/lib/validations/admin-platform";

/**
 * Platform settings, served by the StoreForge API: admins read them with `GET /platform/settings`, super admins change
 * them with `PATCH /platform/settings` (validated again by the API and the database), and signed-out pages read only the
 * platform name and a support e-mail from `GET /public/branding`. Nothing secret is stored here.
 */
export type PlatformSettingsView = {
  platformName: string;
  supportEmail: string | null;
  defaultCurrency: string;
  defaultTimezone: string;
  defaultStoreStatus: "active" | "inactive";
  logoUrl: string | null;
  updatedAt: Date;
  updatedByEmail: string | null;
};

export async function getPlatformSettings(): Promise<PlatformSettingsView> {
  await requirePlatformAdmin();
  const s = await getPlatformSettingsApi();
  return { ...s, updatedAt: new Date(s.updatedAt) };
}

export type PublicBranding = { platformName: string; supportEmail: string | null; logoUrl: string | null };
const DEFAULT_BRANDING: PublicBranding = { platformName: "Kanova Store", supportEmail: null, logoUrl: null };

/** The props the app shell takes for branding: the platform name and the uploaded logo (if any). */
export const brandProps = (b: PublicBranding) => ({ brandName: b.platformName, logoUrl: b.logoUrl });

export const BRANDING_TAG = "platform-branding";

/** Cached across requests so the name in every page header and title costs no call; updatePlatformSettingsAction expires the tag. Throws on failure so a fallback is never cached. */
const fetchPublicBranding = unstable_cache(async (): Promise<PublicBranding> => getPublicBrandingApi(), ["public-platform-branding"], {
  tags: [BRANDING_TAG],
  revalidate: 300,
});

/**
 * The platform name and support contact, for pages anyone can open (sign-in, "no workspace"). Needs no session. If the API
 * cannot be reached the defaults are used, so a settings problem can never stop someone from signing in.
 */
export const getPublicBranding = cache(async (): Promise<PublicBranding> => {
  try {
    return await fetchPublicBranding();
  } catch (error) {
    console.error("[platform-settings] public branding unavailable, using defaults", error instanceof Error ? error.message : error);
    return DEFAULT_BRANDING;
  }
});

/** Super admins only. The API writes (and logs) nothing when nothing changed; its audit entry lists what did. */
export async function updatePlatformSettings(v: z.output<typeof platformSettingsSchema>): Promise<void> {
  await requireSuperAdmin();
  await updatePlatformSettingsApi(v);
}

/** Super admins only. A one-time link to upload a logo (JPEG, PNG or WebP, up to 2 MB) straight to Storage. */
export async function requestPlatformLogoUpload(file: { type: string; size: number }): Promise<LogoUploadTargetApi> {
  await requireSuperAdmin();
  return requestPlatformLogoUploadApi(file);
}

/** Super admins only. Use an uploaded file as the logo; the API checks the file, logs the change and deletes the old logo file. */
export async function setPlatformLogo(path: string): Promise<void> {
  await requireSuperAdmin();
  await setPlatformLogoApi(path);
}

/** Super admins only. Go back to the built-in logo. */
export async function removePlatformLogo(): Promise<void> {
  await requireSuperAdmin();
  await removePlatformLogoApi();
}
