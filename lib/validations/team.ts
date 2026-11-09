import { z } from "zod";
import { MODULE_LABELS } from "@/lib/auth/permissions";
import { passwordField } from "./auth";
import { emailField, requiredText } from "./fields";

const level = <const L extends readonly [string, ...string[]]>(levels: L) => z.enum(levels, { error: "Choose an access level." });

/**
 * The Owner picks a level per module. Each module only accepts the levels the UI offers (orders are read-only for
 * now, store settings are always at least readable); the database re-validates the stored object as well.
 */
export const permissionsSchema = z.object({
  products: level(MODULE_LABELS.products.levels as ["none", "read", "write"]),
  orders: level(MODULE_LABELS.orders.levels as ["none", "read"]),
  customers: level(MODULE_LABELS.customers.levels as ["none", "read", "write"]),
  settings: level(MODULE_LABELS.settings.levels as ["read", "write"]),
});

export const createMemberSchema = z.object({
  fullName: requiredText("Member name", 120, 2),
  email: emailField("Member email"),
  password: passwordField,
  permissions: permissionsSchema,
});

export const updateMemberSchema = z.object({
  userId: z.uuid(),
  fullName: requiredText("Member name", 120, 2),
  permissions: permissionsSchema,
});

export type CreateMemberInput = z.input<typeof createMemberSchema>;
export type UpdateMemberInput = z.input<typeof updateMemberSchema>;
export type PermissionsInput = z.input<typeof permissionsSchema>;
