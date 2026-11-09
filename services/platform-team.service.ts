import "server-only";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { requirePlatformAdmin, requireSuperAdmin, type PlatformAdminLevel } from "@/lib/auth/platform";
import { createConfirmedUser, deleteUserQuietly } from "@/lib/auth/provisioning";
import { withAuthenticatedDb } from "@/lib/db/tenant-db";
import { rowsOf } from "@/lib/db/user-context";
import { AppError } from "@/lib/errors";
import type { addPlatformAdminSchema } from "@/lib/validations/admin-platform";
import { recordAudit } from "@/services/admin-audit.service";
import { mapProvisioningError } from "@/services/platform.service";

/**
 * Platform Admin management. Adding, changing and removing admins is for super admins only: requireSuperAdmin() refuses early,
 * and every SQL function behind it checks again. The last super admin can never be removed or demoted (enforced in SQL under a
 * lock, so two simultaneous requests cannot both succeed). Platform authority is separate from tenant roles: an account that
 * belongs to an organization cannot become an admin.
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

const adminRows = z.array(
  z.object({
    user_id: z.uuid(),
    email: z.string(),
    full_name: z.string().nullable(),
    role: z.enum(["super_admin", "admin"]),
    created_at: z.union([z.string(), z.date()]),
    created_by: z.uuid().nullable(),
    created_by_email: z.string().nullable(),
  }),
);

async function fetchAdmins(tx: Parameters<Parameters<typeof withAuthenticatedDb>[0]>[0]): Promise<PlatformAdminRow[]> {
  return adminRows.parse(rowsOf(await tx.execute(sql`select * from public.platform_list_admins()`))).map((r) => ({
    userId: r.user_id,
    email: r.email,
    fullName: r.full_name,
    role: r.role,
    createdAt: new Date(r.created_at),
    createdBy: r.created_by,
    createdByEmail: r.created_by_email,
  }));
}

/** Every Platform Admin can see the list; only super admins can change it. */
export async function listPlatformAdmins(): Promise<PlatformAdminRow[]> {
  await requirePlatformAdmin();
  return withAuthenticatedDb((tx) => fetchAdmins(tx));
}

const LEVEL_LABEL: Record<PlatformAdminLevel, string> = { super_admin: "super admin", admin: "admin" };

/**
 * Creates the account (confirmed, no e-mail sent) and makes it a Platform Admin. If the database step fails the account is
 * deleted again, so no orphaned sign-in remains. The initial password is never stored by us or written to the audit log.
 */
export async function addPlatformAdmin(v: z.output<typeof addPlatformAdminSchema>): Promise<{ email: string }> {
  await requireSuperAdmin();
  const user = await createConfirmedUser({ email: v.email, password: v.password, fullName: v.fullName });
  try {
    await withAuthenticatedDb(async (tx) => {
      await tx.execute(sql`select public.platform_add_admin(${user.id}::uuid, ${v.role})`);
      await recordAudit(tx, {
        action: "platform_admin.added",
        entityType: "platform_admin",
        entityId: user.id,
        description: `Added platform admin ${user.email} as ${LEVEL_LABEL[v.role]}`,
        next: { email: user.email, fullName: v.fullName, role: v.role },
      });
    });
  } catch (error) {
    await deleteUserQuietly(user.id);
    return mapProvisioningError(error, "That admin was not found.");
  }
  return { email: user.email };
}

/** Changes an admin's level. Nothing is written or logged when it is already that level. */
export async function setPlatformAdminRole(userId: string, role: PlatformAdminLevel): Promise<void> {
  await requireSuperAdmin();
  try {
    await withAuthenticatedDb(async (tx) => {
      const target = (await fetchAdmins(tx)).find((a) => a.userId === userId);
      if (!target) throw new AppError("NOT_FOUND", "That admin was not found.");
      if (target.role === role) return;
      await tx.execute(sql`select public.platform_set_admin_role(${userId}::uuid, ${role})`);
      await recordAudit(tx, {
        action: "platform_admin.role_changed",
        entityType: "platform_admin",
        entityId: userId,
        description: `Changed ${target.email} from ${LEVEL_LABEL[target.role]} to ${LEVEL_LABEL[role]}`,
        previous: { email: target.email, role: target.role },
        next: { email: target.email, role },
      });
    });
  } catch (error) {
    return mapProvisioningError(error, "That admin was not found.");
  }
}

/**
 * Removes Platform Admin access, also your own when another super admin remains. The sign-in is deleted afterwards (these
 * accounts exist only for platform work); a failure there is logged and leaves an unused account, never a half-removed admin.
 */
export async function removePlatformAdmin(userId: string): Promise<void> {
  await requireSuperAdmin();
  try {
    await withAuthenticatedDb(async (tx) => {
      const target = (await fetchAdmins(tx)).find((a) => a.userId === userId);
      if (!target) throw new AppError("NOT_FOUND", "That admin was not found.");
      // The entry goes in FIRST: removing your own access ends your admin status, and recording needs it. If the removal
      // is then refused (the last super admin), the whole transaction rolls back and no entry remains.
      await recordAudit(tx, {
        action: "platform_admin.removed",
        entityType: "platform_admin",
        entityId: userId,
        description: `Removed platform admin ${target.email} (${LEVEL_LABEL[target.role]})`,
        previous: { email: target.email, fullName: target.fullName, role: target.role },
      });
      await tx.execute(sql`select public.platform_remove_admin(${userId}::uuid)`);
    });
  } catch (error) {
    return mapProvisioningError(error, "That admin was not found.");
  }
  await deleteUserQuietly(userId);
}
