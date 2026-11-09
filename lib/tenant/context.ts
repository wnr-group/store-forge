import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACTIVE_TENANT_COOKIE, ROUTES } from "@/config/app";
import { can, type Permission, type Role } from "@/lib/auth/permissions";
import { isPlatformAdmin } from "@/lib/auth/platform";
import { getCurrentUser, requireUser } from "@/lib/auth/session";
import { withAuthenticatedDb, type DbTx } from "@/lib/db/tenant-db";
import { AppError } from "@/lib/errors";
import { getRequestStoreSlug } from "@/lib/tenant/request";
import { resolveActiveTenant } from "@/lib/tenant/resolve";
import { getPrimaryStoreInTx, getTenantIdForStoreSlugInTx, type Store } from "@/services/store.service";
import { listMembershipsInTx, type TenantMembership } from "@/services/tenant.service";

/**
 * SECURITY MODEL
 * The active-tenant cookie (and any tenant id from URLs, headers or the
 * client) is only a *preference*. Every function here resolves the tenant by
 * looking the user's memberships up in the database and matching against that
 * list - a forged id simply fails to match. Queries then run inside a
 * transaction acting as the user, so PostgreSQL RLS enforces the same rule
 * again independently of this code.
 */

type WorkspaceData = { memberships: TenantMembership[]; active: TenantMembership | null; store: Store | null };

/**
 * Everything needed to know "who is this user here": memberships, the active tenant and its primary store, loaded in
 * ONE transaction acting as the user (memoised per request). Each transaction costs several round trips to the
 * database, so resolving these in separate transactions made every page wait for three of them in a row.
 *
 * Same rules as before, same role and RLS: the host's store (set by the proxy) or the cookie only *select among* the
 * user's DB-verified memberships; a forged id or slug matches nothing.
 */
const loadWorkspaceData = cache(async (): Promise<WorkspaceData> => {
  const user = await getCurrentUser();
  if (!user) return { memberships: [], active: null, store: null };
  const storeSlug = await getRequestStoreSlug();
  const preferred = storeSlug ? undefined : (await cookies()).get(ACTIVE_TENANT_COOKIE)?.value;
  return withAuthenticatedDb(async (tx, u) => {
    const [memberships, hostTenantId] = await Promise.all([
      listMembershipsInTx(tx, u.id),
      storeSlug ? getTenantIdForStoreSlugInTx(tx, storeSlug) : Promise.resolve(null),
    ]);
    // On <store>.<root domain> the host names the workspace. The user must be a member of THAT store's tenant; the
    // cookie preference is ignored, and a user from another company gets no workspace here rather than silently
    // landing in their own.
    const active =
      memberships.length === 0
        ? null
        : storeSlug
          ? (memberships.find((m) => m.tenant.id === hostTenantId) ?? null)
          : resolveActiveTenant(memberships, preferred);
    const store = active ? await getPrimaryStoreInTx(tx, active.tenant.id) : null;
    return { memberships, active, store };
  });
});

/** All tenants the validated user belongs to (shares the request's single workspace transaction). */
export const getUserTenants = cache(async (): Promise<TenantMembership[]> => (await loadWorkspaceData()).memberships);

/**
 * The active tenant: the cookie's tenant if (and only if) the user is a
 * member of it, else their first tenant, else null (needs onboarding).
 */
export const getActiveTenant = cache(async (): Promise<TenantMembership | null> => (await loadWorkspaceData()).active);

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
  if (!can(membership, permission)) {
    throw new AppError("FORBIDDEN", "You do not have permission to do that.");
  }
  return membership;
}

/**
 * For protected pages: signed-in user + active tenant + its primary store,
 * or a redirect (login / admin area / no-workspace notice).
 */
export const requireWorkspace = cache(async () => {
  const user = await requireUser();
  const active = await getActiveTenant();
  // No (active) workspace: Platform Admins belong in the admin area; everyone else cannot self-onboard.
  if (!active) redirect((await isPlatformAdmin()) ? ROUTES.admin : ROUTES.noWorkspace);
  const { store, memberships: tenants } = await loadWorkspaceData();
  return { user, active, store, tenants };
});

/** `requireWorkspace()` for a page that needs `permission` (e.g. "catalog:view"); members without it go back to the overview. */
export async function requireWorkspaceCan(permission: Permission) {
  const workspace = await requireWorkspace();
  if (!can(workspace.active, permission)) redirect(ROUTES.dashboard);
  return workspace;
}

/**
 * The active tenant (DB-verified membership), optionally requiring a permission.
 * For flows that must authorise BEFORE doing non-database work (e.g. Storage calls)
 * and then open their own transaction with `withTenantDb({ tenantId })`.
 */
export async function requireActiveTenant(permission?: Permission): Promise<TenantMembership> {
  const membership = await getActiveTenant();
  if (!membership) throw new AppError("NOT_FOUND", "No active workspace. Please contact your administrator.");
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
    if (!membership) throw new AppError("NOT_FOUND", "No active workspace. Please contact your administrator.");
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
