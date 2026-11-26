"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ROUTES } from "@/config/app";
import { toFailure } from "@/lib/errors";
import { requireTenantAccess, setActiveTenantCookie } from "@/lib/tenant/context";
import { parseInput } from "@/lib/validations/parse";
import type { ActionResult } from "@/types/action";

// NOTE: redirect() works by throwing, so it is always called OUTSIDE try/catch.
// Workspaces are created by a Platform Admin (see app/(admin)) or by a customer who has paid for a plan (see app/(auth)/onboarding).

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
