"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ROUTES } from "@/config/app";
import { run } from "@/lib/actions/run";
import { toFailure } from "@/lib/errors";
import { logEvent } from "@/lib/observability/log";
import { requireTenantAccess, setActiveTenantCookie } from "@/lib/tenant/context";
import { storeDashboardUrl } from "@/lib/tenant/open-store";
import { verifyPaymentSchema } from "@/lib/validations/billing";
import { checkoutSchema, storeNameSchema } from "@/lib/validations/onboarding";
import { parseInput } from "@/lib/validations/parse";
import { createStore, startCheckout, verifyCheckout } from "@/services/onboarding.service";
import type { ActionResult } from "@/types/action";

// The person is always the signed-in one and the API works out the price: neither is ever an argument.
// NOTE: redirect() works by throwing, so it is always called OUTSIDE try/catch.

/** Starts (or resumes) paying for a plan. Returns only what Razorpay Checkout needs (the public key id, never a secret). */
export async function startCheckoutAction(input: unknown) {
  return run(() => startCheckout(parseInput(checkoutSchema, input)), { operation: "onboarding.checkout.start" });
}

/** Sends Razorpay's success values to the API. The plan only counts as paid when the API says so, never because the browser did. */
export async function verifyCheckoutAction(input: unknown) {
  return run(() => verifyCheckout(parseInput(verifyPaymentSchema, input)), { operation: "onboarding.checkout.verify" });
}

/**
 * Creates the store, then opens its dashboard on the store's OWN host (<store>-<id>.<root>/dashboard), signed in, never on the main domain.
 * Only works once the API has confirmed the payment.
 */
export async function createStoreAction(input: unknown): Promise<ActionResult> {
  let destination: string = ROUTES.dashboard;
  try {
    const { storeName } = parseInput(storeNameSchema, input);
    const store = await createStore({ storeName });
    // The new organization is the person's own (they are its Owner): confirm that with the API before remembering it as the active one.
    await requireTenantAccess(store.tenantId);
    await setActiveTenantCookie(store.tenantId);
    // Without a configured root domain there are no store hosts: the dashboard stays on this host.
    destination = (await storeDashboardUrl({ slug: store.storeSlug, publicId: store.publicId })) ?? ROUTES.dashboard;
    logEvent("info", "action", { operation: "onboarding.store.create", outcome: "ok" });
  } catch (e) {
    const failure = toFailure(e);
    logEvent("warn", "action", { operation: "onboarding.store.create", outcome: "failed", code: failure.code });
    return failure;
  }
  revalidatePath(ROUTES.dashboard, "layout");
  redirect(destination);
}
