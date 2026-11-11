import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { ROUTES } from "@/config/app";
import { getPlatformMeApi } from "@/lib/api/endpoints/platform-api";
import { getCurrentUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";

/**
 * Platform Admin authorisation. Entirely separate from tenant roles: the StoreForge API answers it (`GET /platform/me`,
 * which asks the database about the validated token's user only) and never looks at memberships, cookies, request bodies or
 * user-editable metadata. Nothing a browser sends can influence the answer. The API checks again on every platform call.
 */
export type PlatformAdminLevel = "super_admin" | "admin";

/** The signed-in admin's level, or null when they are not a Platform Admin (the API answers 403). Any other failure is not swallowed. */
export const getPlatformAdminLevel = cache(async (): Promise<PlatformAdminLevel | null> => {
  if (!(await getCurrentUser())) return null;
  try {
    return (await getPlatformMeApi()).level;
  } catch (error) {
    if (error instanceof AppError && error.code === "FORBIDDEN") return null;
    throw error;
  }
});

export const isPlatformAdmin = cache(async (): Promise<boolean> => (await getPlatformAdminLevel()) !== null);

/** For admin pages: redirects non-admins away (signed-out users to login). */
export async function requirePlatformAdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect(ROUTES.login);
  if (!(await isPlatformAdmin())) redirect(ROUTES.dashboard);
  return user;
}

/**
 * For actions only a super admin may take (managing other admins, editing the platform settings). The API checks again,
 * so this is the friendly early refusal, not the only protection.
 */
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
