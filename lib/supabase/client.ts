import { createBrowserClient } from "@supabase/ssr";
import { getPublicEnv } from "@/config/env";

/** Browser client (anon key only). Subject to RLS like every other user-scoped client. */
export function createClient() {
  const env = getPublicEnv();
  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
