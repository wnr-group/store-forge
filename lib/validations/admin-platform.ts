import { z } from "zod";
import { PLATFORM_ADMIN_ROLES } from "@/lib/db/schema";
import { passwordField } from "./auth";
import { emailField, isSupportedCurrency, isValidTimeZone, optionalEmail, requiredText } from "./fields";

/** Platform Admin management, support notes and platform settings. Everything is re-validated by the server action and again in SQL. */

export const addPlatformAdminSchema = z.object({
  fullName: requiredText("Name", 120, 2),
  email: emailField("Email"),
  password: passwordField,
  role: z.enum(PLATFORM_ADMIN_ROLES, { error: "Choose an access level." }),
});
export type AddPlatformAdminInput = z.input<typeof addPlatformAdminSchema>;

export const setPlatformAdminRoleSchema = z.object({
  userId: z.uuid(),
  role: z.enum(PLATFORM_ADMIN_ROLES, { error: "Choose an access level." }),
});

export const supportNoteSchema = z.object({ body: requiredText("Note", 2000) });
export type SupportNoteInput = z.input<typeof supportNoteSchema>;

const SUBDOMAIN = /^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$/;

/**
 * The reserved subdomains are typed as one block of text (one per line, or separated by commas or spaces). The result is a
 * lower-cased, de-duplicated list; anything that could not be a store address is rejected with the offending names.
 */
const reservedList = z
  .string()
  .max(6000, "That list is too long.")
  .transform((raw, ctx) => {
    const names = [...new Set(raw.split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean))].sort();
    const bad = names.filter((n) => !SUBDOMAIN.test(n) || n.includes("--"));
    if (bad.length) ctx.addIssue({ code: "custom", message: `Not valid as a store address: ${bad.slice(0, 5).join(", ")}. Use lowercase letters, numbers and hyphens, at least 2 characters.` });
    if (names.length > 200) ctx.addIssue({ code: "custom", message: "At most 200 names can be reserved." });
    return names;
  });

export const platformSettingsSchema = z.object({
  platformName: requiredText("Platform name", 60, 2),
  supportEmail: optionalEmail("Support email"),
  defaultCurrency: z
    .string({ error: "Currency is required." })
    .trim()
    .toUpperCase()
    .min(1, "Currency is required.")
    .refine(isSupportedCurrency, "Please select a supported currency."),
  defaultTimezone: z
    .string({ error: "Timezone is required." })
    .trim()
    .min(1, "Timezone is required.")
    .max(64, "Please select a valid timezone.")
    .refine(isValidTimeZone, "Please select a valid timezone."),
  defaultStoreStatus: z.enum(["active", "inactive"], { error: "Choose how new stores start." }),
  reservedSubdomains: reservedList,
});
export type PlatformSettingsInput = z.input<typeof platformSettingsSchema>;
