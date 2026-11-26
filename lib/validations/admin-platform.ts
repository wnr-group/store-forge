import { z } from "zod";
import { PLATFORM_ADMIN_ROLES } from "@/lib/domain/enums";
import { passwordField } from "./auth";
import { emailField, isSupportedCurrency, isValidTimeZone, optionalEmail, requiredText } from "./fields";

/** Platform Admin management and platform settings. Everything is re-validated by the server action and again in SQL. */

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
});
export type PlatformSettingsInput = z.input<typeof platformSettingsSchema>;

/** The platform logo: a small JPEG, PNG or WebP image. The API checks the real file in Storage again. */
export const PLATFORM_LOGO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const PLATFORM_LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const platformLogoUploadSchema = z.object({
  type: z.enum(PLATFORM_LOGO_TYPES, { error: "The logo must be a JPEG, PNG or WebP image." }),
  size: z.number().int().positive().max(PLATFORM_LOGO_MAX_BYTES, "The logo must be 2 MB or smaller."),
});
export const platformLogoPathSchema = z.string().regex(/^logo\/[A-Za-z0-9._-]{1,120}$/, "Invalid logo path.");
