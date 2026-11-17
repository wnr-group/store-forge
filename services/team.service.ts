import "server-only";
import type { MemberPermissions } from "@/lib/domain/enums";
import {
  createMemberApi,
  listTeamApi,
  removeMemberApi,
  resetMemberPasswordApi,
  setMemberStatusApi,
  updateMemberApi,
  type TeamMemberApi,
} from "@/lib/api/endpoints/team-api";
import { requireActiveTenant } from "@/lib/tenant/context";
import type { CreateMemberInput, UpdateMemberInput } from "@/lib/validations/team";
import { createMemberSchema, updateMemberSchema } from "@/lib/validations/team";
import { parseInput } from "@/lib/validations/parse";

/**
 * Owner-only team management for the ACTIVE tenant, served by the StoreForge API (`/team/members`).
 *
 * Tenant scope is never taken from input: it comes from `requireActiveTenant("members:manage")` (the Owner role) and the API
 * checks the membership and role again. The API creates the sign-in account, links it, and deletes the account again if
 * linking fails; it never edits the Owner or the caller; removing a member also deletes an orphaned account.
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

export const toTeamRow = (m: TeamMemberApi): TeamMemberRow => ({
  userId: m.userId,
  fullName: m.fullName,
  email: m.email,
  role: m.role as TeamMemberRow["role"],
  status: m.status === "disabled" ? "disabled" : "active",
  joinedAt: new Date(m.joinedAt),
  permissions: m.permissions as MemberPermissions,
});

export async function listTeam(): Promise<TeamMemberRow[]> {
  const { tenant } = await requireActiveTenant("members:manage");
  return (await listTeamApi(tenant.id)).map(toTeamRow);
}

export async function createMember(input: CreateMemberInput) {
  const v = parseInput(createMemberSchema, input);
  const { tenant } = await requireActiveTenant("members:manage");
  return createMemberApi(tenant.id, v);
}

/** Edit name and permissions of a team member (never the Owner, never yourself). */
export async function updateMember(input: UpdateMemberInput): Promise<void> {
  const v = parseInput(updateMemberSchema, input);
  const { tenant } = await requireActiveTenant("members:manage");
  await updateMemberApi(tenant.id, v.userId, { fullName: v.fullName, permissions: v.permissions });
}

/** Deactivate (status 'disabled': no access at all, reversible) or re-activate a member. */
export async function setMemberStatus(userId: string, status: "active" | "disabled"): Promise<void> {
  const { tenant } = await requireActiveTenant("members:manage");
  await setMemberStatusApi(tenant.id, userId, status);
}

/** Removes the membership; the account is deleted too when it has no other membership. */
export async function removeMember(userId: string): Promise<void> {
  const { tenant } = await requireActiveTenant("members:manage");
  await removeMemberApi(tenant.id, userId);
}

/** Admin-assisted password reset by the Owner for one of their own Manager/Staff accounts. */
export async function resetMemberPassword(userId: string, password: string): Promise<void> {
  const { tenant } = await requireActiveTenant("members:manage");
  await resetMemberPasswordApi(tenant.id, userId, password);
}
