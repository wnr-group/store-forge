import { z } from "zod";
import { MODULE_LABELS } from "@/lib/auth/permissions";
import { MEMBER_CAPABILITIES, type MemberPermissions } from "@/lib/domain/enums";
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
  // Studio level (none/read/write/publish). Optional so older callers keep working: on an edit the API then keeps the
  // member's current level, on a new member it means none.
  design: level(MODULE_LABELS.design.levels as ["none", "read", "write", "publish"]).optional(),
});

/** Independent grants, not levels: they do not depend on (or imply) any design level. */
export const capabilitiesSchema = z.array(z.enum(MEMBER_CAPABILITIES, { error: "Unknown capability." })).max(MEMBER_CAPABILITIES.length).optional();

export const createMemberSchema = z.object({
  fullName: requiredText("Member name", 120, 2),
  email: emailField("Member email"),
  password: passwordField,
  permissions: permissionsSchema,
  capabilities: capabilitiesSchema,
});

export const updateMemberSchema = z.object({
  userId: z.uuid(),
  fullName: requiredText("Member name", 120, 2),
  permissions: permissionsSchema,
  capabilities: capabilitiesSchema,
});

/** Stored permissions -> the full set of levels the form edits (missing module = none; settings are always readable). */
export const permissionsToForm = (p: MemberPermissions): PermissionsInput => ({
  products: (p.products ?? "none") as PermissionsInput["products"],
  orders: (p.orders === "write" ? "read" : (p.orders ?? "none")) as PermissionsInput["orders"],
  customers: (p.customers ?? "none") as PermissionsInput["customers"],
  settings: (p.settings === "write" ? "write" : "read") as PermissionsInput["settings"],
  // A member stored before the design module existed is shown as the API converts it: settings write -> publish, else read.
  design: (p.design ?? (p.settings === "write" ? "publish" : "read")) as PermissionsInput["design"],
});

export type CreateMemberInput = z.input<typeof createMemberSchema>;
export type UpdateMemberInput = z.input<typeof updateMemberSchema>;
export type PermissionsInput = z.input<typeof permissionsSchema>;
