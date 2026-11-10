import "server-only";
import { and, eq, ne, sql } from "drizzle-orm";
import { createConfirmedUser, deleteUserQuietly, setUserFullName, setUserPassword } from "@/lib/auth/provisioning";
import { memberships, type MemberPermissions } from "@/lib/db/schema";
import { errorChain, mapErrors } from "@/lib/db/errors";
import { rowsOf } from "@/lib/db/user-context";
import { AppError } from "@/lib/errors";
import { MEMBER_ROLE } from "@/lib/auth/permissions";
import { requireActiveTenant, withTenantDb } from "@/lib/tenant/context";
import type { CreateMemberInput, UpdateMemberInput } from "@/lib/validations/team";
import { createMemberSchema, updateMemberSchema } from "@/lib/validations/team";
import { parseInput } from "@/lib/validations/parse";
import { withAuthenticatedDb } from "@/lib/db/tenant-db";

/**
 * Owner-only team management for the ACTIVE tenant.
 *
 * Tenant scope is never taken from input: it comes from `requireActiveTenant("members:manage")`, which
 * looks the validated user's membership up in the database and requires the Owner role. The Admin Auth
 * API (service-role key) is only reached after that check, and the membership row is written inside a
 * transaction acting as the Owner, so RLS (memberships_insert_managers) independently refuses any
 * other tenant id, the 'owner' role, or self-assignment.
 */

export type TeamMemberRow = {
  userId: string;
  fullName: string | null;
  email: string;
  role: "owner" | "admin" | "staff";
  status: "active" | "disabled";
  joinedAt: Date;
  permissions: MemberPermissions;
};

type Tx = Parameters<Parameters<typeof withAuthenticatedDb>[0]>[0];

type TeamRaw = { user_id: string; full_name: string | null; email: string; role: string; status: string; joined_at: string | Date; permissions: MemberPermissions | null };

/** Shared by the platform company page and the Owner's Team page (the SQL function authorises both). */
export async function listTeamRows(tx: Tx, tenantId: string): Promise<TeamMemberRow[]> {
  const rows = rowsOf<TeamRaw>(await tx.execute(sql`select * from public.list_tenant_team(${tenantId}::uuid)`));
  return rows.map((r) => ({
    userId: r.user_id,
    fullName: r.full_name,
    email: r.email,
    role: r.role as TeamMemberRow["role"],
    status: r.status === "disabled" ? "disabled" : "active",
    joinedAt: new Date(r.joined_at),
    permissions: r.permissions ?? {},
  }));
}

export async function listTeam(): Promise<TeamMemberRow[]> {
  const { tenant } = await requireActiveTenant("members:manage");
  return withTenantDb({ tenantId: tenant.id, permission: "members:manage" }, (tx, ctx) => listTeamRows(tx, ctx.tenantId));
}

/**
 * Creates a team member account and links it to the Owner's tenant. If the membership insert fails
 * the freshly created Auth user is deleted again, so no orphaned account (and no reserved e-mail) remains.
 */
export async function createMember(input: CreateMemberInput) {
  const v = parseInput(createMemberSchema, input);
  const { tenant } = await requireActiveTenant("members:manage");

  const user = await createConfirmedUser({ email: v.email, password: v.password, fullName: v.fullName });
  try {
    await mapErrors(() =>
      withTenantDb({ tenantId: tenant.id, permission: "members:manage" }, (tx, ctx) =>
        tx.insert(memberships).values({ tenantId: ctx.tenantId, userId: user.id, role: MEMBER_ROLE, permissions: v.permissions }),
      ),
    );
  } catch (e) {
    await deleteUserQuietly(user.id);
    throw e;
  }
  return { userId: user.id, email: user.email };
}

function mapTeamError(error: unknown): never {
  if (error instanceof AppError) throw error;
  const msg = errorChain(error);
  if (msg.includes("not_found")) throw new AppError("NOT_FOUND", "That team member was not found.");
  if (msg.includes("cannot_remove_self")) throw new AppError("VALIDATION", "You cannot remove yourself.");
  if (msg.includes("invalid_input")) throw new AppError("VALIDATION", "Please check the details you entered.");
  if (msg.includes("forbidden")) throw new AppError("FORBIDDEN", "You do not have permission to do that.");
  throw error;
}

/** Edit name and permissions of a team member (never the Owner, never yourself - enforced by RLS and the SQL function). */
export async function updateMember(input: UpdateMemberInput): Promise<void> {
  const v = parseInput(updateMemberSchema, input);
  const { tenant } = await requireActiveTenant("members:manage");
  try {
    await mapErrors(() =>
      withTenantDb({ tenantId: tenant.id, permission: "members:manage" }, async (tx, ctx) => {
        const updated = await tx
          .update(memberships)
          .set({ permissions: v.permissions })
          .where(and(eq(memberships.tenantId, ctx.tenantId), eq(memberships.userId, v.userId), ne(memberships.role, "owner"), ne(memberships.userId, ctx.userId)))
          .returning({ id: memberships.id });
        if (updated.length !== 1) throw new AppError("NOT_FOUND", "That team member was not found.");
        await tx.execute(sql`select public.update_team_member_name(${ctx.tenantId}::uuid, ${v.userId}::uuid, ${v.fullName})`);
      }),
    );
  } catch (e) {
    mapTeamError(e);
  }
  await setUserFullName(v.userId, v.fullName); // keeps the Auth display name in step; best effort
}

/** Deactivate (status 'disabled': no access at all, reversible) or re-activate a member. */
export async function setMemberStatus(userId: string, status: "active" | "disabled"): Promise<void> {
  const { tenant } = await requireActiveTenant("members:manage");
  await mapErrors(() =>
    withTenantDb({ tenantId: tenant.id, permission: "members:manage" }, async (tx, ctx) => {
      const updated = await tx
        .update(memberships)
        .set({ status })
        .where(and(eq(memberships.tenantId, ctx.tenantId), eq(memberships.userId, userId), ne(memberships.role, "owner"), ne(memberships.userId, ctx.userId)))
        .returning({ id: memberships.id });
      if (updated.length !== 1) throw new AppError("NOT_FOUND", "That team member was not found.");
    }),
  );
}

/** Removes the membership; the Auth account is deleted too when it has no other membership. */
export async function removeMember(userId: string): Promise<void> {
  const { tenant } = await requireActiveTenant("members:manage");
  let orphaned = false;
  try {
    orphaned = await withTenantDb({ tenantId: tenant.id, permission: "members:manage" }, async (tx, ctx) => {
      const rows = rowsOf<{ orphaned: boolean }>(
        await tx.execute(sql`select public.remove_team_member(${ctx.tenantId}::uuid, ${userId}::uuid) as orphaned`),
      );
      return rows[0]?.orphaned === true;
    });
  } catch (e) {
    mapTeamError(e);
  }
  if (orphaned) await deleteUserQuietly(userId);
}

/** Admin-assisted password reset by the Owner for one of their own Manager/Staff accounts. */
export async function resetMemberPassword(userId: string, password: string): Promise<void> {
  const { tenant } = await requireActiveTenant("members:manage");
  const team = await withTenantDb({ tenantId: tenant.id, permission: "members:manage" }, (tx, ctx) => listTeamRows(tx, ctx.tenantId));
  const target = team.find((m) => m.userId === userId);
  if (!target || target.role === "owner") throw new AppError("NOT_FOUND", "That team member was not found.");
  await setUserPassword(userId, password);
}
