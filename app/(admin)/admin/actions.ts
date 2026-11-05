"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ROUTES } from "@/config/app";
import { run } from "@/lib/actions/run";
import { resetPasswordSchema } from "@/lib/validations/auth";
import { companyStatusSchema, createCompanySchema } from "@/lib/validations/company";
import { parseInput } from "@/lib/validations/parse";
import { createCompany, resetOwnerPassword, setCompanyStatus } from "@/services/platform.service";

// Every action below calls a platform.service function whose first statement is requirePlatformAdmin():
// the admin check happens on the server, from the validated session, before any privileged work.
// Hiding the UI is never the protection.

export async function createCompanyAction(input: unknown) {
  return run(async () => {
    const values = parseInput(createCompanySchema, input);
    const result = await createCompany(values);
    revalidatePath(ROUTES.admin, "layout");
    return { tenantId: result.tenantId, ownerEmail: result.ownerEmail };
  });
}

export async function setCompanyStatusAction(tenantId: unknown, status: unknown) {
  return run(async () => {
    await setCompanyStatus(parseInput(z.uuid(), tenantId), parseInput(companyStatusSchema, status));
    revalidatePath(ROUTES.admin, "layout");
  });
}

export async function resetOwnerPasswordAction(tenantId: unknown, input: unknown) {
  return run(async () => {
    await resetOwnerPassword(parseInput(z.uuid(), tenantId), parseInput(resetPasswordSchema, input).password);
  });
}
