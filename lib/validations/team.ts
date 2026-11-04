import { z } from "zod";
import { ASSIGNABLE_ROLES } from "@/lib/auth/permissions";
import { passwordField } from "./auth";
import { emailField, requiredText } from "./fields";

/** Only the two team roles are accepted: `owner` (and anything else) fails validation here and again in RLS. */
const teamRole = z.enum(ASSIGNABLE_ROLES, { error: "Choose Manager or Staff." });

export const createMemberSchema = z.object({
  fullName: requiredText("Member name", 120, 2),
  email: emailField("Member email"),
  password: passwordField,
  role: teamRole,
});

export const updateMemberSchema = z.object({
  userId: z.uuid(),
  fullName: requiredText("Member name", 120, 2),
  role: teamRole,
});

export type CreateMemberInput = z.input<typeof createMemberSchema>;
export type UpdateMemberInput = z.input<typeof updateMemberSchema>;
