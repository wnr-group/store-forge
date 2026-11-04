import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { isRole, type Role } from "@/lib/auth/permissions";
import { memberships, tenants } from "@/lib/db/schema";
import { withAuthenticatedDb } from "@/lib/db/tenant-db";
import { rowsOf } from "@/lib/db/user-context";
import { AppError } from "@/lib/errors";
import type { OnboardingValues } from "@/lib/validations/onboarding";

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

export async function isStoreSlugAvailable(slug: string): Promise<boolean> {
  return withAuthenticatedDb(async (tx) => {
    const rows = rowsOf<{ available: boolean }>(await tx.execute(sql`select public.is_store_slug_available(${slug}) as available`));
    return rows[0]?.available === true;
  });
}

const onboardingResult = z.object({
  tenant_id: z.uuid(),
  store_id: z.uuid(),
  store_slug: z.string(),
  created: z.boolean(),
});

/** Messages from the whole error chain (Drizzle wraps the driver error in `cause`). */
function errorChain(error: unknown): string {
  const parts: string[] = [];
  for (let e: unknown = error; e instanceof Error; e = e.cause) parts.push(e.message);
  return parts.join(" | ");
}

/**
 * Atomically creates tenant + owner membership + first store by calling the
 * create_tenant_with_store() SQL function inside the authenticated user's
 * transaction. The function derives the acting user from auth.uid() (it takes no
 * user id), rolls everything back on failure, and returns the existing tenant if
 * the same request is repeated. Tenants/memberships have no INSERT policy, so
 * this function is the only way to create them.
 */
export async function createTenantWithStore(input: Omit<OnboardingValues, "description"> & { description?: string }) {
  try {
    return await withAuthenticatedDb(async (tx) => {
      const rows = rowsOf<{ result: unknown }>(
        await tx.execute(
          sql`select public.create_tenant_with_store(${input.businessName}, ${input.storeName}, ${input.storeSlug}, ${input.description ?? null}) as result`,
        ),
      );
      return onboardingResult.parse(rows[0]?.result);
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    const msg = errorChain(error);
    if (msg.includes("slug_taken"))
      throw new AppError("CONFLICT", "That store address is already taken.", { storeSlug: "That address is already taken" });
    if (msg.includes("invalid_slug"))
      throw new AppError("VALIDATION", "That store address is not allowed.", { storeSlug: "Choose a different address" });
    if (msg.includes("invalid_input")) throw new AppError("VALIDATION", "Please check the details you entered.");
    if (msg.includes("not_authenticated")) throw new AppError("UNAUTHENTICATED", "Your session has expired. Please sign in again.");
    throw error; // unexpected: logged by toFailure(), hidden from the user
  }
}
