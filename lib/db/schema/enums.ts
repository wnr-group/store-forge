/**
 * Allowed values for text+CHECK "enum" columns. Kept dependency-free so both
 * the Drizzle schema and the RBAC module can import it. The database enforces
 * the same sets with CHECK constraints (see schema files).
 */
export const MEMBERSHIP_ROLES = ["owner", "admin", "staff"] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

export const STORE_STATUSES = ["active", "inactive", "suspended"] as const;
export type StoreStatus = (typeof STORE_STATUSES)[number];

/** Shared by tenants.slug and stores.slug (also enforced by is_valid_store_slug()). */
export const SLUG_PATTERN = "^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$";
