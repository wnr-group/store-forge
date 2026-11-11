import "server-only";
import { apiRequest, type PageMeta } from "@/lib/api/client";
import type { TeamMemberApi } from "@/lib/api/endpoints/team-api";

/** `/platform/organizations*` of the StoreForge API (Platform Admin only; no organization header). Dates are ISO strings. */
export type CompanyApi = {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended";
  contactPhone: string | null;
  address: string | null;
  createdAt: string;
  storeId: string | null;
  storeName: string | null;
  storeSlug: string | null;
  ownerId: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  memberCount: number;
};

export type PlatformStoreApi = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  currency: string;
  timezone: string;
  status: "active" | "inactive" | "suspended";
  contactEmail: string | null;
  contactPhone: string | null;
  hasMoneyData: boolean;
};

export type PlatformOverviewApi = { totalOrganizations: number; active: number; suspended: number; totalUsers: number; recent: CompanyApi[] };
export type CompanyDetailApi = { company: CompanyApi; store: PlatformStoreApi | null; team: TeamMemberApi[] };

export type CreateOrganizationApiInput = {
  companyName: string;
  storeName: string;
  storeSlug: string;
  storeDescription?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
};

export const getPlatformOverviewApi = async () => (await apiRequest<PlatformOverviewApi>("/platform/overview")).data;

export async function listOrganizationsApi(query: { page: number; limit: number; search?: string; status?: string; sortBy?: string; sortOrder?: string }) {
  const { data, meta } = await apiRequest<CompanyApi[]>("/platform/organizations", { query });
  return { items: data, meta: meta ?? ({ page: query.page, limit: query.limit, total: data.length, totalPages: 1 } satisfies PageMeta) };
}

export const getOrganizationApi = async (id: string) => (await apiRequest<CompanyDetailApi>(`/platform/organizations/${id}`)).data;

export const createOrganizationApi = async (input: CreateOrganizationApiInput) =>
  (await apiRequest<{ tenantId: string; storeId: string; ownerId: string; ownerEmail: string }>("/platform/organizations", { method: "POST", json: input })).data;

export const updateOrganizationApi = async (id: string, input: { companyName: string; contactPhone: string | null; address: string | null }) => {
  await apiRequest(`/platform/organizations/${id}`, { method: "PATCH", json: input });
};

export const deleteOrganizationApi = async (id: string) => {
  await apiRequest(`/platform/organizations/${id}`, { method: "DELETE" });
};

export const setOrganizationStatusApi = async (id: string, status: "active" | "suspended") => {
  await apiRequest(`/platform/organizations/${id}/status`, { method: "PATCH", json: { status } });
};

export const updateOrganizationStoreApi = async (
  id: string,
  input: { name: string; description: string | null; contactEmail: string | null; contactPhone: string | null; currency: string; timezone: string },
) => {
  await apiRequest(`/platform/organizations/${id}/store`, { method: "PATCH", json: input });
};

export const addOrganizationMemberApi = async (
  id: string,
  input: { fullName: string; email: string; password: string; permissions: Record<string, string> },
) => (await apiRequest<{ userId: string; email: string }>(`/platform/organizations/${id}/members`, { method: "POST", json: input })).data;

export const setOrganizationMemberStatusApi = async (id: string, userId: string, status: "active" | "disabled") => {
  await apiRequest(`/platform/organizations/${id}/members/${userId}/status`, { method: "PATCH", json: { status } });
};

export const removeOrganizationMemberApi = async (id: string, userId: string) => {
  await apiRequest(`/platform/organizations/${id}/members/${userId}`, { method: "DELETE" });
};

export const transferOwnershipApi = async (id: string, input: { userId: string; previousOwner: "keep" | "disable" }) => {
  await apiRequest(`/platform/organizations/${id}/ownership/transfer`, { method: "POST", json: input });
};

export const recoverOwnerApi = async (id: string, input: { ownerName: string; ownerEmail: string; ownerPassword: string; previousOwner: "keep" | "disable" }) =>
  (await apiRequest<{ email: string }>(`/platform/organizations/${id}/ownership/recover`, { method: "POST", json: input })).data;
