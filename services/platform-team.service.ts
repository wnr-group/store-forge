import "server-only";
import type { z } from "zod";
import { requirePlatformAdmin, requireSuperAdmin, type PlatformAdminLevel } from "@/lib/auth/platform";
import {
  addPlatformAdminApi,
  listPlatformAdminsApi,
  removePlatformAdminApi,
  setPlatformAdminRoleApi,
} from "@/lib/api/endpoints/platform-api";
import type { addPlatformAdminSchema } from "@/lib/validations/admin-platform";

/**
 * Platform Admin management, served by the StoreForge API (`/platform/admins`). Adding, changing and removing admins is for
 * super admins only (refused early here and by the API). The last super admin can never be removed or demoted, and an
 * account that belongs to an organization cannot become an admin (both enforced in the database by the API).
 */
export type PlatformAdminRow = {
  userId: string;
  email: string;
  fullName: string | null;
  role: PlatformAdminLevel;
  createdAt: Date;
  createdBy: string | null;
  createdByEmail: string | null;
};

/** Every Platform Admin can see the list; only super admins can change it. */
export async function listPlatformAdmins(): Promise<PlatformAdminRow[]> {
  await requirePlatformAdmin();
  return (await listPlatformAdminsApi()).map((a) => ({ ...a, createdAt: new Date(a.createdAt) }));
}

/** The API creates the account (confirmed, no e-mail sent), makes it an admin, audits it, and deletes the account if any step fails. */
export async function addPlatformAdmin(v: z.output<typeof addPlatformAdminSchema>): Promise<{ email: string }> {
  await requireSuperAdmin();
  return addPlatformAdminApi({ fullName: v.fullName, email: v.email, password: v.password, role: v.role });
}

/** Changes an admin's level. Nothing is written or logged when it is already that level. */
export async function setPlatformAdminRole(userId: string, role: PlatformAdminLevel): Promise<void> {
  await requireSuperAdmin();
  await setPlatformAdminRoleApi(userId, role);
}

/** Removes Platform Admin access (also your own when another super admin remains) and the admin-only sign-in. */
export async function removePlatformAdmin(userId: string): Promise<void> {
  await requireSuperAdmin();
  await removePlatformAdminApi(userId);
}
