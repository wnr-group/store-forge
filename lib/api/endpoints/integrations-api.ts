import "server-only";
import { apiRequest } from "@/lib/api/client";
import { storefrontCache } from "@/lib/storefront/cache";

/** `/integrations` of the StoreForge API: a store's own analytics and marketing connections. Private credentials are never part of these. */
export type IntegrationFieldApi = { key: string; label: string; placeholder: string; help: string };

export type IntegrationApi = {
  provider: string;
  name: string;
  description: string;
  fields: IntegrationFieldApi[];
  configured: boolean;
  enabled: boolean;
  status: "not_configured" | "disabled" | "enabled";
  validationStatus: "unverified" | "valid" | "invalid" | null;
  validationError: string | null;
  validatedAt: string | null;
  config: Record<string, string>;
  updatedAt: string | null;
  updatedByYou: boolean;
};

export type IntegrationEventApi = { action: string; note: string | null; byYou: boolean; createdAt: string };
export type IntegrationDetailApi = IntegrationApi & { history: IntegrationEventApi[] };
export type IntegrationTestApi = { ok: boolean; checks: { name: string; ok: boolean; message: string }[]; note: string };

const path = (provider: string) => `/integrations/${encodeURIComponent(provider)}`;

export const listIntegrationsApi = async (org: string) => (await apiRequest<IntegrationApi[]>("/integrations", { organizationId: org })).data;
export const getIntegrationApi = async (org: string, provider: string) => (await apiRequest<IntegrationDetailApi>(path(provider), { organizationId: org })).data;
export const saveIntegrationApi = async (org: string, provider: string, config: Record<string, string>) =>
  (await apiRequest<IntegrationDetailApi>(path(provider), { method: "PUT", json: { config }, organizationId: org })).data;
export const setIntegrationEnabledApi = async (org: string, provider: string, enabled: boolean) =>
  (await apiRequest<IntegrationDetailApi>(`${path(provider)}/${enabled ? "enable" : "disable"}`, { method: "POST", organizationId: org })).data;
export const testIntegrationApi = async (org: string, provider: string) =>
  (await apiRequest<IntegrationTestApi>(`${path(provider)}/test`, { method: "POST", organizationId: org, timeoutMs: 30_000 })).data;
export const removeIntegrationApi = async (org: string, provider: string) => {
  await apiRequest(path(provider), { method: "DELETE", organizationId: org });
};

/** `GET /public/stores/:slug/tracking`: the integrations a store switched on, public identifiers only. Cached under the store's tag. */
export type TrackingConfigApi = { providers: { provider: string; config: Record<string, string> }[]; consentRequired: boolean };

export const getTrackingConfigApi = async (slug: string) =>
  (await apiRequest<TrackingConfigApi>(`/public/stores/${encodeURIComponent(slug)}/tracking`, { anonymous: true, cache: storefrontCache(slug) })).data;
