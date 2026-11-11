import { unstable_cache } from "next/cache";
import "server-only";
import { cache } from "react";
import type { z } from "zod";
import { requirePlatformAdmin, requireSuperAdmin } from "@/lib/auth/platform";
import { getPlatformSettingsApi, getPublicBrandingApi, updatePlatformSettingsApi } from "@/lib/api/endpoints/platform-api";
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
  updatedAt: Date;
  updatedByEmail: string | null;
};

export async function getPlatformSettings(): Promise<PlatformSettingsView> {
  await requirePlatformAdmin();
  const s = await getPlatformSettingsApi();
  return { ...s, updatedAt: new Date(s.updatedAt) };
}

export type PublicBranding = { platformName: string; supportEmail: string | null };
const DEFAULT_BRANDING: PublicBranding = { platformName: "StoreForge", supportEmail: null };

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
