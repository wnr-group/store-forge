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
