import "server-only";
import type { AuthError } from "@supabase/supabase-js";
import { ROUTES } from "@/config/app";
import { getPublicEnv } from "@/config/env";
import { AppError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import type { LoginInput, RegisterInput } from "@/lib/validations/auth";

function callbackUrl(next: string) {
  return `${getPublicEnv().NEXT_PUBLIC_APP_URL}${ROUTES.authCallback}?next=${encodeURIComponent(next)}`;
}

function mapAuthError(error: AuthError): AppError {
  if (error.status === 429 || error.code === "over_request_rate_limit" || error.code === "over_email_send_rate_limit")
    return new AppError("RATE_LIMITED", "Too many attempts. Please wait a moment and try again.");
  if (error.code === "weak_password") return new AppError("VALIDATION", "That password is too weak. Try a longer one.");
  if (error.code === "email_not_confirmed")
    return new AppError("UNAUTHENTICATED", "Please verify your email address first. Check your inbox for the link.");
  if (error.code === "same_password")
    return new AppError("VALIDATION", "Choose a password different from your current one.");
  throw error; // unexpected -> logged + generic message
}

export async function signUp(input: RegisterInput) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: { full_name: input.fullName },
      emailRedirectTo: callbackUrl(ROUTES.dashboard),
    },
  });
  if (error) {
    if (error.code === "user_already_exists")
      throw new AppError("CONFLICT", "An account with this email already exists. Try signing in.", { email: "Already registered" });
    throw mapAuthError(error);
  }
  // With email confirmation on, Supabase answers an already-registered address
  // with an obfuscated user that has no identities instead of an error.
  if (data.user && (data.user.identities?.length ?? 0) === 0)
    throw new AppError("CONFLICT", "An account with this email already exists. Try signing in.", { email: "Already registered" });

  return { needsEmailVerification: !data.session };
}

export async function signIn(input: LoginInput) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: input.email, password: input.password });
  if (error) {
    if (error.code === "invalid_credentials")
      throw new AppError("UNAUTHENTICATED", "Incorrect email or password.");
    throw mapAuthError(error);
  }
}

export async function signOut() {
  const supabase = await createClient();
  // Revokes the session server-side and clears the auth cookies.
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/** Always resolves the same way regardless of whether the email exists (no account enumeration). */
export async function requestPasswordReset(email: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: callbackUrl(ROUTES.resetPassword),
  });
  if (error && (error.status === 429 || error.code?.startsWith("over_")))
    throw mapAuthError(error);
  if (error) console.error("[resetPasswordForEmail]", error);
}

export async function updatePassword(password: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === "session_not_found" || error.status === 401)
      throw new AppError("UNAUTHENTICATED", "Your reset link has expired. Request a new one.");
    throw mapAuthError(error);
  }
}
