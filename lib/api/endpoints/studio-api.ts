import "server-only";
import { apiRequest } from "@/lib/api/client";

/**
 * Studio API Endpoints.
 */
export type StudioStatusApi = {
  enabled: boolean;
  features?: Record<string, unknown>;
  schemaV2Capable?: boolean;
  schemaVersion?: number;
  pointOfNoReturnAt?: string | null;
};

export type ReadinessIssueApi = {
  key: string;
  ruleId: string;
  severity: "BLOCKER" | "WARNING" | "INFORMATION";
  message: string;
  messageKey: string;
  target: { documentId: string; nodeId: string | null };
  fixAction: string;
  controlPath: string;
};

export type ReadinessReportApi = {
  issues: ReadinessIssueApi[];
  counts: { blockers: number; warnings: number; information: number };
  canPublish: boolean;
  evaluatedAt: string;
};

export const getStudioStatusApi = async (organizationId: string) =>
  (await apiRequest<StudioStatusApi>("/store/studio/status", { organizationId })).data;

export const getReadinessReportApi = async (organizationId: string, templateId?: string) =>
  (await apiRequest<ReadinessReportApi>("/store/studio/readiness", {
    method: "POST",
    organizationId,
    json: { templateId },
  })).data;

export const getStudioSettingsApi = async (organizationId: string) =>
  (await apiRequest<{ reviewDisclosureText: string; reviewDisclosureLanguage: string }>(
    "/store/studio/settings",
    { organizationId },
  )).data;

export const updateStudioSettingsApi = async (
  organizationId: string,
  json: { reviewDisclosureText?: string; reviewDisclosureLanguage?: string },
) =>
  (await apiRequest<{ reviewDisclosureText: string; reviewDisclosureLanguage: string }>(
    "/store/studio/settings",
    { method: "PATCH", organizationId, json },
  )).data;

export const getSpeedStatsApi = async (organizationId: string) =>
  (await apiRequest<{ storeId: string; metrics: unknown[] }>("/store/studio/speed", {
    organizationId,
  })).data;

export const requestReviewApi = async (organizationId: string) =>
  (await apiRequest<{ id: string; fingerprint: string; items: unknown[]; submittedAt: string }>(
    "/store/studio/review-requests",
    { method: "POST", organizationId },
  )).data;

export const getCurrentReviewApi = async (organizationId: string) =>
  (await apiRequest<{ id: string; fingerprint: string; items: unknown[]; submittedAt: string } | null>(
    "/store/studio/review-requests/current",
    { organizationId },
  )).data;

export const getDraftChangesApi = async (organizationId: string) =>
  (await apiRequest<Array<{
    templateId: string;
    name: string;
    kind: string;
    publishedVersionId: string | null;
    hasChanges: boolean;
    draftSectionCount: number;
    publishedSectionCount: number;
  }>>("/store/studio/changes", { organizationId })).data;

export const getChangeLedgerApi = async (organizationId: string, templateId?: string) =>
  (await apiRequest<unknown[]>("/store/studio/ledger", {
    organizationId,
    query: templateId ? { templateId } : undefined,
  })).data;

export const discardDraftApi = async (
  organizationId: string,
  json: { templateId: string; reason: string },
) =>
  (await apiRequest<{ success: boolean; templateId: string; discardedRevision: number }>(
    "/store/studio/discard",
    { method: "POST", organizationId, json },
  )).data;

export const listReusableSectionsApi = async (organizationId: string) =>
  (await apiRequest<Array<{
    id: string;
    componentId: string;
    name: string;
    description: string | null;
    currentVersionNumber: number;
    content: Record<string, unknown>;
    usageCount: number;
    createdAt: string;
    updatedAt: string;
  }>>("/store/studio/reusable-sections", { organizationId })).data;

/** What create and update return: the record's id is guaranteed, the rest is not asserted here (the list call has the full shape). */
export type ReusableSectionWriteResult = { id: string } & Record<string, unknown>;

export const createReusableSectionApi = async (
  organizationId: string,
  json: { componentId: string; name: string; description?: string; content: Record<string, unknown> },
) =>
  (await apiRequest<ReusableSectionWriteResult>("/store/studio/reusable-sections", {
    method: "POST",
    organizationId,
    json,
  })).data;

export const updateReusableSectionApi = async (
  organizationId: string,
  id: string,
  json: { name?: string; description?: string; content?: Record<string, unknown> },
) =>
  (await apiRequest<ReusableSectionWriteResult>(`/store/studio/reusable-sections/${id}`, {
    method: "PUT",
    organizationId,
    json,
  })).data;

export const deleteReusableSectionApi = async (organizationId: string, id: string) =>
  (await apiRequest<{ success: boolean }>(`/store/studio/reusable-sections/${id}`, {
    method: "DELETE",
    organizationId,
  })).data;
