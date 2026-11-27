"use server";

import { redirect } from "next/navigation";
import { ROUTES } from "@/config/app";
import { defaultHomePath } from "@/lib/auth/home";
import { onboardingPath, planChoiceFrom } from "@/lib/onboarding/path";
import { toFailure } from "@/lib/errors";
import { logEvent } from "@/lib/observability/log";
import { AppError } from "@/lib/errors";
import { getActiveStore, getActiveTenant } from "@/lib/tenant/context";
import { storefrontHost } from "@/lib/tenant/host";
import { isMainHostRequest, isStoreHostRequest } from "@/lib/tenant/request";
import { safeNextPath } from "@/lib/utils/redirect";
import { changePasswordSchema, loginSchema, registerSchema } from "@/lib/validations/auth";
import { parseInput } from "@/lib/validations/parse";
import * as authService from "@/services/auth.service";
import type { ActionResult } from "@/types/action";

// NOTE: redirect() works by throwing, so it is always called OUTSIDE try/catch.
// There is intentionally no verify-email / forgot-password action: accounts need no e-mail verification in this version.

/** The host of the signed-in person's own store (from their memberships), for the message above; null when it cannot be worked out. */
async function ownStoreHost(): Promise<string | null> {
  try {
    const [active, store] = await Promise.all([getActiveTenant(), getActiveStore()]);
    return active && store ? storefrontHost(store.slug, process.env.NEXT_PUBLIC_ROOT_DOMAIN, active.tenant.publicId) : null;
  } catch {
    return null;
  }
}

export async function loginAction(input: unknown, next?: string): Promise<ActionResult> {
  let destination: string;
  try {
    const values = parseInput(loginSchema, input);
    // The API rate limits the attempt itself (same limits as before) before it checks the password.
    // An explicit `next` wins; otherwise the API's answer picks the landing page, so nobody bounces through /dashboard.
    // `/dashboard` is what the proxy puts in `next` for a signed-out visitor, i.e. still "no specific destination".
    const requested = safeNextPath(next, "");
    const target = requested === ROUTES.dashboard ? "" : requested;
    // Both kinds of host judge who is signing in, so the account's kind is needed.
    const onStoreHost = await isStoreHostRequest();
    const onMainHost = await isMainHostRequest();
    const identity = await authService.signIn(values, !target || onStoreHost || onMainHost);
    // The main site's sign-in is for platform administrators (and for a new customer with no store yet, who resumes onboarding). Someone who
    // already belongs to a store has no workspace here: their dashboard is on their own store host, so say where it is.
    if (onMainHost && identity && identity.platformAdminLevel === null && identity.membershipCount > 0) {
      const where = await ownStoreHost();
      await authService.signOut();
      throw new AppError("FORBIDDEN", `You have no workspace on the main site, which is for platform administrators. ${where ? `Sign in at your store's own address: ${where}/login.` : "Sign in at your store's own address."}`);
    }
    // A store host admits only members of that store. Anyone else (another store's owner, a platform admin, an account with no store) gets
    // no session here: the one just made is ended, and the person is told where they do belong.
    if (onStoreHost && !(await getActiveTenant())) {
      await authService.signOut();
      throw new AppError(
        "FORBIDDEN",
        identity?.platformAdminLevel
          ? "This is a store sign-in, and platform administrator accounts sign in on the main site. Go to the main site to sign in."
          : "You do not belong to this workspace. Sign in with an account that is a member of this store, or use the address of your own store.",
      );
    }
    destination = target || defaultHomePath(identity);
  } catch (e) {
    const failure = toFailure(e);
    // The outcome only: never the e-mail address or the password.
    logEvent("warn", "login", { outcome: "failed", code: failure.code });
    return failure;
  }
  logEvent("info", "login", { outcome: "ok" });
  redirect(destination);
}

/**
 * Creates the visitor's own account, signs them in (no e-mail verification) and continues to the onboarding with the plan they picked.
 * Creates no organization and gives no role: those follow a verified payment and the store step.
 */
export async function registerAction(input: unknown, plan?: { planCode?: string; billingInterval?: string }): Promise<ActionResult> {
  let destination: string;
  try {
    const values = parseInput(registerSchema, input);
    await authService.register(values);
    destination = onboardingPath(planChoiceFrom(plan?.planCode, plan?.billingInterval));
  } catch (e) {
    const failure = toFailure(e);
    // The outcome only: never the e-mail address, the name or the password.
    logEvent("warn", "register", { outcome: "failed", code: failure.code });
    return failure;
  }
  logEvent("info", "register", { outcome: "ok" });
  redirect(destination);
}

/** Signs out without redirecting: the sign-out buttons follow it with a full page load (see components/auth/sign-out-button.tsx). */
export async function signOutAction(): Promise<void> {
  try {
    await authService.signOut();
  } catch (e) {
    console.error("[logout]", e);
  }
}

export async function logoutAction(): Promise<void> {
  try {
    await authService.signOut();
  } catch (e) {
    console.error("[logout]", e);
  }
  redirect(ROUTES.login);
}

/** Self-service password change (also the "change your initial password" step after first login). */
export async function changePasswordAction(input: unknown): Promise<ActionResult> {
  try {
    const { currentPassword, password } = parseInput(changePasswordSchema, input);
    await authService.changePassword(currentPassword, password);
    return { ok: true };
  } catch (e) {
    return toFailure(e);
  }
}
