"use server";

import { redirect } from "next/navigation";
import { ROUTES } from "@/config/app";
import { toFailure } from "@/lib/errors";
import { safeNextPath } from "@/lib/utils/redirect";
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from "@/lib/validations/auth";
import { parseInput } from "@/lib/validations/parse";
import * as authService from "@/services/auth.service";
import type { ActionResult } from "@/types/action";

// NOTE: redirect() works by throwing, so it is always called OUTSIDE try/catch.

export async function registerAction(input: unknown): Promise<ActionResult<{ email: string }>> {
  let needsEmailVerification: boolean;
  let email: string;
  try {
    const values = parseInput(registerSchema, input);
    email = values.email;
    ({ needsEmailVerification } = await authService.signUp(values));
  } catch (e) {
    return toFailure(e);
  }
  redirect(needsEmailVerification ? `${ROUTES.verifyEmail}?email=${encodeURIComponent(email)}` : ROUTES.dashboard);
}

export async function loginAction(input: unknown, next?: string): Promise<ActionResult> {
  try {
    await authService.signIn(parseInput(loginSchema, input));
  } catch (e) {
    return toFailure(e);
  }
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

export async function forgotPasswordAction(input: unknown): Promise<ActionResult> {
  try {
    const { email } = parseInput(forgotPasswordSchema, input);
    await authService.requestPasswordReset(email);
    return { ok: true };
  } catch (e) {
    return toFailure(e);
  }
}

export async function resetPasswordAction(input: unknown): Promise<ActionResult> {
  try {
    const { password } = parseInput(resetPasswordSchema, input);
    await authService.updatePassword(password);
  } catch (e) {
    return toFailure(e);
  }
  redirect(ROUTES.dashboard);
}
