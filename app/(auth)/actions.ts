"use server";

import { redirect } from "next/navigation";
import { ROUTES } from "@/config/app";
import { defaultHomePath } from "@/lib/auth/home";
import { toFailure } from "@/lib/errors";
import { logEvent } from "@/lib/observability/log";
import { safeNextPath } from "@/lib/utils/redirect";
import { changePasswordSchema, loginSchema } from "@/lib/validations/auth";
import { parseInput } from "@/lib/validations/parse";
import * as authService from "@/services/auth.service";
import type { ActionResult } from "@/types/action";

// NOTE: redirect() works by throwing, so it is always called OUTSIDE try/catch.
// There is intentionally no register / verify-email / forgot-password action: accounts are provisioned.

export async function loginAction(input: unknown, next?: string): Promise<ActionResult> {
  let destination: string;
  try {
    const values = parseInput(loginSchema, input);
    // The API rate limits the attempt itself (same limits as before) before it checks the password.
    // An explicit `next` wins; otherwise the API's answer picks the landing page, so nobody bounces through /dashboard.
    // `/dashboard` is what the proxy puts in `next` for a signed-out visitor, i.e. still "no specific destination".
    const requested = safeNextPath(next, "");
    const target = requested === ROUTES.dashboard ? "" : requested;
    const identity = await authService.signIn(values, !target);
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
