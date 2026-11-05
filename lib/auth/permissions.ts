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
  // Creating accounts is Owner-only: it needs the privileged Admin Auth API and must stay inside the Owner's own tenant.
  "members:manage": ["owner"],
  // Catalog, stock and customers: everyone can create/edit; only owner/admin can delete.
  "catalog:manage": ["owner", "admin", "staff"],
  "catalog:delete": ["owner", "admin"],
  "customers:manage": ["owner", "admin", "staff"],
  "customers:delete": ["owner", "admin"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export const canViewDashboard = (role: Role) => can(role, "dashboard:view");
export const canManageStore = (role: Role) => can(role, "store:manage");
export const canManageTenant = (role: Role) => can(role, "tenant:manage");
export const canManageCatalog = (role: Role) => can(role, "catalog:manage");
export const canDeleteCatalog = (role: Role) => can(role, "catalog:delete");
export const canManageCustomers = (role: Role) => can(role, "customers:manage");
export const canDeleteCustomers = (role: Role) => can(role, "customers:delete");
export const canManageMembers = (role: Role) => can(role, "members:manage");

/** Team roles an Owner may assign. 'owner' is never assignable; Platform Admin is not a tenant role at all. */
export const ASSIGNABLE_ROLES = ["admin", "staff"] as const satisfies readonly Role[];
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

/** Which roles `actor` may assign to others. */
export function assignableRoles(actor: Role): AssignableRole[] {
  return actor === "owner" ? [...ASSIGNABLE_ROLES] : [];
}

/**
 * The middle role is stored as `admin` (RLS policies reference it) but shown as "Manager"
 * so it is never confused with the StoreForge Platform Admin.
 */
export const ROLE_LABELS: Record<Role, string> = { owner: "Owner", admin: "Manager", staff: "Staff" };
