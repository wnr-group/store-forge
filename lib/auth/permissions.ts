/**
 * Central RBAC definition. UI and server code ask `can(role, permission)`;
 * nobody hardcodes role names at call sites. The database enforces the same
 * rules independently through RLS (see drizzle/0002_rls_policies.sql) -
 * keep the two in sync.
 */
import { MEMBERSHIP_ROLES, type MembershipRole } from "@/lib/db/schema/enums";

export const ROLES = MEMBERSHIP_ROLES;
export type Role = MembershipRole;

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

const PERMISSIONS = {
  "dashboard:view": ["owner", "admin", "staff"],
  "store:manage": ["owner", "admin"],
  "store:delete": ["owner"],
  "tenant:manage": ["owner", "admin"],
  "tenant:delete": ["owner"],
  "members:manage": ["owner", "admin"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export const canViewDashboard = (role: Role) => can(role, "dashboard:view");
export const canManageStore = (role: Role) => can(role, "store:manage");
export const canManageTenant = (role: Role) => can(role, "tenant:manage");
export const canManageMembers = (role: Role) => can(role, "members:manage");

/** Which roles `actor` may assign to others. 'owner' is never assignable. */
export function assignableRoles(actor: Role): Role[] {
  if (actor === "owner") return ["admin", "staff"];
  if (actor === "admin") return ["staff"];
  return [];
}

export const ROLE_LABELS: Record<Role, string> = { owner: "Owner", admin: "Admin", staff: "Staff" };
