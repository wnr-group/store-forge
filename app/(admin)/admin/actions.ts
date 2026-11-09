"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ROUTES } from "@/config/app";
import { run } from "@/lib/actions/run";
import { companyStatusSchema, createCompanySchema } from "@/lib/validations/company";
import { parseInput } from "@/lib/validations/parse";
import { memberStatusSchema, recoverOwnerSchema, storeStatusSchema, transferOwnershipSchema, updateCompanySchema, updateStoreSchema } from "@/lib/validations/admin-org";
import { createMemberSchema } from "@/lib/validations/team";
import {
  addCompanyMember,
  createCompany,
  deleteCompany,
  recoverCompanyOwner,
  removeCompanyMember,
  setCompanyMemberStatus,
  setCompanyStatus,
  setCompanyStoreStatus,
  transferCompanyOwnership,
  updateCompany,
  updateCompanyStore,
} from "@/services/platform.service";

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

export async function deleteCompanyAction(tenantId: unknown) {
  return run(async () => {
    await deleteCompany(parseInput(z.uuid(), tenantId));
    revalidatePath(ROUTES.admin, "layout");
  });
}

export async function addCompanyMemberAction(tenantId: unknown, input: unknown) {
  return run(async () => {
    const result = await addCompanyMember(parseInput(z.uuid(), tenantId), parseInput(createMemberSchema, input));
    revalidatePath(ROUTES.admin, "layout");
    return { email: result.email };
  });
}

// Phase 2. As above: each service function checks the Platform Admin first; the organization id is always validated
// as a UUID and no role, status or owner id is trusted from the browser beyond what its schema allows.

export async function updateCompanyAction(tenantId: unknown, input: unknown) {
  return run(async () => {
    await updateCompany(parseInput(z.uuid(), tenantId), parseInput(updateCompanySchema, input));
    revalidatePath(ROUTES.admin, "layout");
  });
}

export async function updateCompanyStoreAction(tenantId: unknown, input: unknown) {
  return run(async () => {
    await updateCompanyStore(parseInput(z.uuid(), tenantId), parseInput(updateStoreSchema, input));
    revalidatePath(ROUTES.admin, "layout");
  });
}

export async function setCompanyStoreStatusAction(tenantId: unknown, status: unknown) {
  return run(async () => {
    await setCompanyStoreStatus(parseInput(z.uuid(), tenantId), parseInput(storeStatusSchema, status));
    revalidatePath(ROUTES.admin, "layout");
  });
}

export async function setCompanyMemberStatusAction(tenantId: unknown, userId: unknown, status: unknown) {
  return run(async () => {
    await setCompanyMemberStatus(parseInput(z.uuid(), tenantId), parseInput(z.uuid(), userId), parseInput(memberStatusSchema, status));
    revalidatePath(ROUTES.admin, "layout");
  });
}

export async function removeCompanyMemberAction(tenantId: unknown, userId: unknown) {
  return run(async () => {
    await removeCompanyMember(parseInput(z.uuid(), tenantId), parseInput(z.uuid(), userId));
    revalidatePath(ROUTES.admin, "layout");
  });
}

export async function transferCompanyOwnershipAction(tenantId: unknown, input: unknown) {
  return run(async () => {
    await transferCompanyOwnership(parseInput(z.uuid(), tenantId), parseInput(transferOwnershipSchema, input));
    revalidatePath(ROUTES.admin, "layout");
  });
}

export async function recoverCompanyOwnerAction(tenantId: unknown, input: unknown) {
  return run(async () => {
    const result = await recoverCompanyOwner(parseInput(z.uuid(), tenantId), parseInput(recoverOwnerSchema, input));
    revalidatePath(ROUTES.admin, "layout");
    return { email: result.email };
  });
}
