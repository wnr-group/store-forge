/**
 * Central access definition. UI and server code ask `can(actor, permission)`;
 * nobody hardcodes role names at call sites. The database enforces the same
 * rules independently through RLS (role policies plus the restrictive per-module policies, in the store-forge-api
 * repository's migrations 0002 and 0018) - keep the two in sync.
 */
import { MEMBERSHIP_ROLES, MODULES, type AccessLevel, type MemberPermissions, type MembershipRole, type Module } from "@/lib/domain/enums";

export const ROLES = MEMBERSHIP_ROLES;
export type Role = MembershipRole;

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** What the signed-in member may do: their role (the Owner row is special) plus the Owner-granted module access. */
export type Actor = { role: Role; permissions: MemberPermissions };

/**
 * The effective level of `actor` on a module. The Owner always has full access. Store settings are readable by
 * every member (the dashboard needs them), so 'settings' never drops below 'read'.
 */
export function accessLevel(actor: Actor, module: Module): AccessLevel {
  if (actor.role === "owner") return "write";
  const level = actor.permissions[module] ?? "none";
  return module === "settings" && level === "none" ? "read" : level;
}

export const canAccess = (actor: Actor, module: Module, need: "read" | "write") => {
  const level = accessLevel(actor, module);
  return level === "write" || (level === "read" && need === "read");
};

/** Permission name -> rule. A rule is either owner-only or "this level on this module". */
const PERMISSIONS = {
  "dashboard:view": { any: true },
  "store:manage": { module: "settings", need: "write" },
  "store:delete": { ownerOnly: true },
  "tenant:manage": { module: "settings", need: "write" },
  "tenant:delete": { ownerOnly: true },
  // Creating accounts is Owner-only: it needs the privileged Admin Auth API and must stay inside the Owner's own tenant.
  "members:manage": { ownerOnly: true },
  // The tenant's Razorpay credentials. Owner-only here, in the API and in RLS (the API repository's migration 0034).
  "payments:manage": { ownerOnly: true },
  // What the organization owes StoreForge for its plan (invoices, paying them). Owner-only here and in the API; the Platform Admin side is separate.
  "billing:manage": { ownerOnly: true },
  // Products, categories, collections, inventory.
  "catalog:view": { module: "products", need: "read" },
  "catalog:manage": { module: "products", need: "write" },
  "catalog:delete": { module: "products", need: "write" },
  // Carrier accounts and how carriers are chosen: Owner-only, like the payment credentials.
  "carriers:manage": { ownerOnly: true },
  // Zones, methods, rates, the shipping origin and GST settings follow the store settings; the tax report is sales data, so it follows orders.
  "shipping:view": { module: "settings", need: "read" },
  "shipping:manage": { module: "settings", need: "write" },
  "tax:view": { module: "settings", need: "read" },
  "tax:manage": { module: "settings", need: "write" },
  "tax:report": { module: "orders", need: "read" },
  // Discounts, campaigns, abandoned carts and every sales report are order data: they follow the orders module.
  "marketing:view": { module: "orders", need: "read" },
  "marketing:manage": { module: "orders", need: "write" },
  // Google Analytics and other marketing connections are store settings (their identifiers are public, there is no secret).
  "integrations:view": { module: "settings", need: "read" },
  "integrations:manage": { module: "settings", need: "write" },
  "orders:view": { module: "orders", need: "read" },
  "orders:manage": { module: "orders", need: "write" },
  "customers:view": { module: "customers", need: "read" },
  "customers:manage": { module: "customers", need: "write" },
  "customers:delete": { module: "customers", need: "write" },
} as const satisfies Record<string, { any: true } | { ownerOnly: true } | { module: Module; need: "read" | "write" }>;

export type Permission = keyof typeof PERMISSIONS;

export function can(actor: Actor, permission: Permission): boolean {
  const rule: { any?: true; ownerOnly?: true; module?: Module; need?: "read" | "write" } = PERMISSIONS[permission];
  if (rule.any) return true;
  if (rule.ownerOnly) return actor.role === "owner";
  return canAccess(actor, rule.module!, rule.need!);
}

export const canViewDashboard = (a: Actor) => can(a, "dashboard:view");
export const canManageStore = (a: Actor) => can(a, "store:manage");
export const canManageTenant = (a: Actor) => can(a, "tenant:manage");
export const canViewCatalog = (a: Actor) => can(a, "catalog:view");
export const canManageCatalog = (a: Actor) => can(a, "catalog:manage");
export const canDeleteCatalog = (a: Actor) => can(a, "catalog:delete");
export const canViewOrders = (a: Actor) => can(a, "orders:view");
export const canManageOrders = (a: Actor) => can(a, "orders:manage");
export const canViewCustomers = (a: Actor) => can(a, "customers:view");
export const canManageCustomers = (a: Actor) => can(a, "customers:manage");
export const canDeleteCustomers = (a: Actor) => can(a, "customers:delete");
export const canManageMembers = (a: Actor) => can(a, "members:manage");
export const canManagePayments = (a: Actor) => can(a, "payments:manage");
export const canManageBilling = (a: Actor) => can(a, "billing:manage");
export const canManageCarriers = (a: Actor) => can(a, "carriers:manage");
export const canViewShipping = (a: Actor) => can(a, "shipping:view");
export const canManageShipping = (a: Actor) => can(a, "shipping:manage");
export const canViewTax = (a: Actor) => can(a, "tax:view");
export const canManageTax = (a: Actor) => can(a, "tax:manage");
export const canViewTaxReport = (a: Actor) => can(a, "tax:report");
export const canViewMarketing = (a: Actor) => can(a, "marketing:view");
export const canManageMarketing = (a: Actor) => can(a, "marketing:manage");
export const canViewIntegrations = (a: Actor) => can(a, "integrations:view");
export const canManageIntegrations = (a: Actor) => can(a, "integrations:manage");

/** Members are stored with the broadest non-owner role; what they can actually do is decided by their permissions. */
export const MEMBER_ROLE = "admin" as const satisfies Role;

/** Label for the Owner-granted modules, in the order the team screens show them. */
export const MODULE_LABELS: Record<Module, { label: string; hint: string; levels: readonly AccessLevel[] }> = {
  products: { label: "Products & inventory", hint: "Products, categories, collections, stock and images.", levels: ["none", "read", "write"] },
  orders: { label: "Orders", hint: "View orders, and with write access move them through their lifecycle and cancel them.", levels: ["none", "read", "write"] },
  customers: { label: "Customers", hint: "Customer records and notes.", levels: ["none", "read", "write"] },
  settings: { label: "Store settings", hint: "Store details, contact info and logo.", levels: ["read", "write"] },
};

export const LEVEL_LABELS: Record<AccessLevel, string> = { none: "No access", read: "Read", write: "Read & write" };

/** What a member can reach, one entry per module they have any access to (modules set to none are left out). */
export function accessEntries(role: Role, permissions: MemberPermissions): { module: Module; label: string; level: AccessLevel }[] {
  const actor: Actor = { role, permissions };
  return MODULES.map((m) => ({ module: m, label: MODULE_LABELS[m].label, level: accessLevel(actor, m) })).filter((e) => e.level !== "none");
}

/** One-line summary, e.g. "Products & inventory: Read & write · Orders: Read". Used for text-only places. */
export function summarizePermissions(role: Role, permissions: MemberPermissions): string {
  if (role === "owner") return "Full access";
  const parts = accessEntries(role, permissions).map((e) => `${e.label}: ${LEVEL_LABELS[e.level]}`);
  return parts.length ? parts.join(" · ") : "No access";
}

/**
 * Roles an Owner can pick when adding or editing a member. A role is only a preset for the access levels below it:
 * nothing but the permissions is stored, and a member whose levels match no preset shows as "Custom".
 * (No preset gives write on orders: the Owner grants it per member with a custom setup.)
 */
export const ROLE_PRESETS = {
  manager: {
    label: "Manager",
    hint: "Manages products, customers and store settings.",
    permissions: { products: "write", orders: "read", customers: "write", settings: "write" },
  },
  staff: {
    label: "Staff",
    hint: "Manages products and customers; can only view orders and store settings.",
    permissions: { products: "write", orders: "read", customers: "write", settings: "read" },
  },
  viewer: {
    label: "Viewer",
    hint: "Can look at everything but change nothing.",
    permissions: { products: "read", orders: "read", customers: "read", settings: "read" },
  },
} as const satisfies Record<string, { label: string; hint: string; permissions: Record<Module, AccessLevel> }>;

export type RolePresetKey = keyof typeof ROLE_PRESETS;
export const ROLE_PRESET_KEYS = Object.keys(ROLE_PRESETS) as RolePresetKey[];

/** Which preset these levels equal, or "custom". Missing modules count as no access (settings: read). */
export function presetOf(permissions: MemberPermissions): RolePresetKey | "custom" {
  const actor: Actor = { role: "admin", permissions };
  const level = (m: Module) => {
    return accessLevel(actor, m);
  };
  return ROLE_PRESET_KEYS.find((k) => MODULES.every((m) => level(m) === ROLE_PRESETS[k].permissions[m])) ?? "custom";
}

/** What to show in a "Role" column or field. */
export function roleLabel(role: Role, permissions: MemberPermissions): string {
  if (role === "owner") return ROLE_LABELS.owner;
  const preset = presetOf(permissions);
  return preset === "custom" ? "Custom" : ROLE_PRESETS[preset].label;
}

/** Stored role names. Members are all 'admin' in the database; use roleLabel() for what the Owner sees. */
export const ROLE_LABELS: Record<Role, string> = { owner: "Owner", admin: "Team member", staff: "Team member" };
