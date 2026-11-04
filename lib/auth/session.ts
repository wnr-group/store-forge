import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { ROUTES } from "@/config/app";
import { createClient } from "@/lib/supabase/server";

/**
 * The authenticated user, validated by the Supabase Auth server (getUser()),
 * NOT read from the unverified cookie session. Memoised per request.
 */
export const getCurrentUser = cache(async () => {
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
