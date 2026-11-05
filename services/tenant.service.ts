import "server-only";
import { asc, eq } from "drizzle-orm";
import { isRole, type Role } from "@/lib/auth/permissions";
import { memberships, tenants } from "@/lib/db/schema";
import { withAuthenticatedDb } from "@/lib/db/tenant-db";

export type TenantSummary = { id: string; name: string; slug: string };
export type TenantMembership = { tenant: TenantSummary; role: Role; joinedAt: Date };

/**
 * Tenants the signed-in user belongs to, in ONE query (membership joined to
 * tenant). The user comes from the validated session inside
 * withAuthenticatedDb - there is no user-id parameter to get wrong - and RLS
 * independently limits rows to tenants the caller is a member of.
 */
export async function listMembershipsForUser(): Promise<TenantMembership[]> {
  return withAuthenticatedDb(async (tx, user) => {
    const rows = await tx
      .select({
        role: memberships.role,
        joinedAt: memberships.createdAt,
        tenant: { id: tenants.id, name: tenants.name, slug: tenants.slug },
      })
      .from(memberships)
      .innerJoin(tenants, eq(tenants.id, memberships.tenantId))
      .where(eq(memberships.userId, user.id))
      .orderBy(asc(memberships.createdAt), asc(tenants.id));
    return rows.filter((r) => isRole(r.role));
  });
}
