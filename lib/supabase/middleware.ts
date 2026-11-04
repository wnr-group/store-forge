import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { GUEST_ONLY_ROUTES, PROTECTED_PREFIXES, ROUTES } from "@/config/app";
import { getPublicEnv } from "@/config/env";
import { safeNextPath } from "@/lib/utils/redirect";

const matches = (pathname: string, route: string) => pathname === route || pathname.startsWith(`${route}/`);

/**
 * Used by proxy.ts (Next.js 16's replacement for middleware.ts).
 * Refreshes the Supabase session cookies and performs OPTIMISTIC route gating.
 * This is a UX/latency convenience only: every protected page, action and
 * query re-validates the user server-side, and RLS is the real boundary.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = getPublicEnv();

  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
      },
    },
  });

  // getClaims() verifies the JWT signature (and refreshes an expired session).
  const { data } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(data?.claims?.sub);
  const { pathname, search } = request.nextUrl;

  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    const [p, q] = path.split("?");
    url.pathname = p;
    url.search = q ? `?${q}` : "";
    const redirect = NextResponse.redirect(url);
    // Preserve any refreshed auth cookies on the redirect response.
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  };

  if (!isSignedIn && PROTECTED_PREFIXES.some((p) => matches(pathname, p))) {
    const next = safeNextPath(pathname + search, "");
    return redirectTo(`${ROUTES.login}${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  }

  if (!isSignedIn && matches(pathname, ROUTES.resetPassword)) {
    return redirectTo(`${ROUTES.forgotPassword}?error=expired`);
  }

  if (isSignedIn && GUEST_ONLY_ROUTES.some((r) => matches(pathname, r))) {
    return redirectTo(ROUTES.dashboard);
  }

  return response;
}
