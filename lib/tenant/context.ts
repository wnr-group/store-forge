import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACTIVE_TENANT_COOKIE, ROUTES } from "@/config/app";
import { can, type Permission, type Role } from "@/lib/auth/permissions";
import { isPlatformAdmin } from "@/lib/auth/platform";
import { getCurrentUser, requireUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { getRequestStoreSlug } from "@/lib/tenant/request";
import type { Store } from "@/services/store.service";
import type { TenantMembership } from "@/services/tenant.service";
import { loadWorkspaceViaApi } from "@/lib/tenant/api-workspace";

/**
 * SECURITY MODEL
 * The active-tenant cookie (and any tenant id from URLs, headers or the
 * client) is only a *preference*. Every function here resolves the tenant by
 * asking the StoreForge API for the user's memberships and matching against that
 * list - a forged id simply fails to match. The API then runs every query as the
 * user, so PostgreSQL RLS enforces the same rule again independently of this code.
 */

type WorkspaceData = { memberships: TenantMembership[]; active: TenantMembership | null; store: Store | null };

/**
 * Everything needed to know "who is this user here": memberships, the active tenant and its primary store, loaded from the
 * StoreForge API (`GET /organizations`, `GET /organizations/current`) and memoised per request.
 *
 * The host's store (set by the proxy) or the cookie only *select among* the memberships the API returned; a forged id or
 * slug matches nothing, and the API verifies membership again on every call that names an organization.
 */
const loadWorkspaceData = cache(async (): Promise<WorkspaceData> => {
  const user = await getCurrentUser();
  if (!user) return { memberships: [], active: null, store: null };
  const storeSlug = await getRequestStoreSlug();
  const preferred = storeSlug ? undefined : (await cookies()).get(ACTIVE_TENANT_COOKIE)?.value;
  return loadWorkspaceViaApi(storeSlug, preferred);
});

/** All tenants the validated user belongs to (shares the request's single workspace transaction). */
export const getUserTenants = cache(async (): Promise<TenantMembership[]> => (await loadWorkspaceData()).memberships);

/**
 * The active tenant: the cookie's tenant if (and only if) the user is a
 * member of it, else their first tenant, else null (needs onboarding).
 */
/** The active tenant's primary store (slug included), from the API-verified workspace. */
export const getActiveStore = cache(async (): Promise<Store | null> => (await loadWorkspaceData()).store);

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
 * The active tenant (membership verified by the API), optionally requiring a permission.
 * For flows that must authorise BEFORE doing non-API work (e.g. Storage calls).
 */
export async function requireActiveTenant(permission?: Permission): Promise<TenantMembership> {
  const membership = await getActiveTenant();
  if (!membership) throw new AppError("NOT_FOUND", "No active workspace. Please contact your administrator.");
  if (permission) await requireTenantRole(membership.tenant.id, permission);
  return membership;
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
