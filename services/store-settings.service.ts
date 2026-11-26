import "server-only";
import { getStoreApi, updateStoreApi } from "@/lib/api/endpoints/store-api";
import { requireActiveTenant } from "@/lib/tenant/context";

/**
 * Store settings, served by the StoreForge API (`GET/PATCH /store`). The API enforces the rules: logo under the
 * organization's store folder, slug availability, currency locked once products or orders exist, valid timezone, and it
 * removes the replaced logo file after the change commits.
 */
export type StoreSettingsValues = {
  name: string;
  slug: string;
  description: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  currency: string;
  timezone: string;
  logoPath: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
};

/** Owner/admin only (checked here AND by the API). */
export async function updateStoreSettings(v: StoreSettingsValues): Promise<void> {
  const { tenant } = await requireActiveTenant("store:manage");
  await updateStoreApi(tenant.id, v);
}

/** Amounts are stored in the currency's minor units, so the currency is fixed once any exist. */
export async function isCurrencyLocked(): Promise<boolean> {
  const { tenant } = await requireActiveTenant();
  return (await getStoreApi(tenant.id)).currencyLocked;
}
