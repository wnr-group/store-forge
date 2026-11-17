import "server-only";
import { requirePlatformAdmin } from "@/lib/auth/platform";
import {
  getNewOrganizationsSeriesApi,
  getOrganizationUsageApi,
  getUsageSummaryApi,
  listInactiveOrganizationsApi,
  listOrganizationUsageApi,
  type OrgUsageApi,
} from "@/lib/api/endpoints/platform-api";
import type { SeriesBucket } from "@/lib/admin/series";
import type { UsageQuery } from "@/lib/validations/admin-list";

/**
 * Usage & Analytics for Platform Admins, served by the StoreForge API (`/platform/usage*`). Every number is an aggregate
 * computed by the API: counts, bytes and timestamps only. No product, customer or order record, name or amount is ever
 * returned, so merchant business data stays private.
 *
 * "Not available" and "zero" stay different: storage is `null` when Supabase Storage cannot be measured, and a
 * last-activity of `null` means the organization has had none.
 */
const date = (v: string | null) => (v === null ? null : new Date(v));

export type OrgUsage = {
  products: number;
  customers: number;
  orders: number;
  /** Bytes in the products bucket, or null when it cannot be measured (not the same as 0). */
  storageBytes: number | null;
  /** Latest change to products, customers, orders, stock, categories or collections; null when there has been none. */
  lastActivity: Date | null;
  createdAt: Date;
  status: "active" | "suspended";
};

const usageFromApi = (u: OrgUsageApi): OrgUsage => ({ ...u, lastActivity: date(u.lastActivity), createdAt: new Date(u.createdAt) });

export async function getOrganizationUsage(tenantId: string): Promise<OrgUsage> {
  await requirePlatformAdmin();
  return usageFromApi(await getOrganizationUsageApi(tenantId));
}

export type UsageOrgRow = OrgUsage & { id: string; name: string; slug: string };
export type UsagePage = { rows: UsageOrgRow[]; total: number; page: number; pageSize: number };

/** One page of organizations with their usage; search, filter, sort and paging all happen in the API. */
export async function listOrganizationUsage(q: UsageQuery): Promise<UsagePage> {
  await requirePlatformAdmin();
  const { items, meta } = await listOrganizationUsageApi({ page: q.page, limit: q.pageSize, search: q.q, status: q.status, sortBy: q.sort, sortOrder: q.dir });
  return { page: meta.page, pageSize: q.pageSize, total: meta.total, rows: items.map((r) => ({ ...usageFromApi(r), id: r.id, name: r.name, slug: r.slug })) };
}

export type UsageSummary = {
  totalOrganizations: number;
  active: number;
  suspended: number;
  /** Created before the window and with no merchant activity inside it. */
  inactive: number;
  /** Null when Storage cannot be measured. */
  storageTotalBytes: number | null;
};

export async function getUsageSummary(inactiveDays: number): Promise<UsageSummary> {
  await requirePlatformAdmin();
  return getUsageSummaryApi(inactiveDays);
}

export type InactiveOrg = { id: string; name: string; slug: string; status: "active" | "suspended"; createdAt: Date; lastActivity: Date | null };

/** The least active organizations first (never-active ones lead). Shows `limit` of them and the total. */
export async function listInactiveOrganizations(days: number, limit = 10): Promise<{ rows: InactiveOrg[]; total: number }> {
  await requirePlatformAdmin();
  const r = await listInactiveOrganizationsApi(days, limit);
  return { total: r.total, rows: r.rows.map((o) => ({ ...o, createdAt: new Date(o.createdAt), lastActivity: date(o.lastActivity) })) };
}

export type NewOrgsSeries = { from: string; to: string; bucket: SeriesBucket; points: { start: string; created: number }[]; total: number };

export async function getNewOrganizationsSeries(from: string, to: string): Promise<NewOrgsSeries> {
  await requirePlatformAdmin();
  return getNewOrganizationsSeriesApi(from, to);
}
