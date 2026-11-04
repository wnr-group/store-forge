import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPublicEnv, getServiceRoleKey } from "@/config/env";

/**
 * The ONLY place the Supabase service-role key is read.
 *
 * `server-only` makes the build fail if this module is ever imported from client code. The client
 * has no session persistence and is used exclusively for `auth.admin.*` calls, through
 * lib/auth/provisioning.ts. Do not use it for database queries, Storage or `supabase.from()`:
 * service_role bypasses RLS. All data access goes through Drizzle as `storeforge_app`.
 */
let cached: SupabaseClient | undefined;

export function getAdminAuthClient(): SupabaseClient {
  cached ??= createClient(getPublicEnv().NEXT_PUBLIC_SUPABASE_URL, getServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  return cached;
}
