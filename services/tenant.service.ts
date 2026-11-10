import "server-only";
import { asc, eq } from "drizzle-orm";
import { isRole, type Role } from "@/lib/auth/permissions";
import type { MemberPermissions } from "@/lib/db/schema/enums";
import { memberships, tenants } from "@/lib/db/schema";
import { withAuthenticatedDb, type DbTx } from "@/lib/db/tenant-db";

export type TenantSummary = { id: string; name: string; slug: string };
export type TenantMembership = { tenant: TenantSummary; role: Role; permissions: MemberPermissions; joinedAt: Date };

/**
 * Tenants the signed-in user belongs to, in ONE query (membership joined to
 * tenant). The user comes from the validated session inside
 * withAuthenticatedDb - there is no user-id parameter to get wrong - and RLS
 * independently limits rows to tenants the caller is a member of.
 */
export async function listMembershipsForUser(): Promise<TenantMembership[]> {
  return withAuthenticatedDb((tx, user) => listMembershipsInTx(tx, user.id));
}

/** The membership query itself, for callers that already hold the request's transaction (see lib/tenant/context). */
export async function listMembershipsInTx(tx: DbTx, userId: string): Promise<TenantMembership[]> {
  const rows = await tx
    .select({
      role: memberships.role,
      permissions: memberships.permissions,
      joinedAt: memberships.createdAt,
      tenant: { id: tenants.id, name: tenants.name, slug: tenants.slug },
    })
    .from(memberships)
    .innerJoin(tenants, eq(tenants.id, memberships.tenantId))
    .where(eq(memberships.userId, userId))
    .orderBy(asc(memberships.createdAt), asc(tenants.id));
  return rows.filter((r) => isRole(r.role));
}
