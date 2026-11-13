import "server-only";
import { apiRequest, type ApiQuery } from "@/lib/api/client";
import type {
  ApplyThemeResult,
  CurrentTheme,
  PreviewBundle,
  PublishResult,
  TemplateDetail,
  TemplateSummary,
  TemplateVersion,
  ThemeDetail,
  ThemePage,
} from "@/lib/themes/types";

/** The Theme Store endpoints of the StoreForge API: `/themes`, `/store/theme`, `/store/templates`. */

export async function listThemesApi(organizationId: string, query: ApiQuery): Promise<ThemePage> {
  const { data, meta } = await apiRequest<ThemePage["items"]>("/themes", { organizationId, query });
  return { items: data, page: meta?.page ?? 1, limit: meta?.limit ?? data.length, total: meta?.total ?? data.length, totalPages: meta?.totalPages ?? 1 };
}

export const getThemeApi = async (organizationId: string, slug: string) =>
  (await apiRequest<ThemeDetail>(`/themes/${encodeURIComponent(slug)}`, { organizationId })).data;

export const getCurrentThemeApi = async (organizationId: string) => (await apiRequest<CurrentTheme>("/store/theme", { organizationId })).data;

export const applyThemeApi = async (organizationId: string, themeSlug: string) =>
  (await apiRequest<ApplyThemeResult>("/store/theme", { method: "POST", json: { themeSlug }, organizationId })).data;

export const publishThemeApi = async (organizationId: string, label?: string) =>
  (await apiRequest<PublishResult>("/store/theme/publish", { method: "POST", json: label ? { label } : {}, organizationId })).data;

export const listTemplatesApi = async (organizationId: string) =>
  (await apiRequest<TemplateSummary[]>("/store/templates", { organizationId })).data;

export const getTemplateApi = async (organizationId: string, id: string) =>
  (await apiRequest<TemplateDetail>(`/store/templates/${id}`, { organizationId })).data;

export const getPreviewApi = async (organizationId: string, id: string) =>
  (await apiRequest<PreviewBundle>(`/store/templates/${id}/preview`, { organizationId })).data;

export const saveDraftApi = async (organizationId: string, id: string, document: unknown, expectedRevision: number) =>
  (await apiRequest<TemplateDetail>(`/store/templates/${id}/draft`, { method: "PUT", json: { document, expectedRevision }, organizationId })).data;

export const publishTemplateApi = async (organizationId: string, id: string, expectedRevision?: number, label?: string) =>
  (await apiRequest<PublishResult>(`/store/templates/${id}/publish`, { method: "POST", json: { expectedRevision, label }, organizationId })).data;

export const listVersionsApi = async (organizationId: string, id: string) =>
  (await apiRequest<TemplateVersion[]>(`/store/templates/${id}/versions`, { organizationId })).data;

export const rollbackApi = async (organizationId: string, id: string, versionId: string) =>
  (await apiRequest<PublishResult>(`/store/templates/${id}/rollback`, { method: "POST", json: { versionId }, organizationId })).data;
