import { z } from "zod";
import { addressSchema, customerSchema, PHONE_PATTERN, storeSlugSchema } from "@/lib/validations/checkout";

/** Shopper account field rules. They mirror the API's DTOs so a problem shows next to the field; the API checks everything again. */
export const PASSWORD_HINT = "Use at least 8 characters, with a letter and a number.";

export const passwordSchema = z
  .string({ error: "Enter a password." })
  .min(8, PASSWORD_HINT)
  .max(128, "Use at most 128 characters.")
  .regex(/[A-Za-z]/, PASSWORD_HINT)
  .regex(/\d/, PASSWORD_HINT);

const email = customerSchema.shape.email;
const name = customerSchema.shape.fullName;
const optionalPhone = z
  .string()
  .trim()
  .refine((v) => v === "" || PHONE_PATTERN.test(v), "Enter a valid 10-digit Indian mobile number.");

export const registerSchema = z.object({ storeSlug: storeSlugSchema, fullName: name, email, phone: optionalPhone.optional(), password: passwordSchema });

export const loginSchema = z.object({
  storeSlug: storeSlugSchema,
  email,
  password: z.string({ error: "Enter your password." }).min(1, "Enter your password.").max(128),
});

export const profileSchema = z.object({ storeSlug: storeSlugSchema, fullName: name, phone: optionalPhone });

export const changePasswordSchema = z.object({
  storeSlug: storeSlugSchema,
  currentPassword: z.string({ error: "Enter your current password." }).min(1, "Enter your current password.").max(128),
  newPassword: passwordSchema,
});

export const savedAddressSchema = addressSchema.extend({
  label: z.string().trim().max(40, "The label is too long.").optional(),
  isDefault: z.boolean().optional(),
});

export const storeOnly = z.object({ storeSlug: storeSlugSchema });
