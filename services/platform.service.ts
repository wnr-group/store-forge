import "server-only";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { deleteUserQuietly, createConfirmedUser, setUserPassword } from "@/lib/auth/provisioning";
import { requirePlatformAdmin } from "@/lib/auth/platform";
import { withAuthenticatedDb } from "@/lib/db/tenant-db";
import { rowsOf } from "@/lib/db/user-context";
import { errorChain } from "@/lib/db/errors";
import { AppError } from "@/lib/errors";
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
export async function createTenantRecords(ownerId: string, v: CreateCompanyValues) {
  try {
    return await withAuthenticatedDb(async (tx) => {
      const rows = rowsOf<{ result: unknown }>(
        await tx.execute(sql`select public.platform_provision_tenant(
          ${ownerId}::uuid, ${v.companyName}, ${v.storeName}, ${v.storeSlug},
          ${v.storeDescription}, ${v.contactPhone}, ${v.address}) as result`),
      );
      return provisionResult.parse(rows[0]?.result);
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
    records = await createTenantRecords(owner.id, v);
  } catch (first) {
    if (first instanceof AppError) {
      await deleteUserQuietly(owner.id);
      throw first;
    }
    try {
      records = await createTenantRecords(owner.id, v);
    } catch {
      const removed = await deleteUserQuietly(owner.id);
      console.error("[createCompany] provisioning failed", { ownerId: owner.id, authUserRemoved: removed, error: errorChain(first) });
      throw first;
    }
  }
  return { tenantId: records.tenant_id, storeId: records.store_id, ownerId: owner.id, ownerEmail: owner.email };
}

export async function listCompanies(): Promise<CompanySummary[]> {
  await requirePlatformAdmin();
  return withAuthenticatedDb(async (tx) =>
    rowsOf<CompanyRaw>(await tx.execute(sql`select * from public.platform_list_tenants(null)`)).map(toCompany),
  );
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
    const rows = rowsOf<{ ok: boolean }>(await tx.execute(sql`select public.platform_set_tenant_status(${tenantId}::uuid, ${status}) as ok`));
    return rows[0]?.ok === true;
  });
  if (!found) throw new AppError("NOT_FOUND", "Organization not found.");
}

/** Admin-assisted password reset for a company's Owner. The existing password is never readable. */
export async function resetOwnerPassword(tenantId: string, password: string): Promise<void> {
  await requirePlatformAdmin();
  const found = await getCompany(tenantId);
  if (!found?.company.ownerId) throw new AppError("NOT_FOUND", "This organization has no owner account.");
  await setUserPassword(found.company.ownerId, password);
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
    await withAuthenticatedDb((tx) => tx.execute(sql`select public.platform_add_member(${tenantId}::uuid, ${user.id}::uuid, ${JSON.stringify(v.permissions)}::jsonb)`));
  } catch (error) {
    await deleteUserQuietly(user.id);
    return mapProvisioningError(error);
  }
  return { userId: user.id, email: user.email };
}
