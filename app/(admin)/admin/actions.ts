"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { ROUTES } from "@/config/app";
import { run } from "@/lib/actions/run";
import { companyStatusSchema, createCompanySchema } from "@/lib/validations/company";
import { parseInput } from "@/lib/validations/parse";
import { addPlatformAdminSchema, platformSettingsSchema, setPlatformAdminRoleSchema } from "@/lib/validations/admin-platform";
import { memberStatusSchema, recoverOwnerSchema, transferOwnershipSchema, updateCompanySchema, updateStoreSchema } from "@/lib/validations/admin-org";
import { createMemberSchema } from "@/lib/validations/team";
import {
  addCompanyMember,
  createCompany,
  deleteCompany,
  recoverCompanyOwner,
  removeCompanyMember,
  setCompanyMemberStatus,
  setCompanyStatus,
  transferCompanyOwnership,
  updateCompany,
  updateCompanyStore,
} from "@/services/platform.service";
import { addPlatformAdmin, removePlatformAdmin, setPlatformAdminRole } from "@/services/platform-team.service";
import { BRANDING_TAG, removePlatformLogo, requestPlatformLogoUpload, setPlatformLogo, updatePlatformSettings } from "@/services/platform-settings.service";
import { platformLogoPathSchema, platformLogoUploadSchema } from "@/lib/validations/admin-platform";

// Every action below calls a service function whose first statement authorises the Platform Admin from the validated session,
// before any privileged work. Hiding the UI is never the protection. Each action also:
//   * is rate limited per admin by the StoreForge API (the bucket named in each call below is the API's `rate_limit_admin` bucket), and
//   * is logged as one structured event with its operation name, outcome and duration (never its input).
// The organization id is always validated as a UUID and no role, status or owner id is trusted from the browser beyond what its
// schema allows.

/** The API's per-admin rate-limit buckets (applied by the API on the matching mutating route). */
type AdminRateBucket = "org.create" | "org.delete" | "org.edit" | "team.manage" | "ownership.change" | "admin.manage" | "settings.update";

const guarded = <T>(_bucket: AdminRateBucket, operation: string, fn: () => Promise<T>) => run(fn, { operation });

export async function createCompanyAction(input: unknown) {
  return guarded("org.create", "admin.org.create", async () => {
    const values = parseInput(createCompanySchema, input);
    const result = await createCompany(values);
    revalidatePath(ROUTES.admin, "layout");
    return { tenantId: result.tenantId, publicId: result.publicId, ownerEmail: result.ownerEmail };
  });
}

export async function setCompanyStatusAction(tenantId: unknown, status: unknown) {
  return guarded("org.edit", "admin.org.set_status", async () => {
    await setCompanyStatus(parseInput(z.uuid(), tenantId), parseInput(companyStatusSchema, status));
    revalidatePath(ROUTES.admin, "layout");
  });
}

// Deletion itself is unchanged; it is only rate limited here.
export async function deleteCompanyAction(tenantId: unknown) {
  return guarded("org.delete", "admin.org.delete", async () => {
    await deleteCompany(parseInput(z.uuid(), tenantId));
    revalidatePath(ROUTES.admin, "layout");
  });
}

export async function addCompanyMemberAction(tenantId: unknown, input: unknown) {
  return guarded("team.manage", "admin.team.add_member", async () => {
    const result = await addCompanyMember(parseInput(z.uuid(), tenantId), parseInput(createMemberSchema, input));
    revalidatePath(ROUTES.admin, "layout");
    return { email: result.email };
  });
}

export async function updateCompanyAction(tenantId: unknown, input: unknown) {
  return guarded("org.edit", "admin.org.update", async () => {
    await updateCompany(parseInput(z.uuid(), tenantId), parseInput(updateCompanySchema, input));
    revalidatePath(ROUTES.admin, "layout");
  });
}

export async function updateCompanyStoreAction(tenantId: unknown, input: unknown) {
  return guarded("org.edit", "admin.store.update", async () => {
    await updateCompanyStore(parseInput(z.uuid(), tenantId), parseInput(updateStoreSchema, input));
    revalidatePath(ROUTES.admin, "layout");
  });
}

export async function setCompanyMemberStatusAction(tenantId: unknown, userId: unknown, status: unknown) {
  return guarded("team.manage", "admin.team.set_member_status", async () => {
    await setCompanyMemberStatus(parseInput(z.uuid(), tenantId), parseInput(z.uuid(), userId), parseInput(memberStatusSchema, status));
    revalidatePath(ROUTES.admin, "layout");
  });
}

export async function removeCompanyMemberAction(tenantId: unknown, userId: unknown) {
  return guarded("team.manage", "admin.team.remove_member", async () => {
    await removeCompanyMember(parseInput(z.uuid(), tenantId), parseInput(z.uuid(), userId));
    revalidatePath(ROUTES.admin, "layout");
  });
}

export async function transferCompanyOwnershipAction(tenantId: unknown, input: unknown) {
  return guarded("ownership.change", "admin.ownership.transfer", async () => {
    await transferCompanyOwnership(parseInput(z.uuid(), tenantId), parseInput(transferOwnershipSchema, input));
    revalidatePath(ROUTES.admin, "layout");
  });
}

export async function recoverCompanyOwnerAction(tenantId: unknown, input: unknown) {
  return guarded("ownership.change", "admin.ownership.recover", async () => {
    const result = await recoverCompanyOwner(parseInput(z.uuid(), tenantId), parseInput(recoverOwnerSchema, input));
    revalidatePath(ROUTES.admin, "layout");
    return { email: result.email };
  });
}

// Platform admins and settings. Managing admins and the settings are for super admins only: the service refuses
// anyone else before doing anything, and the SQL functions check again.

export async function addPlatformAdminAction(input: unknown) {
  return guarded("admin.manage", "admin.platform_admin.add", async () => {
    const result = await addPlatformAdmin(parseInput(addPlatformAdminSchema, input));
    revalidatePath(ROUTES.admin, "layout");
    return { email: result.email };
  });
}

export async function setPlatformAdminRoleAction(input: unknown) {
  return guarded("admin.manage", "admin.platform_admin.set_role", async () => {
    const v = parseInput(setPlatformAdminRoleSchema, input);
    await setPlatformAdminRole(v.userId, v.role);
    revalidatePath(ROUTES.admin, "layout");
  });
}

export async function removePlatformAdminAction(userId: unknown) {
  return guarded("admin.manage", "admin.platform_admin.remove", async () => {
    await removePlatformAdmin(parseInput(z.uuid(), userId));
    revalidatePath(ROUTES.admin, "layout");
  });
}

export async function updatePlatformSettingsAction(input: unknown) {
  return guarded("settings.update", "admin.settings.update", async () => {
    await updatePlatformSettings(parseInput(platformSettingsSchema, input));
    updateTag(BRANDING_TAG);
    revalidatePath("/", "layout");
    revalidatePath(ROUTES.admin, "layout");
  });
}

// Platform logo (super admins only). The browser uploads the file itself to the signed link from the first action, then the second
// action makes it the logo; the API re-checks the file, the role and the rate limit.
export async function requestPlatformLogoUploadAction(input: unknown) {
  return guarded("settings.update", "admin.settings.logo_upload_url", async () => requestPlatformLogoUpload(parseInput(platformLogoUploadSchema, input)));
}

export async function setPlatformLogoAction(path: unknown) {
  return guarded("settings.update", "admin.settings.logo_set", async () => {
    await setPlatformLogo(parseInput(platformLogoPathSchema, path));
    updateTag(BRANDING_TAG);
    revalidatePath("/", "layout");
    revalidatePath(ROUTES.admin, "layout");
  });
}

export async function removePlatformLogoAction() {
  return guarded("settings.update", "admin.settings.logo_remove", async () => {
    await removePlatformLogo();
    updateTag(BRANDING_TAG);
    revalidatePath("/", "layout");
    revalidatePath(ROUTES.admin, "layout");
  });
}
