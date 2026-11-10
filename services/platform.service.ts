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
import type { recoverOwnerSchema, transferOwnershipSchema, updateCompanySchema, updateStoreSchema } from "@/lib/validations/admin-org";

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

export type CompanyRaw = {
  id: string; name: string; slug: string; status: string; contact_phone: string | null; address: string | null;
  created_at: string | Date; store_id: string | null; store_name: string | null; store_slug: string | null;
  owner_id: string | null; owner_name: string | null; owner_email: string | null; member_count: string | number | bigint;
};

export const toCompany = (r: CompanyRaw): CompanySummary => ({
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
export function mapProvisioningError(error: unknown, notFound = "Organization not found."): never {
  if (error instanceof AppError) throw error;
  const msg = errorChain(error);
  if (msg.includes("not_super_admin")) throw new AppError("FORBIDDEN", "Only a super admin can do that.");
  if (msg.includes("last_super_admin")) throw new AppError("VALIDATION", "There must always be at least one super admin.");
  if (msg.includes("already_admin")) throw new AppError("CONFLICT", "That person is already a platform admin.");
  if (msg.includes("member_cannot_be_platform_admin"))
    throw new AppError("VALIDATION", "That account belongs to an organization, so it cannot also be a platform admin.");
  if (msg.includes("not_note_author")) throw new AppError("FORBIDDEN", "You can only edit your own notes.");
  if (msg.includes("currency_locked"))
    throw new AppError("VALIDATION", "Currency cannot be changed once the store has products or orders.", { currency: "Locked: prices already exist" });
  if (msg.includes("cannot_change_owner")) throw new AppError("VALIDATION", "The owner cannot be disabled or removed. Transfer ownership first.");
  if (msg.includes("already_owner")) throw new AppError("VALIDATION", "That person is already the owner.");
  if (msg.includes("not_eligible"))
    throw new AppError("VALIDATION", "Only an active team member of this organization, or a brand-new account, can become the owner.");
  if (msg.includes("slug_taken"))
    throw new AppError("CONFLICT", "That store address is already taken.", { storeSlug: "That address is already taken" });
  if (msg.includes("invalid_slug"))
    throw new AppError("VALIDATION", "That store address is not allowed.", { storeSlug: "Choose a different address" });
  if (msg.includes("invalid_input")) throw new AppError("VALIDATION", "Please check the details you entered.");
  if (msg.includes("not_found")) throw new AppError("NOT_FOUND", notFound);
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

type StoreRaw = {
  id: string; name: string; slug: string; description: string | null; currency: string; timezone: string; status: string;
  contact_email: string | null; contact_phone: string | null; has_money_data: boolean;
};

const toStore = (r: StoreRaw): StoreDetails => ({
  id: r.id,
  name: r.name,
  slug: r.slug,
  description: r.description,
  currency: r.currency,
  timezone: r.timezone,
  status: r.status === "suspended" ? "suspended" : r.status === "inactive" ? "inactive" : "active",
  contactEmail: r.contact_email,
  contactPhone: r.contact_phone,
  hasMoneyData: r.has_money_data === true,
});

async function fetchStore(tx: DbTx, tenantId: string): Promise<StoreDetails | null> {
  const [row] = rowsOf<StoreRaw>(await tx.execute(sql`select * from public.platform_get_tenant_store(${tenantId}::uuid)`));
  return row ? toStore(row) : null;
}

async function fetchCompanyRow(tx: DbTx, tenantId: string): Promise<CompanyRaw | undefined> {
  return rowsOf<CompanyRaw>(await tx.execute(sql`select * from public.platform_list_tenants(${tenantId}::uuid)`))[0];
}

/** Organization, its primary store and its team, in one transaction. */
export async function getCompany(tenantId: string): Promise<{ company: CompanySummary; store: StoreDetails | null; team: TeamMemberRow[] } | null> {
  await requirePlatformAdmin();
  return withAuthenticatedDb(async (tx) => {
    const row = await fetchCompanyRow(tx, tenantId);
    if (!row) return null;
    const [store, team] = [await fetchStore(tx, tenantId), await listTeamRows(tx, tenantId)];
    return { company: toCompany(row), store, team };
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

// ---------------------------------------------------------------------------------------------------------------------
// Phase 2: edit organization and store, store status, team members, ownership.
// Every function authorises the Platform Admin first, does its work and writes its audit entry in ONE transaction, and
// maps the SQL functions' error codes to messages. Nothing here is reachable by an organization's own users.
// ---------------------------------------------------------------------------------------------------------------------

type CompanyEdit = z.output<typeof updateCompanySchema>;
type StoreEdit = z.output<typeof updateStoreSchema>;
type TransferInput = z.output<typeof transferOwnershipSchema>;
type RecoverInput = z.output<typeof recoverOwnerSchema>;

/** The fields that differ, with their before and after values, for the audit entry. */
function diff<T extends Record<string, string | null>>(before: T, after: T) {
  const keys = (Object.keys(after) as (keyof T & string)[]).filter((k) => (before[k] ?? null) !== (after[k] ?? null));
  const pick = (o: T) => Object.fromEntries(keys.map((k) => [k, o[k] ?? null]));
  return { keys, previous: pick(before), next: pick(after) };
}

/** Edits the organization's name, contact phone and address. Nothing is written (or logged) when nothing changed. */
export async function updateCompany(tenantId: string, v: CompanyEdit): Promise<void> {
  await requirePlatformAdmin();
  try {
    await withAuthenticatedDb(async (tx) => {
      const before = await fetchCompanyRow(tx, tenantId);
      if (!before) throw new AppError("NOT_FOUND", "Organization not found.");
      const d = diff(
        { name: before.name, contactPhone: before.contact_phone, address: before.address },
        { name: v.companyName, contactPhone: v.contactPhone, address: v.address },
      );
      if (d.keys.length === 0) return;
      const rows = rowsOf<{ ok: boolean }>(await tx.execute(sql`select public.platform_update_tenant(${tenantId}::uuid, ${v.companyName}, ${v.contactPhone}, ${v.address}) as ok`));
      if (rows[0]?.ok !== true) throw new AppError("NOT_FOUND", "Organization not found.");
      await recordAudit(tx, {
        action: "organization.updated",
        entityType: "organization",
        entityId: tenantId,
        organizationId: tenantId,
        description: `Updated organization "${before.name}": ${d.keys.join(", ")}`,
        previous: d.previous,
        next: d.next,
      });
    });
  } catch (error) {
    return mapProvisioningError(error);
  }
}

/** Edits the primary store: name, description, contact details, currency and timezone (never the address or logo). */
export async function updateCompanyStore(tenantId: string, v: StoreEdit): Promise<void> {
  await requirePlatformAdmin();
  try {
    await withAuthenticatedDb(async (tx) => {
      const store = await fetchStore(tx, tenantId);
      if (!store) throw new AppError("NOT_FOUND", "This organization does not have a store.");
      const d = diff(
        { name: store.name, description: store.description, contactEmail: store.contactEmail, contactPhone: store.contactPhone, currency: store.currency, timezone: store.timezone },
        { name: v.name, description: v.description, contactEmail: v.contactEmail, contactPhone: v.contactPhone, currency: v.currency, timezone: v.timezone },
      );
      if (d.keys.length === 0) return;
      const rows = rowsOf<{ ok: boolean }>(
        await tx.execute(sql`select public.platform_update_store(${tenantId}::uuid, ${store.id}::uuid, ${v.name}, ${v.description}, ${v.contactEmail}, ${v.contactPhone}, ${v.currency}, ${v.timezone}) as ok`),
      );
      if (rows[0]?.ok !== true) throw new AppError("NOT_FOUND", "This organization does not have a store.");
      await recordAudit(tx, {
        action: "store.updated",
        entityType: "store",
        entityId: store.id,
        organizationId: tenantId,
        description: `Updated store "${store.name}": ${d.keys.join(", ")}`,
        previous: d.previous,
        next: d.next,
      });
    });
  } catch (error) {
    return mapProvisioningError(error);
  }
}

const findMember = (team: TeamMemberRow[], userId: string) => {
  const m = team.find((t) => t.userId === userId);
  if (!m) throw new AppError("NOT_FOUND", "That team member was not found.");
  return m;
};

/** Disables (no access, reversible) or reactivates a team member. The Owner cannot be disabled. */
export async function setCompanyMemberStatus(tenantId: string, userId: string, status: "active" | "disabled"): Promise<void> {
  await requirePlatformAdmin();
  try {
    await withAuthenticatedDb(async (tx) => {
      const target = findMember(await listTeamRows(tx, tenantId), userId);
      if (target.role === "owner") throw new AppError("VALIDATION", "The owner cannot be disabled or removed. Transfer ownership first.");
      if (target.status === status) return;
      const rows = rowsOf<{ ok: boolean }>(await tx.execute(sql`select public.platform_set_member_status(${tenantId}::uuid, ${userId}::uuid, ${status}) as ok`));
      if (rows[0]?.ok !== true) throw new AppError("NOT_FOUND", "That team member was not found.");
      await recordAudit(tx, {
        action: status === "disabled" ? "team_member.disabled" : "team_member.reactivated",
        entityType: "team_member",
        entityId: userId,
        organizationId: tenantId,
        description: `${status === "disabled" ? "Disabled" : "Reactivated"} team member ${target.email}`,
        previous: { email: target.email, status: target.status },
        next: { email: target.email, status },
      });
    });
  } catch (error) {
    return mapProvisioningError(error, "That team member was not found.");
  }
}

/** Removes a team member. Their sign-in is deleted too when they belong to no other organization. The Owner cannot be removed. */
export async function removeCompanyMember(tenantId: string, userId: string): Promise<void> {
  await requirePlatformAdmin();
  let orphaned = false;
  try {
    orphaned = await withAuthenticatedDb(async (tx) => {
      const target = findMember(await listTeamRows(tx, tenantId), userId);
      if (target.role === "owner") throw new AppError("VALIDATION", "The owner cannot be disabled or removed. Transfer ownership first.");
      const rows = rowsOf<{ orphaned: boolean }>(await tx.execute(sql`select public.platform_remove_member(${tenantId}::uuid, ${userId}::uuid) as orphaned`));
      await recordAudit(tx, {
        action: "team_member.removed",
        entityType: "team_member",
        entityId: userId,
        organizationId: tenantId,
        description: `Removed team member ${target.email}`,
        previous: { email: target.email, fullName: target.fullName, status: target.status, permissions: target.permissions },
      });
      return rows[0]?.orphaned === true;
    });
  } catch (error) {
    return mapProvisioningError(error, "That team member was not found.");
  }
  if (orphaned) await deleteUserQuietly(userId); // after the commit; a failure is logged, never half-applied
}

type OwnerChange = { previous_owner_id: string | null; new_owner_id: string; created_membership: boolean };
const ownerChange = z.object({ previous_owner_id: z.uuid().nullable(), new_owner_id: z.uuid(), created_membership: z.boolean() });

/** The shared tail of a transfer and a recovery: one SQL call, then one audit entry, inside the caller's transaction. */
async function assignOwner(
  tx: DbTx,
  tenantId: string,
  newOwnerId: string,
  previousOwner: "keep" | "disable",
  mode: "transfer" | "recovery",
  team: TeamMemberRow[],
  companyName: string,
  newOwnerEmail: string,
) {
  const rows = rowsOf<{ r: unknown }>(
    await tx.execute(sql`select public.platform_assign_owner(${tenantId}::uuid, ${newOwnerId}::uuid, ${previousOwner === "disable" ? "disabled" : "active"}) as r`),
  );
  const change: OwnerChange = ownerChange.parse(rows[0]?.r);
  const old = change.previous_owner_id ? team.find((t) => t.userId === change.previous_owner_id) : undefined;
  const previousStatus = previousOwner === "disable" ? "disabled" : "active";
  await recordAudit(tx, {
    action: "ownership.transferred",
    entityType: "team_member",
    entityId: newOwnerId,
    organizationId: tenantId,
    description: old
      ? `${mode === "recovery" ? "Recovered ownership of" : "Transferred ownership of"} "${companyName}" from ${old.email} to ${newOwnerEmail}`
      : `Appointed ${newOwnerEmail} as owner of "${companyName}" (no previous owner)`,
    previous: { ownerId: change.previous_owner_id, ownerEmail: old?.email ?? null },
    next: { ownerId: newOwnerId, ownerEmail: newOwnerEmail, mode, previousOwnerStatus: old ? previousStatus : null, newAccount: change.created_membership },
  });
}

/** Hands ownership to an existing, active team member. Atomic: the old owner becomes a team member, there is never no owner or two. */
export async function transferCompanyOwnership(tenantId: string, v: TransferInput): Promise<void> {
  await requirePlatformAdmin();
  try {
    await withAuthenticatedDb(async (tx) => {
      const company = await fetchCompanyRow(tx, tenantId);
      if (!company) throw new AppError("NOT_FOUND", "Organization not found.");
      const team = await listTeamRows(tx, tenantId);
      const target = findMember(team, v.userId);
      if (target.role === "owner") throw new AppError("VALIDATION", "That person is already the owner.");
      if (target.status !== "active") throw new AppError("VALIDATION", "Only an active team member can become the owner. Reactivate them first.");
      await assignOwner(tx, tenantId, v.userId, v.previousOwner, "transfer", team, company.name, target.email);
    });
  } catch (error) {
    return mapProvisioningError(error);
  }
}

/**
 * Owner recovery: creates a brand-new owner account and makes it the owner, for an organization whose owner is lost or
 * missing. The Auth account is created first and deleted again if the database step fails, so no orphaned sign-in remains.
 * The password is set once here, never stored by us, and never written to the audit log.
 */
export async function recoverCompanyOwner(tenantId: string, v: RecoverInput): Promise<{ email: string }> {
  await requirePlatformAdmin();
  const exists = await withAuthenticatedDb(async (tx) => Boolean(await fetchCompanyRow(tx, tenantId)));
  if (!exists) throw new AppError("NOT_FOUND", "Organization not found.");
  const owner = await createConfirmedUser({ email: v.ownerEmail, password: v.ownerPassword, fullName: v.ownerName });
  try {
    await withAuthenticatedDb(async (tx) => {
      const company = await fetchCompanyRow(tx, tenantId);
      if (!company) throw new AppError("NOT_FOUND", "Organization not found.");
      await assignOwner(tx, tenantId, owner.id, v.previousOwner, "recovery", await listTeamRows(tx, tenantId), company.name, owner.email);
    });
  } catch (error) {
    await deleteUserQuietly(owner.id);
    return mapProvisioningError(error);
  }
  return { email: owner.email };
}
