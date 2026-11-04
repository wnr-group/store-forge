import "server-only";
import { AppError } from "@/lib/errors";
import { getAdminAuthClient } from "@/lib/supabase/admin";

/**
 * Admin Auth API wrappers for provisioned accounts. Callers MUST have authorised the acting user
 * (Platform Admin, or the tenant Owner for their own tenant) before calling anything here.
 *
 * Accounts are created already confirmed (`email_confirm: true`): StoreForge never relies on
 * Supabase e-mail delivery to provision users, and there is no email-verification step.
 * `app_metadata.provisioned` is informational; authorisation never reads user-editable metadata.
 */

export type ProvisionedUser = { id: string; email: string };

type AdminError = { code?: string; status?: number; message?: string } | null;

function mapAdminError(error: NonNullable<AdminError>): AppError {
  if (error.code === "email_exists" || error.code === "user_already_exists" || (error.status === 422 && /already|registered|exists/i.test(error.message ?? "")))
    return new AppError("CONFLICT", "An account with this email already exists.", { email: "Already in use" });
  if (error.code === "weak_password") return new AppError("VALIDATION", "That password is too weak. Try a longer one.", { password: "Too weak" });
  if (error.status === 429) return new AppError("RATE_LIMITED", "Too many attempts. Please wait a moment and try again.");
  console.error("[auth-admin]", error.code ?? error.status, error.message);
  return new AppError("UNKNOWN", "Could not create the account. Please try again.");
}

/** Creates a confirmed e-mail/password account. The profile row is created by the on_auth_user_created trigger. */
export async function createConfirmedUser(input: { email: string; password: string; fullName: string }): Promise<ProvisionedUser> {
  const { data, error } = await getAdminAuthClient().auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.fullName },
    app_metadata: { provisioned: true },
  });
  if (error || !data.user) throw mapAdminError(error ?? { message: "no user returned" });
  return { id: data.user.id, email: data.user.email ?? input.email };
}

/** Admin-assisted password reset: sets a new password. The old one is never read or returned. */
export async function setUserPassword(userId: string, password: string): Promise<void> {
  const { error } = await getAdminAuthClient().auth.admin.updateUserById(userId, { password });
  if (error) throw mapAdminError(error);
}

export async function setUserFullName(userId: string, fullName: string): Promise<void> {
  const { error } = await getAdminAuthClient().auth.admin.updateUserById(userId, { user_metadata: { full_name: fullName } });
  if (error) console.error("[auth-admin] updateUserById(full_name)", error.message);
}

/**
 * Deletes an Auth user (cascades to profile and membership). Used for compensation after a failed
 * provisioning step and when a member's last membership is removed. Failures are logged, never thrown,
 * so a cleanup problem cannot mask the original error.
 */
export async function deleteUserQuietly(userId: string): Promise<boolean> {
  try {
    const { error } = await getAdminAuthClient().auth.admin.deleteUser(userId);
    if (error) {
      console.error("[auth-admin] deleteUser failed - orphaned auth user", userId, error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[auth-admin] deleteUser threw - orphaned auth user", userId, e);
    return false;
  }
}
