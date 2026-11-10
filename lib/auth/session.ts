import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ROUTES } from "@/config/app";
import { authApi, authApiEnabled, readStoredSession } from "@/lib/auth/nest-api";
import { logEvent } from "@/lib/observability/log";
import { createClient } from "@/lib/supabase/server";

/** What the app needs to know about the signed-in user. A Supabase `User` satisfies it, so both modes return the same shape. */
export type SessionUser = { id: string; email?: string; user_metadata: { full_name?: string } };

/**
 * With the StoreForge API configured: the access token in the HttpOnly session cookie is verified by the API against
 * Supabase's signing keys (GET /auth/session). Nothing here trusts the cookie's content by itself.
 */
async function currentUserFromApi(): Promise<SessionUser | null> {
  const session = await readStoredSession(await cookies());
  if (!session) return null;
  try {
    const result = await authApi<{ user: { id: string; email: string | null; fullName?: string | null } }>("/auth/session", {
      bearer: session.accessToken,
    });
    const user = result.ok ? result.body?.data?.user : null;
    if (!user) return null; // expired / revoked / invalid: the proxy refreshes expired sessions before pages render
    return { id: user.id, email: user.email ?? undefined, user_metadata: { full_name: user.fullName ?? undefined } };
  } catch (error) {
    logEvent("error", "session_check_failed", { error: error instanceof Error ? error.name : "unknown" });
    return null;
  }
}

/**
 * The authenticated user, validated server-side, NOT read from the unverified cookie session. Memoised per request.
 * Through the StoreForge API when `AUTH_API_URL` is set, otherwise by the Supabase Auth server (`getUser()`).
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  if (authApiEnabled()) return currentUserFromApi();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
});

/** For pages/actions: redirects to login (e.g. on an expired session). */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect(ROUTES.login);
  return user;
}
