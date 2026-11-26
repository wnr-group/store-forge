/**
 * Platform roles and permissions as the StoreForge API reports them (`GET /platform/me`). This file only NAMES them for the screens
 * (labels, descriptions, which menu entry needs which permission); what a role may actually do is decided by the API and the database.
 * No server-only imports, so client components can use it.
 */
export const PLATFORM_LEVELS = ["super_admin", "admin", "billing_admin", "support_admin"] as const;
export type PlatformAdminLevel = (typeof PLATFORM_LEVELS)[number];

export const PLATFORM_PERMISSIONS = [
  "tenants:read",
  "tenants:manage",
  "plans:read",
  "plans:manage",
  "subscriptions:read",
  "subscriptions:manage",
  "entitlements:manage",
  "usage:read",
  "billing:read",
  "billing:manage",
  "audit:read",
  "monitoring:read",
  "admins:read",
  "admins:manage",
  "settings:read",
  "settings:manage",
] as const;
export type PlatformPermission = (typeof PLATFORM_PERMISSIONS)[number];

export const PLATFORM_LEVEL_LABELS: Record<PlatformAdminLevel, string> = {
  super_admin: "Super Admin",
  admin: "Platform Admin",
  billing_admin: "Billing Admin",
  support_admin: "Support Admin",
};

export const PLATFORM_LEVEL_DESCRIPTIONS: Record<PlatformAdminLevel, string> = {
  super_admin: "Full access: organizations, plans, billing, administrators, audit log and platform settings.",
  admin: "Manages organizations, subscription plans, entitlements and usage limits. Can read billing, the audit log and monitoring.",
  billing_admin: "Manages invoices, payments, refunds and billing settings. Can see organizations, plans and usage.",
  support_admin: "Read-only support: can look up organizations, their subscription and usage. Cannot change anything.",
};

/** The permission a menu entry needs. Entries not listed here are open to every platform role. */
export const ADMIN_NAV_PERMISSION: Record<string, PlatformPermission> = {
  "/admin/organizations": "tenants:read",
  "/admin/plans": "plans:read",
  "/admin/entitlements": "plans:read",
  "/admin/limits": "usage:read",
  "/admin/usage": "usage:read",
  "/admin/billing": "billing:read",
  "/admin/team": "admins:read",
  "/admin/activity": "audit:read",
  "/admin/monitoring": "monitoring:read",
  "/admin/settings": "settings:read",
};

/** hrefs of the admin menu that a role without `permissions` should not see. */
export const hiddenAdminHrefs = (permissions: readonly string[]): string[] =>
  Object.entries(ADMIN_NAV_PERMISSION)
    .filter(([, needed]) => !permissions.includes(needed))
    .map(([href]) => href);
