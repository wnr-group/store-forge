import "server-only";
import { apiRequest, type PageMeta } from "@/lib/api/client";

/**
 * Platform Admin endpoints of the StoreForge API (`/platform/*`) plus public branding. None sends an organization id:
 * platform authority is separate from tenant roles and the API answers 403 to anyone who is not a Platform Admin.
 */

export type PlatformLevelApi = "super_admin" | "admin" | "billing_admin" | "support_admin";

/** `GET /platform/me`: 403 for everyone who is not platform staff. `permissions` is what the role may do (the API enforces it either way). */
export const getPlatformMeApi = async () =>
  (await apiRequest<{ level: PlatformLevelApi; permissions: import("@/lib/platform/roles").PlatformPermission[] }>("/platform/me")).data;

// Settings ---------------------------------------------------------------------------------------------------------------
export type PlatformSettingsApi = {
  platformName: string;
  supportEmail: string | null;
  defaultCurrency: string;
  defaultTimezone: string;
  defaultStoreStatus: "active" | "inactive";
  updatedAt: string;
  updatedByEmail: string | null;
};
export type PlatformSettingsApiInput = Omit<PlatformSettingsApi, "updatedAt" | "updatedByEmail">;

export const getPlatformSettingsApi = async () => (await apiRequest<PlatformSettingsApi>("/platform/settings")).data;
export const updatePlatformSettingsApi = async (input: PlatformSettingsApiInput) =>
  (await apiRequest<PlatformSettingsApi>("/platform/settings", { method: "PATCH", json: input })).data;

/** `GET /public/branding`: no session needed. */
export const getPublicBrandingApi = async () =>
  (await apiRequest<{ platformName: string; supportEmail: string | null }>("/public/branding", { anonymous: true })).data;

// Admins -----------------------------------------------------------------------------------------------------------------
export type PlatformAdminApi = {
  userId: string;
  email: string;
  fullName: string | null;
  role: PlatformLevelApi;
  createdAt: string;
  createdBy: string | null;
  createdByEmail: string | null;
};

export const listPlatformAdminsApi = async () => (await apiRequest<PlatformAdminApi[]>("/platform/admins")).data;
export const addPlatformAdminApi = async (input: { fullName: string; email: string; password: string; role: PlatformLevelApi }) =>
  (await apiRequest<{ email: string }>("/platform/admins", { method: "POST", json: input })).data;
export const setPlatformAdminRoleApi = async (userId: string, role: PlatformLevelApi) => {
  await apiRequest(`/platform/admins/${userId}`, { method: "PATCH", json: { role } });
};
export const removePlatformAdminApi = async (userId: string) => {
  await apiRequest(`/platform/admins/${userId}`, { method: "DELETE" });
};

// Audit ------------------------------------------------------------------------------------------------------------------
export type AuditLogApi = {
  id: string;
  adminUserId: string;
  adminEmail: string;
  action: string;
  entityType: string;
  entityId: string | null;
  organizationId: string | null;
  organizationName: string | null;
  description: string;
  previousData: unknown;
  newData: unknown;
  createdAt: string;
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
};
export type AuditApiQuery = { page: number; limit: number; action?: string; entity?: string; admin?: string; org?: string; search?: string; from?: string; to?: string };

export async function listAuditLogsApi(query: AuditApiQuery): Promise<{ items: AuditLogApi[]; meta: PageMeta }> {
  const { data, meta } = await apiRequest<AuditLogApi[]>("/platform/audit-logs", { query });
  return { items: data, meta: meta ?? { page: query.page, limit: query.limit, total: data.length, totalPages: 1 } };
}
export const listAuditAdminsApi = async () => (await apiRequest<{ id: string; email: string }[]>("/platform/audit-logs/admins")).data;

// Usage ------------------------------------------------------------------------------------------------------------------
export type OrgUsageApi = {
  products: number;
  customers: number;
  orders: number;
  storageBytes: number | null;
  lastActivity: string | null;
  createdAt: string;
  status: "active" | "suspended";
};
export type OrgUsageRowApi = OrgUsageApi & { id: string; name: string; slug: string };
export type UsageSummaryApi = { totalOrganizations: number; active: number; suspended: number; inactive: number; storageTotalBytes: number | null };
export type InactiveOrgApi = { id: string; name: string; slug: string; status: "active" | "suspended"; createdAt: string; lastActivity: string | null };
export type NewOrgsSeriesApi = { from: string; to: string; bucket: "day" | "week" | "month"; points: { start: string; created: number }[]; total: number };

export const getOrganizationUsageApi = async (id: string) => (await apiRequest<OrgUsageApi>(`/platform/organizations/${id}/usage`)).data;
export async function listOrganizationUsageApi(query: { page: number; limit: number; search?: string; status?: string; sortBy?: string; sortOrder?: string }) {
  const { data, meta } = await apiRequest<OrgUsageRowApi[]>("/platform/usage", { query });
  return { items: data, meta: meta ?? { page: query.page, limit: query.limit, total: data.length, totalPages: 1 } };
}
export const getUsageSummaryApi = async (inactiveDays: number) => (await apiRequest<UsageSummaryApi>("/platform/usage/summary", { query: { inactiveDays } })).data;
export const listInactiveOrganizationsApi = async (days: number, limit: number) =>
  (await apiRequest<{ rows: InactiveOrgApi[]; total: number }>("/platform/usage/inactive", { query: { days, limit } })).data;
export const getNewOrganizationsSeriesApi = async (from: string, to: string) =>
  (await apiRequest<NewOrgsSeriesApi>("/platform/usage/new-organizations", { query: { from, to } })).data;
