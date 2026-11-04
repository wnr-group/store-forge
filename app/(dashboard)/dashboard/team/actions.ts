"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ROUTES } from "@/config/app";
import { run } from "@/lib/actions/run";
import { resetPasswordSchema } from "@/lib/validations/auth";
import { parseInput } from "@/lib/validations/parse";
import { createMemberSchema, updateMemberSchema } from "@/lib/validations/team";
import { createMember, removeMember, resetMemberPassword, setMemberStatus, updateMember } from "@/services/team.service";

// Tenant scope is NEVER an argument: team.service resolves it from the validated session's Owner
// membership. The browser can only name a member (user id) of its own tenant.

export async function createMemberAction(input: unknown) {
  return run(async () => {
    const result = await createMember(parseInput(createMemberSchema, input));
    revalidatePath(ROUTES.team);
    return { email: result.email };
  });
}

export async function updateMemberAction(input: unknown) {
  return run(async () => {
    await updateMember(parseInput(updateMemberSchema, input));
    revalidatePath(ROUTES.team);
  });
}

export async function setMemberStatusAction(userId: unknown, status: unknown) {
  return run(async () => {
    await setMemberStatus(parseInput(z.uuid(), userId), parseInput(z.enum(["active", "disabled"]), status));
    revalidatePath(ROUTES.team);
  });
}

export async function removeMemberAction(userId: unknown) {
  return run(async () => {
    await removeMember(parseInput(z.uuid(), userId));
    revalidatePath(ROUTES.team);
  });
}

export async function resetMemberPasswordAction(userId: unknown, input: unknown) {
  return run(async () => {
    await resetMemberPassword(parseInput(z.uuid(), userId), parseInput(resetPasswordSchema, input).password);
  });
}
