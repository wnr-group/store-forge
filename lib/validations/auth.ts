import { z } from "zod";

// Normalise first, then validate, so stray whitespace/case never causes a false "invalid email".
const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email("Enter a valid email address"));

// Upper bound of 72 matches bcrypt's effective limit used by Supabase Auth.
// Shared by every flow that sets a password: initial passwords for provisioned accounts,
// admin-assisted resets and self-service password changes.
export const passwordField = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Use at most 72 characters")
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/[0-9]/, "Include at least one number");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password").max(72),
});

/**
 * Self-service account creation. The same password rule as everywhere else; the confirmation and the Terms are checked again by the
 * API, so this only gives the person quick feedback.
 */
export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your full name").max(80, "Use at most 80 characters"),
    email,
    password: passwordField,
    confirmPassword: z.string().max(72),
    acceptTerms: z.boolean().refine((accepted) => accepted, "Accept the Terms and Conditions to continue"),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });

/** Self-service change (first login or any time). The current password is re-verified server-side. */
export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1, "Enter your current password").max(72), password: passwordField, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  })
  .refine((v) => v.password !== v.currentPassword, {
    path: ["password"],
    message: "Choose a password different from your current one",
  });

/** Admin-assisted reset: a Platform Admin (for an Owner) or an Owner (for a member) sets a new password. */
export const resetPasswordSchema = z.object({ password: passwordField });

export type LoginInput = z.input<typeof loginSchema>;
export type RegisterInput = z.input<typeof registerSchema>;
export type ChangePasswordInput = z.input<typeof changePasswordSchema>;
export type ResetPasswordInput = z.input<typeof resetPasswordSchema>;
