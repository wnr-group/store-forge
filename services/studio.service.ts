import "server-only";
import {
  createReusableSectionApi,
  deleteReusableSectionApi,
  discardDraftApi,
  getChangeLedgerApi,
  getCurrentReviewApi,
  getDraftChangesApi,
  getReadinessReportApi,
  getSpeedStatsApi,
  getStudioSettingsApi,
  getStudioStatusApi,
  listReusableSectionsApi,
  requestReviewApi,
  updateReusableSectionApi,
  updateStudioSettingsApi,
  type ReadinessReportApi,
} from "@/lib/api/endpoints/studio-api";
import { requireActiveTenant } from "@/lib/tenant/context";
import { NO_FEATURES, parseStudioFeatures, type StudioFeatures } from "@/lib/templates/studio-features";

export type StudioStatus = { enabled: boolean; features: StudioFeatures };

/**
 * Whether Studio (display rules and the other Studio editor features) is on for the active store, and which gated features are
 * available. Defensive by design: any failure, a missing route or an answer that is not exactly `enabled: true` reads as "off", and
 * a feature that is absent or not exactly "available" reads as unavailable, so the editor falls back to what it always did.
 */
export async function getStudioStatus(): Promise<StudioStatus> {
  try {
    const { tenant } = await requireActiveTenant("design:view");
    const status = await getStudioStatusApi(tenant.id);
    const enabled = status?.enabled === true;
    // Features only count while Studio itself is on for the store.
    return { enabled, features: enabled ? parseStudioFeatures(status?.features) : NO_FEATURES };
  } catch {
    return { enabled: false, features: NO_FEATURES };
  }
}

export async function getReadinessReport(templateId?: string): Promise<ReadinessReportApi | null> {
  try {
    const { tenant } = await requireActiveTenant("design:view");
    return (await getReadinessReportApi(tenant.id, templateId)) ?? null;
  } catch {
    return null;
  }
}

export async function getStudioSettings() {
  const { tenant } = await requireActiveTenant("design:view");
  return getStudioSettingsApi(tenant.id);
}

export async function updateStudioSettings(data: { reviewDisclosureText?: string; reviewDisclosureLanguage?: string }) {
  const { tenant } = await requireActiveTenant("design:edit");
  return updateStudioSettingsApi(tenant.id, data);
}

export async function getSpeedStats() {
  const { tenant } = await requireActiveTenant("design:view");
  return getSpeedStatsApi(tenant.id);
}

export async function requestReview() {
  const { tenant } = await requireActiveTenant("design:edit");
  return requestReviewApi(tenant.id);
}

export async function getCurrentReview() {
  const { tenant } = await requireActiveTenant("design:view");
  return getCurrentReviewApi(tenant.id);
}

export async function getDraftChanges() {
  const { tenant } = await requireActiveTenant("design:view");
  return getDraftChangesApi(tenant.id);
}

export async function getChangeLedger(templateId?: string) {
  const { tenant } = await requireActiveTenant("design:view");
  return getChangeLedgerApi(tenant.id, templateId);
}

export async function discardDraft(templateId: string, reason: string) {
  const { tenant } = await requireActiveTenant("design:discard");
  return discardDraftApi(tenant.id, { templateId, reason });
}

export async function listReusableSections() {
  const { tenant } = await requireActiveTenant("design:view");
  return listReusableSectionsApi(tenant.id);
}

export async function createReusableSection(data: {
  componentId: string;
  name: string;
  description?: string;
  content: Record<string, unknown>;
}) {
  const { tenant } = await requireActiveTenant("design:edit");
  return createReusableSectionApi(tenant.id, data);
}

export async function updateReusableSection(
  id: string,
  data: { name?: string; description?: string; content?: Record<string, unknown> },
) {
  const { tenant } = await requireActiveTenant("design:edit");
  return updateReusableSectionApi(tenant.id, id, data);
}

export async function deleteReusableSection(id: string) {
  const { tenant } = await requireActiveTenant("design:edit");
  return deleteReusableSectionApi(tenant.id, id);
}
