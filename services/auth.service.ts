import "server-only";
import { cookies } from "next/headers";
import { applySetCookies, authApi, isSessionCookieName, readStoredSession, SIGNED_IN_MARKER } from "@/lib/auth/nest-api";
import { identityFromLogin, type SignInIdentity } from "@/lib/auth/home";
import { AppError } from "@/lib/errors";
import { logEvent } from "@/lib/observability/log";
import { requestAddress } from "@/lib/security/request-address";
import type { LoginInput, RegisterInput } from "@/lib/validations/auth";

/**
 * Sign-in / sign-out / password change, and self-service account creation. Accounts are also provisioned by a Platform Admin or a
 * company Owner (by the StoreForge API), who reset their passwords (admin-assisted). There is deliberately no e-mail verification or
 * e-mail based recovery in this version.
 *
 * Everything goes through the StoreForge API (NestJS): it checks the credentials with Supabase Auth, rate limits the attempt
 * and returns the session as HttpOnly cookies, which are relayed to the browser from here.
 */

// ---------------------------------------------------------------------------------------------------------------------
// StoreForge API
// ---------------------------------------------------------------------------------------------------------------------

type ApiError = { code?: string; details?: unknown };

/** Maps the API's error envelope to the same AppErrors (and wording) the direct-to-Supabase path produces. */
function mapApiFailure(status: number, message: string | undefined, error: ApiError | undefined): never {
  const code = error?.code;
  if (code === "INVALID_CREDENTIALS") throw new AppError("UNAUTHENTICATED", "Incorrect email or password.");
  if (code === "EMAIL_TAKEN") throw new AppError("CONFLICT", "An account with this email already exists. Sign in instead.", { email: "Already in use" });
  if (code === "WEAK_PASSWORD") throw new AppError("VALIDATION", "That password is too weak. Try a longer one.", { password: "Too weak" });
  if (code === "REGISTERED_SIGN_IN_FAILED")
    throw new AppError("UNKNOWN", message || "Your account was created, but we could not sign you in. Please sign in with your email and password.", undefined, code);
  if (code === "ACCOUNT_NOT_ACTIVE") throw new AppError("UNAUTHENTICATED", "This account is not active yet. Please contact your administrator.");
  if (status === 429 || code === "LOGIN_RATE_LIMITED" || code === "RATE_LIMITED")
    throw new AppError("RATE_LIMITED", message || "Too many attempts. Please wait a moment and try again.");
  if (code === "CURRENT_PASSWORD_INCORRECT")
    throw new AppError("VALIDATION", "Your current password is incorrect.", { currentPassword: "Incorrect password" });
  if (code === "VALIDATION_ERROR" && error?.details && !Array.isArray(error.details))
    throw new AppError("VALIDATION", message || "Please check the details you entered.", error.details as Record<string, string>);
  if (code === "VALIDATION_ERROR") throw new AppError("VALIDATION", message || "Please check the details you entered.");
  if (status === 401) throw new AppError("UNAUTHENTICATED", "Your session has expired. Please sign in again.");
  logEvent("error", "auth_api_unexpected", { status, code });
  throw new Error(`auth api answered ${status}`); // unexpected -> logged + generic message
}

async function signInViaApi(input: LoginInput, needsIdentity: boolean): Promise<SignInIdentity | null> {
  // The profile costs the API a database transaction, so it is only requested when the caller must pick a destination.
  const json = { email: input.email, password: input.password, includeProfile: needsIdentity };
  const result = await authApi("/auth/login", { method: "POST", json, clientIp: await requestAddress() });
  if (!result.ok) mapApiFailure(result.status, result.body?.message, result.body?.error);
  applySetCookies(await cookies(), result.setCookies);
  return needsIdentity ? identityFromLogin(result.body?.data) : null;
}

/** Creates the account and signs it in: the API answers with the same session cookies as a sign-in, which are relayed to the browser. */
async function registerViaApi(input: RegisterInput) {
  const json = { ...input, includeProfile: false };
  const result = await authApi("/auth/register", { method: "POST", json, clientIp: await requestAddress() });
  if (!result.ok) mapApiFailure(result.status, result.body?.message, result.body?.error);
  applySetCookies(await cookies(), result.setCookies);
}

async function signOutViaApi() {
  const store = await cookies();
  try {
    const result = await authApi("/auth/logout", { method: "POST", cookieHeader: store.toString(), clientIp: await requestAddress() });
    applySetCookies(store, result.setCookies);
  } finally {
    // Whatever the API said, this browser ends up signed out.
    for (const { name } of store.getAll()) if (isSessionCookieName(name) || name === SIGNED_IN_MARKER) store.delete(name);
  }
}

async function changePasswordViaApi(currentPassword: string, newPassword: string) {
  const session = await readStoredSession(await cookies());
  if (!session) throw new AppError("UNAUTHENTICATED", "Your session has expired. Please sign in again.");
  const result = await authApi("/auth/change-password", {
    method: "POST",
    bearer: session.accessToken,
    json: { currentPassword, password: newPassword, confirmPassword: newPassword },
    clientIp: await requestAddress(),
  });
  if (!result.ok) mapApiFailure(result.status, result.body?.message, result.body?.error);
}

// ---------------------------------------------------------------------------------------------------------------------

/** `needsIdentity`: the caller has no destination yet, so also return who signed in (for `defaultHomePath`). */
export async function signIn(input: LoginInput, needsIdentity = false) {
  return signInViaApi(input, needsIdentity);
}

/** Creates the visitor's own account and signs them in. Creates nothing else: no organization, no role (those follow a paid plan). */
export async function register(input: RegisterInput) {
  return registerViaApi(input);
}

export async function signOut() {
  return signOutViaApi();
}

/**
 * Changes the signed-in user's own password. The current password is re-verified first, so a hijacked
 * session alone cannot lock the real user out. Existing passwords are never readable or returned.
 */
export async function changePassword(currentPassword: string, newPassword: string) {
  return changePasswordViaApi(currentPassword, newPassword);
}
