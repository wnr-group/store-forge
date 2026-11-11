import "server-only";
import type { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/platform";
import {
  addOrganizationMemberApi,
  createOrganizationApi,
  deleteOrganizationApi,
  getOrganizationApi,
  getPlatformOverviewApi,
  listOrganizationsApi,
  recoverOwnerApi,
  removeOrganizationMemberApi,
  setOrganizationMemberStatusApi,
  setOrganizationStatusApi,
  transferOwnershipApi,
  updateOrganizationApi,
  updateOrganizationStoreApi,
  type CompanyApi,
} from "@/lib/api/endpoints/platform-org-api";
import { AppError } from "@/lib/errors";
import type { OrgListQuery } from "@/lib/validations/admin-list";
import type { CreateCompanyValues } from "@/lib/validations/company";
import type { CreateMemberInput } from "@/lib/validations/team";
import type { recoverOwnerSchema, transferOwnershipSchema, updateCompanySchema, updateStoreSchema } from "@/lib/validations/admin-org";
import { toTeamRow, type TeamMemberRow } from "@/services/team.service";

/**
 * Platform Admin operations, served by the StoreForge API (`/platform/organizations*`). Every exported function first
 * checks the Platform Admin (the API decides: `GET /platform/me`); the API checks again on every call, applies the per-admin
 * rate limits, runs each change in one transaction together with its audit entry, and creates/deletes sign-in accounts
 * with compensation. Platform endpoints expose company metadata only (no catalog, customer or order data).
 */

export type CompanySummary = {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended";
  contactPhone: string | null;
  address: string | null;
  createdAt: Date;
  storeId: string | null;
  storeName: string | null;
  storeSlug: string | null;
  ownerId: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  memberCount: number;
};

const companyFromApi = (c: CompanyApi): CompanySummary => ({ ...c, createdAt: new Date(c.createdAt) });

/** Creates the organization, its store and its Owner (the API creates the Owner's account and deletes it again if provisioning fails). */
export async function createCompany(v: CreateCompanyValues) {
  await requirePlatformAdmin();
  return createOrganizationApi(v);
}

export type CompanyPage = { items: CompanySummary[]; total: number; page: number; pageSize: number };

/** One page of organizations. Search, status filter, sorting and paging run in the API; a page past the end answers with the last real page. */
export async function listCompaniesPage(q: OrgListQuery): Promise<CompanyPage> {
  await requirePlatformAdmin();
  const { items, meta } = await listOrganizationsApi({ page: q.page, limit: q.pageSize, search: q.q, status: q.status, sortBy: q.sort, sortOrder: q.dir });
  return { items: items.map(companyFromApi), total: meta.total, page: meta.page, pageSize: q.pageSize };
}

export type PlatformOverview = { totalOrganizations: number; active: number; suspended: number; totalUsers: number; recent: CompanySummary[] };

export async function getPlatformOverview(): Promise<PlatformOverview> {
  await requirePlatformAdmin();
  const o = await getPlatformOverviewApi();
  return { ...o, recent: o.recent.map(companyFromApi) };
}

export type StoreDetails = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  currency: string;
  timezone: string;
  status: "active" | "inactive" | "suspended";
  contactEmail: string | null;
  contactPhone: string | null;
  /** True once products or orders exist: the currency can no longer change. */
  hasMoneyData: boolean;
};

export async function getCompany(tenantId: string): Promise<{ company: CompanySummary; store: StoreDetails | null; team: TeamMemberRow[] } | null> {
  await requirePlatformAdmin();
  try {
    const r = await getOrganizationApi(tenantId);
    return { company: companyFromApi(r.company), store: r.store, team: r.team.map(toTeamRow) };
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") return null;
    throw error;
  }
}

export async function setCompanyStatus(tenantId: string, status: "active" | "suspended"): Promise<void> {
  await requirePlatformAdmin();
  await setOrganizationStatusApi(tenantId, status);
}

/** Deletes the organization; the API then removes its orphaned sign-ins and stored files (best effort). */
export async function deleteCompany(tenantId: string): Promise<void> {
  await requirePlatformAdmin();
  await deleteOrganizationApi(tenantId);
}

/** Adds a team member (never an Owner). The API creates the account and deletes it again if the membership cannot be written. */
export async function addCompanyMember(tenantId: string, v: CreateMemberInput) {
  await requirePlatformAdmin();
  return addOrganizationMemberApi(tenantId, v);
}

type CompanyEdit = z.output<typeof updateCompanySchema>;
type StoreEdit = z.output<typeof updateStoreSchema>;
type TransferInput = z.output<typeof transferOwnershipSchema>;
type RecoverInput = z.output<typeof recoverOwnerSchema>;

/** Edits the organization's name, contact phone and address. The API writes (and logs) nothing when nothing changed. */
export async function updateCompany(tenantId: string, v: CompanyEdit): Promise<void> {
  await requirePlatformAdmin();
  await updateOrganizationApi(tenantId, v);
}

/** Edits the primary store: name, description, contact details, currency and timezone (never the address or logo). */
export async function updateCompanyStore(tenantId: string, v: StoreEdit): Promise<void> {
  await requirePlatformAdmin();
  await updateOrganizationStoreApi(tenantId, v);
}

export async function setCompanyMemberStatus(tenantId: string, userId: string, status: "active" | "disabled"): Promise<void> {
  await requirePlatformAdmin();
  await setOrganizationMemberStatusApi(tenantId, userId, status);
}

export async function removeCompanyMember(tenantId: string, userId: string): Promise<void> {
  await requirePlatformAdmin();
  await removeOrganizationMemberApi(tenantId, userId);
}

/** Hands ownership to an existing, active team member. Atomic in the API: never no owner, never two. */
export async function transferCompanyOwnership(tenantId: string, v: TransferInput): Promise<void> {
  await requirePlatformAdmin();
  await transferOwnershipApi(tenantId, v);
}

/** Owner recovery: a brand-new owner account becomes the owner of an organization whose owner is lost or missing. */
export async function recoverCompanyOwner(tenantId: string, v: RecoverInput): Promise<{ email: string }> {
  await requirePlatformAdmin();
  return recoverOwnerApi(tenantId, v);
}
