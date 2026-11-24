import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { ROUTES } from "@/config/app";
import { getPlatformMeApi } from "@/lib/api/endpoints/platform-api";
import { getCurrentUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { PLATFORM_LEVEL_LABELS, type PlatformAdminLevel, type PlatformPermission } from "@/lib/platform/roles";

export { PLATFORM_LEVEL_LABELS, type PlatformAdminLevel, type PlatformPermission };

/**
 * Platform authorisation. Entirely separate from tenant roles: the StoreForge API answers it (`GET /platform/me`, which asks
 * the database about the validated token's user only) and never looks at memberships, cookies, request bodies or user-editable
 * metadata. Nothing a browser sends can influence the answer. The role decides which permissions apply; the API (and the
 * database) check again on every platform call, so everything here is the friendly early refusal and what the menu hides.
 */
export type PlatformAccess = { level: PlatformAdminLevel; permissions: readonly PlatformPermission[] };

/** The signed-in person's platform role and permissions, or null when they are not platform staff (the API answers 403). Any other failure is not swallowed. */
export const getPlatformAccess = cache(async (): Promise<PlatformAccess | null> => {
  if (!(await getCurrentUser())) return null;
  try {
    const me = await getPlatformMeApi();
    return { level: me.level, permissions: me.permissions };
  } catch (error) {
    if (error instanceof AppError && error.code === "FORBIDDEN") return null;
    throw error;
  }
});

export const getPlatformAdminLevel = cache(async (): Promise<PlatformAdminLevel | null> => (await getPlatformAccess())?.level ?? null);

export const isPlatformAdmin = cache(async (): Promise<boolean> => (await getPlatformAccess()) !== null);

/** For admin pages: redirects non-staff away (signed-out users to login). */
export async function requirePlatformAdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect(ROUTES.login);
  if (!(await isPlatformAdmin())) redirect(ROUTES.dashboard);
  return user;
}

/**
 * For a page that needs one permission: staff without it are sent to the overview instead of seeing an error. The API refuses the data
 * anyway; this keeps a typed-in address from showing an empty or failing page.
 */
export async function requirePlatformPagePermission(permission: PlatformPermission) {
  const user = await requirePlatformAdminPage();
  const access = await getPlatformAccess();
  if (!access?.permissions.includes(permission)) redirect(ROUTES.admin);
  return user;
}

/** For actions only a super admin may take (managing other admins, editing the platform settings). */
export async function requireSuperAdmin() {
  const user = await requirePlatformAdmin();
  if ((await getPlatformAdminLevel()) !== "super_admin") throw new AppError("FORBIDDEN", "Only a super admin can do that.");
  return user;
}

/** For server actions and services: throws instead of redirecting. Call this BEFORE any privileged work. */
export async function requirePlatformAdmin() {
  const user = await getCurrentUser();
  if (!user) throw new AppError("UNAUTHENTICATED", "Your session has expired. Please sign in again.");
  if (!(await isPlatformAdmin())) throw new AppError("FORBIDDEN", "You do not have permission to do that.");
  return user;
}

/** For services and actions that need one permission (for example `billing:manage`). */
export async function requirePlatformPermission(permission: PlatformPermission) {
  const user = await requirePlatformAdmin();
  const access = await getPlatformAccess();
  if (!access?.permissions.includes(permission)) throw new AppError("FORBIDDEN", "Your role does not allow that.");
  return user;
}
