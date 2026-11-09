import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { ROUTES } from "@/config/app";
import { getCurrentUser } from "@/lib/auth/session";
import { withAuthenticatedDb } from "@/lib/db/tenant-db";
import { rowsOf } from "@/lib/db/user-context";
import { AppError } from "@/lib/errors";

/**
 * Platform Admin authorisation. Entirely separate from tenant roles: it asks the database
 * (public.is_platform_admin(), which reads only auth.uid() and the privately-managed
 * platform_admins table) and never looks at memberships, profiles, cookies, request bodies or
 * user-editable metadata. Nothing a browser sends can influence the answer.
 */
export const isPlatformAdmin = cache(async (): Promise<boolean> => {
  if (!(await getCurrentUser())) return false;
  return withAuthenticatedDb(async (tx) => {
    const rows = rowsOf<{ ok: boolean }>(await tx.execute(sql`select public.is_platform_admin() as ok`));
    return rows[0]?.ok === true;
  });
});

export type PlatformAdminLevel = "super_admin" | "admin";

/** The signed-in admin's level, or null when they are not a Platform Admin. Always answered by the database. */
export const getPlatformAdminLevel = cache(async (): Promise<PlatformAdminLevel | null> => {
  if (!(await getCurrentUser())) return null;
  return withAuthenticatedDb(async (tx) => {
    const rows = rowsOf<{ r: string | null }>(await tx.execute(sql`select public.platform_admin_role() as r`));
    const role = rows[0]?.r;
    return role === "super_admin" || role === "admin" ? role : null;
  });
});

/** For admin pages: redirects non-admins away (signed-out users to login). */
export async function requirePlatformAdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect(ROUTES.login);
  if (!(await isPlatformAdmin())) redirect(ROUTES.dashboard);
  return user;
}

/**
 * For actions only a super admin may take (managing other admins, editing the platform settings). The SQL functions behind
 * them check again, so this is the friendly early refusal, not the only protection.
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
