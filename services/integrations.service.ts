import "server-only";
import {
  getIntegrationApi,
  getTrackingConfigApi,
  listIntegrationsApi,
  removeIntegrationApi,
  saveIntegrationApi,
  setIntegrationEnabledApi,
  testIntegrationApi,
  type TrackingConfigApi,
} from "@/lib/api/endpoints/integrations-api";
import { invalidateStorefront } from "@/lib/storefront/cache";
import { withTenant } from "@/lib/tenant/with-tenant";

/**
 * Analytics and marketing connections of the ACTIVE tenant. Looking needs `integrations:view`, changing needs `integrations:manage`
 * (store settings access); the API checks both again. A change that the storefront shows (on, off, a new ID) drops the store's cached
 * public data, so shoppers see it on their next page.
 */
export const listIntegrations = () => withTenant("integrations:view", listIntegrationsApi);
export const getIntegration = (provider: string) => withTenant("integrations:view", (o) => getIntegrationApi(o, provider));

export async function saveIntegration(provider: string, config: Record<string, string>) {
  const result = await withTenant("integrations:manage", (o) => saveIntegrationApi(o, provider, config));
  await invalidateStorefront();
  return result;
}

export async function setIntegrationEnabled(provider: string, enabled: boolean) {
  const result = await withTenant("integrations:manage", (o) => setIntegrationEnabledApi(o, provider, enabled));
  await invalidateStorefront();
  return result;
}

export const testIntegration = (provider: string) => withTenant("integrations:manage", (o) => testIntegrationApi(o, provider));

export async function removeIntegration(provider: string) {
  await withTenant("integrations:manage", (o) => removeIntegrationApi(o, provider));
  await invalidateStorefront();
}

/** What a storefront may load. Never throws: a store whose tracking cannot be read simply has none, and its pages are unaffected. */
export async function getTrackingConfig(slug: string): Promise<TrackingConfigApi | null> {
  try {
    return await getTrackingConfigApi(slug);
  } catch {
    return null;
  }
}
