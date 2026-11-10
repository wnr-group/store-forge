import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicEnv } from "@/config/env";
import { authApiEnabled } from "@/lib/auth/nest-api";

/**
 * Per-request, cookie-backed Supabase client used for AUTHENTICATION ONLY
 * (sign up / in / out, password recovery, getUser()).
 *
 * Application data is read and written through Drizzle inside
 * `withAuthenticatedDb()` (lib/db/tenant-db.ts) - do not use
 * `supabase.from()` / `supabase.rpc()` for ordinary queries.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const env = getPublicEnv();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          // When the API owns the session, whatever this client writes (a metadata update, a token refresh) must keep the
          // cookie hardened: supabase-js defaults to httpOnly:false, which would let page scripts read the tokens again.
          const hardened = authApiEnabled();
          for (const { name, value, options } of cookiesToSet)
            cookieStore.set(
              name,
              value,
              hardened
                ? { ...options, domain: undefined, path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" }
                : options,
            );
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // The proxy refreshes the session, so this is safe to ignore.
        }
      },
    },
  });
}
