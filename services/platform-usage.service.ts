import "server-only";
import { sql } from "drizzle-orm";
import { requirePlatformAdmin } from "@/lib/auth/platform";
import { withAuthenticatedDb, type DbTx } from "@/lib/db/tenant-db";
import { rowsOf } from "@/lib/db/user-context";
import { AppError } from "@/lib/errors";
import type { UsageQuery } from "@/lib/validations/admin-list";
import { resolveSeriesRange, type SeriesBucket } from "@/lib/admin/series";
import { mapProvisioningError } from "@/services/platform.service";

/**
 * Usage & Analytics for Platform Admins. Every number comes from an aggregate SQL function: counts, bytes and timestamps only.
 * No product, customer or order record, name or amount is ever read, so merchant business data stays private.
 *
 * "Not available" and "zero" are different things and stay different: storage is `null` when Supabase Storage cannot be
 * measured, and a last-activity of `null` means the organization has had none, not that the figure is missing.
 */

const n = (v: unknown) => Number(v ?? 0);
const nullableN = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const date = (v: unknown) => (v === null || v === undefined ? null : new Date(v as string | Date));

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

type UsageRaw = { products: unknown; customers: unknown; orders: unknown; storage_bytes: unknown; last_activity: unknown; created_at: string | Date; status: string };

const toUsage = (r: UsageRaw): OrgUsage => ({
  products: n(r.products),
  customers: n(r.customers),
  orders: n(r.orders),
  storageBytes: nullableN(r.storage_bytes),
  lastActivity: date(r.last_activity),
  createdAt: new Date(r.created_at),
  status: r.status === "suspended" ? "suspended" : "active",
});

export async function getOrganizationUsage(tenantId: string): Promise<OrgUsage> {
  await requirePlatformAdmin();
  try {
    return await withAuthenticatedDb(async (tx) => {
      const [row] = rowsOf<UsageRaw>(await tx.execute(sql`select * from public.platform_tenant_usage(${tenantId}::uuid)`));
      if (!row) throw new AppError("NOT_FOUND", "Organization not found.");
      return toUsage(row);
    });
  } catch (error) {
    return mapProvisioningError(error);
  }
}

export type UsageOrgRow = OrgUsage & { id: string; name: string; slug: string };
export type UsagePage = { rows: UsageOrgRow[]; total: number; page: number; pageSize: number };
type UsagePageRaw = UsageRaw & { id: string; name: string; slug: string; total_count: unknown };

async function fetchUsagePage(tx: DbTx, q: UsageQuery, page: number) {
  return rowsOf<UsagePageRaw>(
    await tx.execute(sql`select * from public.platform_usage_page(
      ${q.q || null}, ${q.status === "all" ? null : q.status}, ${`${q.sort}_${q.dir}`}, ${q.pageSize}, ${(page - 1) * q.pageSize})`),
  );
}

/** One page of organizations with their usage; search, filter, sort and paging all happen in SQL. */
export async function listOrganizationUsage(q: UsageQuery): Promise<UsagePage> {
  await requirePlatformAdmin();
  return withAuthenticatedDb(async (tx) => {
    let page = q.page;
    let raw = await fetchUsagePage(tx, q, page);
    if (raw.length === 0 && page > 1) {
      const first = await fetchUsagePage(tx, q, 1);
      page = Math.max(1, Math.ceil(n(first[0]?.total_count) / q.pageSize));
      raw = page === 1 ? first : await fetchUsagePage(tx, q, page);
    }
    return { page, pageSize: q.pageSize, total: n(raw[0]?.total_count), rows: raw.map((r) => ({ ...toUsage(r), id: r.id, name: r.name, slug: r.slug })) };
  });
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
  return withAuthenticatedDb(async (tx) => {
    const [r] = rowsOf<{ total_orgs: unknown; active_orgs: unknown; suspended_orgs: unknown; inactive_orgs: unknown; storage_total_bytes: unknown }>(
      await tx.execute(sql`select * from public.platform_usage_summary(${inactiveDays})`),
    );
    return { totalOrganizations: n(r?.total_orgs), active: n(r?.active_orgs), suspended: n(r?.suspended_orgs), inactive: n(r?.inactive_orgs), storageTotalBytes: nullableN(r?.storage_total_bytes) };
  });
}

export type InactiveOrg = { id: string; name: string; slug: string; status: "active" | "suspended"; createdAt: Date; lastActivity: Date | null };

/** The least active organizations first (never-active ones lead). Shows `limit` of them and the total. */
export async function listInactiveOrganizations(days: number, limit = 10): Promise<{ rows: InactiveOrg[]; total: number }> {
  await requirePlatformAdmin();
  return withAuthenticatedDb(async (tx) => {
    const raw = rowsOf<{ id: string; name: string; slug: string; status: string; created_at: string | Date; last_activity: unknown; total_count: unknown }>(
      await tx.execute(sql`select * from public.platform_inactive_organizations(${days}, ${limit}, 0)`),
    );
    return {
      total: n(raw[0]?.total_count),
      rows: raw.map((r) => ({ id: r.id, name: r.name, slug: r.slug, status: r.status === "suspended" ? "suspended" : "active", createdAt: new Date(r.created_at), lastActivity: date(r.last_activity) })),
    };
  });
}

export type NewOrgsSeries = { from: string; to: string; bucket: SeriesBucket; points: { start: string; created: number }[]; total: number };

export async function getNewOrganizationsSeries(from: string, to: string): Promise<NewOrgsSeries> {
  await requirePlatformAdmin();
  const range = resolveSeriesRange(from, to);
  return withAuthenticatedDb(async (tx) => {
    const raw = rowsOf<{ bucket_start: string; created: unknown }>(
      await tx.execute(sql`select to_char(bucket_start, 'YYYY-MM-DD') as bucket_start, created from public.platform_new_organizations_series(${range.from}::date, ${range.to}::date, ${range.bucket})`),
    );
    const points = raw.map((r) => ({ start: r.bucket_start, created: n(r.created) }));
    return { ...range, points, total: points.reduce((sum, p) => sum + p.created, 0) };
  });
}
