import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACTIVE_TENANT_COOKIE, ROUTES } from "@/config/app";
import { can, type Permission, type Role } from "@/lib/auth/permissions";
import { getCurrentUser, requireUser } from "@/lib/auth/session";
import { withAuthenticatedDb, type DbTx } from "@/lib/db/tenant-db";
import { AppError } from "@/lib/errors";
import { resolveActiveTenant } from "@/lib/tenant/resolve";
import { getPrimaryStore } from "@/services/store.service";
import { listMembershipsForUser, type TenantMembership } from "@/services/tenant.service";

/**
 * SECURITY MODEL
 * The active-tenant cookie (and any tenant id from URLs, headers or the
 * client) is only a *preference*. Every function here resolves the tenant by
 * looking the user's memberships up in the database and matching against that
 * list - a forged id simply fails to match. Queries then run inside a
 * transaction acting as the user, so PostgreSQL RLS enforces the same rule
 * again independently of this code.
 */

/** All tenants the validated user belongs to (one query, memoised per request). */
export const getUserTenants = cache(async (): Promise<TenantMembership[]> => {
  const user = await getCurrentUser();
  if (!user) return [];
  return listMembershipsForUser();
});

/**
 * The active tenant: the cookie's tenant if (and only if) the user is a
 * member of it, else their first tenant, else null (needs onboarding).
 */
export const getActiveTenant = cache(async (): Promise<TenantMembership | null> => {
  const memberships = await getUserTenants();
  if (memberships.length === 0) return null;
  const preferred = (await cookies()).get(ACTIVE_TENANT_COOKIE)?.value;
  return resolveActiveTenant(memberships, preferred);
});

/** Verifies the user is a member of `tenantId` (never trusts the id itself). */
export async function requireTenantAccess(tenantId: string): Promise<TenantMembership> {
  if (!(await getCurrentUser())) throw new AppError("UNAUTHENTICATED", "Your session has expired. Please sign in again.");
  const membership = (await getUserTenants()).find((m) => m.tenant.id === tenantId);
  if (!membership) throw new AppError("FORBIDDEN", "You do not have access to this workspace.");
  return membership;
}

/** Verifies membership AND that the role grants `permission`. */
export async function requireTenantRole(tenantId: string, permission: Permission): Promise<TenantMembership> {
  const membership = await requireTenantAccess(tenantId);
  if (!can(membership.role, permission)) {
    throw new AppError("FORBIDDEN", "You do not have permission to do that.");
  }
  return membership;
}

/**
 * For protected pages: signed-in user + active tenant + its primary store,
 * or a redirect (login / onboarding).
 */
export const requireWorkspace = cache(async () => {
  const user = await requireUser();
  const active = await getActiveTenant();
  if (!active) redirect(ROUTES.onboarding);
  const [store, tenants] = await Promise.all([getPrimaryStore(active.tenant.id), getUserTenants()]);
  return { user, active, store, tenants };
});

/**
 * The active tenant (DB-verified membership), optionally requiring a permission.
 * For flows that must authorise BEFORE doing non-database work (e.g. Storage calls)
 * and then open their own transaction with `withTenantDb({ tenantId })`.
 */
export async function requireActiveTenant(permission?: Permission): Promise<TenantMembership> {
  const membership = await getActiveTenant();
  if (!membership) throw new AppError("NOT_FOUND", "No workspace found. Complete onboarding first.");
  if (permission) await requireTenantRole(membership.tenant.id, permission);
  return membership;
}

export type TenantDbContext = { tenantId: string; role: Role; userId: string };

/**
 * Entry point for tenant-owned data access.
 *
 * 1. Resolves the tenant: `tenantId` if given (e.g. from a route param), else
 *    the active tenant - and verifies the user's membership in the database.
 * 2. Optionally requires a permission for the user's role in that tenant.
 * 3. Runs `fn` in a transaction acting as the user, so RLS applies as well.
 *
 * Queries on tenant-owned tables must still filter by `ctx.tenantId`.
 */
export async function withTenantDb<T>(
  options: { tenantId?: string; permission?: Permission },
  fn: (tx: DbTx, ctx: TenantDbContext) => Promise<T>,
): Promise<T> {
  let membership: TenantMembership | null;
  if (options.tenantId) {
    membership = options.permission
      ? await requireTenantRole(options.tenantId, options.permission)
      : await requireTenantAccess(options.tenantId);
  } else {
    membership = await getActiveTenant();
    if (!membership) throw new AppError("NOT_FOUND", "No workspace found. Complete onboarding first.");
    if (options.permission) await requireTenantRole(membership.tenant.id, options.permission);
  }
  const { tenant, role } = membership;
  return withAuthenticatedDb((tx, user) => fn(tx, { tenantId: tenant.id, role, userId: user.id }));
}

/** Persist the preferred tenant. Callers must have verified membership first. */
export async function setActiveTenantCookie(tenantId: string) {
  (await cookies()).set(ACTIVE_TENANT_COOKIE, tenantId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
