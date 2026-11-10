"use server";

import { redirect } from "next/navigation";
import { ROUTES } from "@/config/app";
import { toFailure } from "@/lib/errors";
import { logEvent } from "@/lib/observability/log";
import { enforceLoginRateLimit } from "@/lib/security/rate-limit";
import { safeNextPath } from "@/lib/utils/redirect";
import { changePasswordSchema, loginSchema } from "@/lib/validations/auth";
import { parseInput } from "@/lib/validations/parse";
import * as authService from "@/services/auth.service";
import type { ActionResult } from "@/types/action";

// NOTE: redirect() works by throwing, so it is always called OUTSIDE try/catch.
// There is intentionally no register / verify-email / forgot-password action: accounts are provisioned.

export async function loginAction(input: unknown, next?: string): Promise<ActionResult> {
  try {
    const values = parseInput(loginSchema, input);
    await enforceLoginRateLimit(values.email); // before the password is checked: too many attempts from one place are refused
    await authService.signIn(values);
  } catch (e) {
    const failure = toFailure(e);
    // The outcome only: never the e-mail address or the password.
    logEvent("warn", "login", { outcome: "failed", code: failure.code });
    return failure;
  }
  logEvent("info", "login", { outcome: "ok" });
  redirect(safeNextPath(next));
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
