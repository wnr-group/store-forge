"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ROUTES } from "@/config/app";
import { AppError, toFailure } from "@/lib/errors";
import { requireTenantAccess, setActiveTenantCookie } from "@/lib/tenant/context";
import { onboardingSchema, storeSlugSchema } from "@/lib/validations/onboarding";
import { parseInput } from "@/lib/validations/parse";
import { createTenantWithStore, isStoreSlugAvailable } from "@/services/tenant.service";
import type { ActionResult } from "@/types/action";

// NOTE: redirect() works by throwing, so it is always called OUTSIDE try/catch.

export async function createWorkspaceAction(input: unknown): Promise<ActionResult> {
  try {
    const values = parseInput(onboardingSchema, input);
    // Identity comes from the validated session inside the service; a missing
    // session surfaces as an UNAUTHENTICATED error.
    const result = await createTenantWithStore(values);
    await setActiveTenantCookie(result.tenant_id);
  } catch (e) {
    return toFailure(e);
  }
  revalidatePath(ROUTES.dashboard, "layout");
  redirect(ROUTES.dashboard);
}

/** Live availability hint for the onboarding form. The SQL function is the authority on submit. */
export async function checkSlugAction(slug: unknown): Promise<{ available: boolean; reason?: string }> {
  const parsed = storeSlugSchema.safeParse(slug);
  if (!parsed.success) return { available: false, reason: parsed.error.issues[0]?.message };
  try {
    return { available: await isStoreSlugAvailable(parsed.data) };
  } catch (e) {
    if (e instanceof AppError) return { available: false, reason: e.message };
    console.error("[checkSlug]", e);
    return { available: false, reason: "Could not check availability" };
  }
}

export async function switchTenantAction(tenantId: unknown): Promise<ActionResult> {
  try {
    const id = parseInput(z.uuid(), tenantId);
    await requireTenantAccess(id); // verified against the DB, not the client
    await setActiveTenantCookie(id);
  } catch (e) {
    return toFailure(e);
  }
  revalidatePath(ROUTES.dashboard, "layout");
  redirect(ROUTES.dashboard);
}
