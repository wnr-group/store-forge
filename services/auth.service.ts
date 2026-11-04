import "server-only";
import type { AuthError } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import type { LoginInput } from "@/lib/validations/auth";

/**
 * Sign-in / sign-out / password change for PROVISIONED accounts. There is deliberately no sign-up,
 * e-mail verification or e-mail based recovery here: accounts are created by a Platform Admin or a
 * company Owner (lib/auth/provisioning.ts) and passwords are reset by them (admin-assisted).
 */

function mapAuthError(error: AuthError): AppError {
  if (error.status === 429 || error.code === "over_request_rate_limit")
    return new AppError("RATE_LIMITED", "Too many attempts. Please wait a moment and try again.");
  if (error.code === "weak_password") return new AppError("VALIDATION", "That password is too weak. Try a longer one.");
  if (error.code === "same_password")
    return new AppError("VALIDATION", "Choose a password different from your current one.");
  throw error; // unexpected -> logged + generic message
}

export async function signIn(input: LoginInput) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: input.email, password: input.password });
  if (error) {
    if (error.code === "invalid_credentials")
      throw new AppError("UNAUTHENTICATED", "Incorrect email or password.");
    // Provisioned accounts are created confirmed; this only happens if one was created some other way.
    if (error.code === "email_not_confirmed")
      throw new AppError("UNAUTHENTICATED", "This account is not active yet. Please contact your administrator.");
    throw mapAuthError(error);
  }
}

export async function signOut() {
  const supabase = await createClient();
  // Revokes the session server-side and clears the auth cookies.
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Changes the signed-in user's own password. The current password is re-verified first, so a hijacked
 * session alone cannot lock the real user out. Existing passwords are never readable or returned.
 */
export async function changePassword(currentPassword: string, newPassword: string) {
  const user = await getCurrentUser();
  if (!user?.email) throw new AppError("UNAUTHENTICATED", "Your session has expired. Please sign in again.");

  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
  if (verifyError) {
    if (verifyError.code === "invalid_credentials")
      throw new AppError("VALIDATION", "Your current password is incorrect.", { currentPassword: "Incorrect password" });
    throw mapAuthError(verifyError);
  }
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw mapAuthError(error);
}
