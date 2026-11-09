import { z } from "zod";
import { RESERVED_SLUGS } from "@/config/app";
import { passwordField } from "./auth";
import { emailField, optionalPhone, optionalText, requiredText } from "./fields";

export const storeSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Use at least 3 characters")
  .max(40, "Use at most 40 characters")
  .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, "Use lowercase letters, numbers and hyphens only")
  .refine((s) => !s.includes("--"), "Avoid consecutive hyphens")
  .refine((s) => !(RESERVED_SLUGS as readonly string[]).includes(s), "This name is reserved");

/**
 * Platform Admin -> "Create organization". Everything is re-validated on the server; the browser
 * never supplies a role, tenant id or user id (the Owner role is fixed by the provisioning function).
 */
export const createCompanySchema = z.object({
  companyName: requiredText("Organization name", 80, 2),
  storeName: requiredText("Store name", 80, 2),
  storeSlug: storeSlugSchema,
  storeDescription: optionalText("Store description", 500),
  contactPhone: optionalPhone,
  address: optionalText("Address", 300),
  ownerName: requiredText("Owner name", 120, 2),
  ownerEmail: emailField("Owner email"),
  ownerPassword: passwordField,
});

export type CreateCompanyInput = z.input<typeof createCompanySchema>;
export type CreateCompanyValues = z.output<typeof createCompanySchema>;

export const companyStatusSchema = z.enum(["active", "suspended"]);
