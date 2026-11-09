import "server-only";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { deleteUserQuietly, createConfirmedUser } from "@/lib/auth/provisioning";
import { requirePlatformAdmin } from "@/lib/auth/platform";
import { withAuthenticatedDb, type DbTx } from "@/lib/db/tenant-db";
import { rowsOf } from "@/lib/db/user-context";
import { errorChain } from "@/lib/db/errors";
import { AppError } from "@/lib/errors";
import { removeTenantObjects } from "@/lib/storage/server";
import { recordAudit } from "@/services/admin-audit.service";
import type { OrgListQuery } from "@/lib/validations/admin-list";
import { listTeamRows, type TeamMemberRow } from "@/services/team.service";
import type { CreateCompanyValues } from "@/lib/validations/company";
import type { CreateMemberInput } from "@/lib/validations/team";

/**
 * Platform Admin operations. Every exported function starts with requirePlatformAdmin(), which asks
 * the database who the validated session user is - the Admin Auth API (service-role key) is only
 * reached after that check passes. Database work runs as the admin's own request context through
 * `storeforge_app` -> `authenticated`; the service-role client is never used for queries, and the
 * admin functions expose company metadata only (no catalog, customer or order data).
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

type CompanyRaw = {
  id: string; name: string; slug: string; status: string; contact_phone: string | null; address: string | null;
  created_at: string | Date; store_id: string | null; store_name: string | null; store_slug: string | null;
  owner_id: string | null; owner_name: string | null; owner_email: string | null; member_count: string | number | bigint;
};

const toCompany = (r: CompanyRaw): CompanySummary => ({
  id: r.id,
  name: r.name,
  slug: r.slug,
  status: r.status === "suspended" ? "suspended" : "active",
  contactPhone: r.contact_phone,
  address: r.address,
  createdAt: new Date(r.created_at),
  storeId: r.store_id,
  storeName: r.store_name,
  storeSlug: r.store_slug,
  ownerId: r.owner_id,
  ownerName: r.owner_name,
  ownerEmail: r.owner_email,
  memberCount: Number(r.member_count),
});

/** Maps the SQL functions' RAISE codes to user-safe errors. Anything unrecognised is rethrown (logged, hidden). */
export function mapProvisioningError(error: unknown): never {
  if (error instanceof AppError) throw error;
  const msg = errorChain(error);
  if (msg.includes("slug_taken"))
    throw new AppError("CONFLICT", "That store address is already taken.", { storeSlug: "That address is already taken" });
  if (msg.includes("invalid_slug"))
    throw new AppError("VALIDATION", "That store address is not allowed.", { storeSlug: "Choose a different address" });
  if (msg.includes("invalid_input")) throw new AppError("VALIDATION", "Please check the details you entered.");
  if (msg.includes("not_found")) throw new AppError("NOT_FOUND", "Organization not found.");
  if (msg.includes("not_platform_admin")) throw new AppError("FORBIDDEN", "You do not have permission to do that.");
  throw error;
}

const provisionResult = z.object({ tenant_id: z.uuid(), store_id: z.uuid(), store_slug: z.string(), created: z.boolean() });

/**
 * Database half of company creation: tenant + owner membership + store in ONE transaction via
 * platform_provision_tenant(). The function itself re-checks that the caller is a Platform Admin.
 * Idempotent for the same owner and store slug, so it is safe to retry.
 */
export async function createTenantRecords(ownerId: string, v: CreateCompanyValues, ownerEmail?: string) {
  try {
    return await withAuthenticatedDb(async (tx) => {
      const rows = rowsOf<{ result: unknown }>(
        await tx.execute(sql`select public.platform_provision_tenant(
          ${ownerId}::uuid, ${v.companyName}, ${v.storeName}, ${v.storeSlug},
          ${v.storeDescription}, ${v.contactPhone}, ${v.address}) as result`),
      );
      const result = provisionResult.parse(rows[0]?.result);
      // Logged in the same transaction. A retry of an already created company (created = false) adds no second entry.
      if (result.created) {
        await recordAudit(tx, {
          action: "organization.created",
          entityType: "organization",
          entityId: result.tenant_id,
          organizationId: result.tenant_id,
          description: `Created organization "${v.companyName}" with store "${v.storeName}"`,
          next: { name: v.companyName, storeName: v.storeName, storeSlug: result.store_slug, ownerEmail: ownerEmail ?? null },
        });
      }
      return result;
    });
  } catch (error) {
    return mapProvisioningError(error);
  }
}

async function isStoreAddressFree(slug: string): Promise<boolean> {
  return withAuthenticatedDb(async (tx) => {
    const rows = rowsOf<{ ok: boolean }>(await tx.execute(sql`select public.is_store_slug_available(${slug}) as ok`));
    return rows[0]?.ok === true;
  });
}

/**
 * Creates a company and its Owner.
 *
 * Auth and PostgreSQL cannot share a transaction, so the order is chosen to make failures cheap:
 *   1. authorise the Platform Admin, validate (already done by the caller's schema),
 *   2. cheap pre-check of the store address (no Auth user is created for an obviously bad request),
 *   3. create the confirmed Auth user (profile row comes from the DB trigger),
 *   4. create tenant + store + owner membership atomically in the database,
 *   5. if step 4 fails, delete the Auth user again (compensation). An ambiguous failure (e.g. a
 *      dropped connection after commit) is retried once - the SQL function is idempotent - before
 *      the user is removed, so a committed tenant is never left without its Owner.
 */
export async function createCompany(v: CreateCompanyValues) {
  await requirePlatformAdmin();

  if (!(await isStoreAddressFree(v.storeSlug)))
    throw new AppError("CONFLICT", "That store address is not available.", { storeSlug: "That address is not available" });

  const owner = await createConfirmedUser({ email: v.ownerEmail, password: v.ownerPassword, fullName: v.ownerName });

  let records: Awaited<ReturnType<typeof createTenantRecords>>;
  try {
    records = await createTenantRecords(owner.id, v, owner.email);
  } catch (first) {
    if (first instanceof AppError) {
      await deleteUserQuietly(owner.id);
      throw first;
    }
    try {
      records = await createTenantRecords(owner.id, v, owner.email);
    } catch {
      const removed = await deleteUserQuietly(owner.id);
      console.error("[createCompany] provisioning failed", { ownerId: owner.id, authUserRemoved: removed, error: errorChain(first) });
      throw first;
    }
  }
  return { tenantId: records.tenant_id, storeId: records.store_id, ownerId: owner.id, ownerEmail: owner.email };
}

export type CompanyPage = { items: CompanySummary[]; total: number; page: number; pageSize: number };

type CompanyPageRaw = CompanyRaw & { total_count: string | number | bigint };

type PageArgs = Pick<OrgListQuery, "q" | "status" | "sort" | "dir"> & { pageSize: number };

const orgSort = (q: Pick<OrgListQuery, "sort" | "dir">) => `${q.sort}_${q.dir}`;

async function fetchCompanyPage(tx: DbTx, q: PageArgs, page: number) {
  return rowsOf<CompanyPageRaw>(
    await tx.execute(sql`select * from public.platform_list_tenants_page(
      ${q.q || null}, ${q.status === "all" ? null : q.status}, ${orgSort(q)}, ${q.pageSize}, ${(page - 1) * q.pageSize})`),
  );
}

/**
 * One page of organizations. Search, status filter, sorting and paging all run in PostgreSQL
 * (platform_list_tenants_page), so only `pageSize` rows ever leave the database.
 */
export async function listCompaniesPage(q: OrgListQuery): Promise<CompanyPage> {
  await requirePlatformAdmin();
  return withAuthenticatedDb(async (tx) => {
    let page = q.page;
    let raw = await fetchCompanyPage(tx, q, page);
    if (raw.length === 0 && page > 1) {
      // A page past the end (an old link, or rows were removed): show the last real page instead of an empty one.
      const first = await fetchCompanyPage(tx, q, 1);
      page = Math.max(1, Math.ceil(Number(first[0]?.total_count ?? 0) / q.pageSize));
      raw = page === 1 ? first : await fetchCompanyPage(tx, q, page);
    }
    return { items: raw.map(toCompany), total: Number(raw[0]?.total_count ?? 0), page, pageSize: q.pageSize };
  });
}

export type PlatformOverview = { totalOrganizations: number; active: number; suspended: number; totalUsers: number; recent: CompanySummary[] };

/** The overview numbers, counted in SQL, plus the five newest organizations. Nothing is loaded just to be counted. */
export async function getPlatformOverview(): Promise<PlatformOverview> {
  await requirePlatformAdmin();
  return withAuthenticatedDb(async (tx) => {
    const [stats] = rowsOf<{ total_tenants: string | number; active_tenants: string | number; suspended_tenants: string | number; total_users: string | number }>(
      await tx.execute(sql`select * from public.platform_overview_stats()`),
    );
    const recent = await fetchCompanyPage(tx, { q: "", status: "all", sort: "created", dir: "desc", pageSize: 5 }, 1);
    return {
      totalOrganizations: Number(stats?.total_tenants ?? 0),
      active: Number(stats?.active_tenants ?? 0),
      suspended: Number(stats?.suspended_tenants ?? 0),
      totalUsers: Number(stats?.total_users ?? 0),
      recent: recent.map(toCompany),
    };
  });
}

export async function getCompany(tenantId: string): Promise<{ company: CompanySummary; team: TeamMemberRow[] } | null> {
  await requirePlatformAdmin();
  return withAuthenticatedDb(async (tx) => {
    const [row] = rowsOf<CompanyRaw>(await tx.execute(sql`select * from public.platform_list_tenants(${tenantId}::uuid)`));
    if (!row) return null;
    const team = await listTeamRows(tx, tenantId);
    return { company: toCompany(row), team };
  });
}

export async function setCompanyStatus(tenantId: string, status: "active" | "suspended"): Promise<void> {
  await requirePlatformAdmin();
  const found = await withAuthenticatedDb(async (tx) => {
    const [before] = rowsOf<CompanyRaw>(await tx.execute(sql`select * from public.platform_list_tenants(${tenantId}::uuid)`));
    if (!before) return false;
    const rows = rowsOf<{ ok: boolean }>(await tx.execute(sql`select public.platform_set_tenant_status(${tenantId}::uuid, ${status}) as ok`));
    if (rows[0]?.ok !== true) return false;
    if (before.status !== status) {
      await recordAudit(tx, {
        action: status === "suspended" ? "organization.suspended" : "organization.reactivated",
        entityType: "organization",
        entityId: tenantId,
        organizationId: tenantId,
        description: `${status === "suspended" ? "Suspended" : "Reactivated"} organization "${before.name}"`,
        previous: { status: before.status },
        next: { status },
      });
    }
    return true;
  });
  if (!found) throw new AppError("NOT_FOUND", "Organization not found.");
}

/** The JSON array platform_delete_tenant() returns: users left with no membership anywhere. */
const orphanedUsers = z.array(z.uuid());

/**
 * Deletes an organization for good: the tenant and everything under it (stores, catalog, customers, orders,
 * memberships) in ONE database transaction, then - after that has committed - the Auth accounts of people who belonged
 * to no other organization, then its stored files. Someone who also belongs to another organization keeps their account.
 * The Platform Admin check runs first here and again inside the SQL function. Auth and file cleanup are best-effort and
 * logged: the database is authoritative, so a failure there leaves an unused sign-in or file, never a half-deleted company.
 */
export async function deleteCompany(tenantId: string): Promise<void> {
  await requirePlatformAdmin();
  let orphaned: string[];
  try {
    orphaned = await withAuthenticatedDb(async (tx) => {
      const rows = rowsOf<{ orphans: unknown }>(await tx.execute(sql`select public.platform_delete_tenant(${tenantId}::uuid) as orphans`));
      return orphanedUsers.parse(rows[0]?.orphans ?? []);
    });
  } catch (error) {
    return mapProvisioningError(error);
  }
  await Promise.all(orphaned.map((id) => deleteUserQuietly(id)));
  await removeTenantObjects(tenantId);
}

/**
 * Platform Admin adds a team member account to any company, the same account the Owner can create under
 * Team members. The Auth user is created first; the membership is then written by platform_add_member(),
 * which re-checks the Platform Admin and refuses the Owner role. If that fails the Auth user is deleted
 * again, so no orphaned account (and no reserved e-mail) remains.
 */
export async function addCompanyMember(tenantId: string, v: CreateMemberInput) {
  await requirePlatformAdmin();
  const user = await createConfirmedUser({ email: v.email, password: v.password, fullName: v.fullName });
  try {
    await withAuthenticatedDb(async (tx) => {
      await tx.execute(sql`select public.platform_add_member(${tenantId}::uuid, ${user.id}::uuid, ${JSON.stringify(v.permissions)}::jsonb)`);
      // Same transaction as the membership, so a member never exists without its log entry. No password is logged.
      await recordAudit(tx, {
        action: "team_member.added",
        entityType: "team_member",
        entityId: user.id,
        organizationId: tenantId,
        description: `Added team member ${user.email}`,
        next: { email: user.email, fullName: v.fullName, permissions: v.permissions },
      });
    });
  } catch (error) {
    await deleteUserQuietly(user.id);
    return mapProvisioningError(error);
  }
  return { userId: user.id, email: user.email };
}
