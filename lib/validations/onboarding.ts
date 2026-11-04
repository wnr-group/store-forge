import { z } from "zod";
import { RESERVED_SLUGS } from "@/config/app";

export const storeSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Use at least 3 characters")
  .max(40, "Use at most 40 characters")
  .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, "Use lowercase letters, numbers and hyphens only")
  .refine((s) => !s.includes("--"), "Avoid consecutive hyphens")
  .refine((s) => !(RESERVED_SLUGS as readonly string[]).includes(s), "This name is reserved");

export const onboardingSchema = z.object({
  businessName: z.string().trim().min(2, "Enter your business name").max(80),
  storeName: z.string().trim().min(2, "Enter a store name").max(80),
  storeSlug: storeSlugSchema,
  description: z
    .string()
    .trim()
    .max(500, "Keep it under 500 characters")
    .optional()
    .transform((v) => (v ? v : undefined)),
});

export type OnboardingInput = z.input<typeof onboardingSchema>;
export type OnboardingValues = z.output<typeof onboardingSchema>;
