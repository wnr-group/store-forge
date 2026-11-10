import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { GUEST_ONLY_ROUTES, PROTECTED_PREFIXES, ROUTES } from "@/config/app";
import { getPublicEnv } from "@/config/env";
import { applySetCookies, authApi, authApiEnabled, isSessionCookieName, readStoredSession, SIGNED_IN_MARKER, unverifiedExpiry } from "@/lib/auth/nest-api";
import { safeNextPath } from "@/lib/utils/redirect";

/** `request.cookies` only takes (name, value): the cookie attributes matter for the browser response, not for this request. */
const requestSink = (request: NextRequest) => ({
  set: (name: string, value: string) => void request.cookies.set(name, value),
  delete: (name: string) => void request.cookies.delete(name),
});

const matches = (pathname: string, route: string) => pathname === route || pathname.startsWith(`${route}/`);

/** Refresh a little before the access token really expires, so the page that follows never sees an expired one. */
const REFRESH_MARGIN_SECONDS = 60;

/**
 * Used by proxy.ts (Next.js 16's replacement for middleware.ts).
 * Refreshes the Supabase session cookies and performs OPTIMISTIC route gating.
 * This is a UX/latency convenience only: every protected page, action and
 * query re-validates the user server-side, and RLS is the real boundary.
 *
 * With `AUTH_API_URL` set the StoreForge API does the refreshing (POST /auth/refresh, which rotates the refresh token);
 * otherwise this talks to Supabase directly, as before.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  let isSignedIn: boolean;

  if (authApiEnabled()) {
    ({ response, isSignedIn } = await sessionViaApi(request, response));
  } else {
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
    isSignedIn = Boolean(data?.claims?.sub);
  }

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

  if (isSignedIn && GUEST_ONLY_ROUTES.some((r) => matches(pathname, r))) {
    return redirectTo(ROUTES.dashboard);
  }

  return response;
}

/**
 * API mode. Decides from the session cookie WITHOUT verifying it (this is only optimistic gating; pages verify through
 * the API): a session whose access token is still valid needs no network call at all, so navigation stays as fast as
 * before. An expired one is refreshed through the API, and the new cookies are applied to this request (so the page
 * that renders next already sees them) and to the response (so the browser stores them).
 */
async function sessionViaApi(request: NextRequest, response: NextResponse): Promise<{ response: NextResponse; isSignedIn: boolean }> {
  const session = await readStoredSession(request.cookies);
  if (!session) return { response, isSignedIn: false };

  const expiry = session.expiresAt ?? unverifiedExpiry(session.accessToken);
  const fresh = expiry !== null && expiry - Math.floor(Date.now() / 1000) > REFRESH_MARGIN_SECONDS;
  if (fresh) return { response, isSignedIn: true };
  if (!session.refreshToken) return { response: clearSession(request, response), isSignedIn: false };

  let result;
  try {
    result = await authApi("/auth/refresh", { method: "POST", cookieHeader: request.headers.get("cookie"), clientIp: clientIp(request) });
  } catch {
    // The API is unreachable: keep the cookies (the outage may be short) but do not pretend to be signed in.
    return { response, isSignedIn: false };
  }
  if (result.ok) {
    applySetCookies(requestSink(request), result.setCookies);
    response = NextResponse.next({ request });
    applySetCookies(response.cookies, result.setCookies);
    return { response, isSignedIn: true };
  }
  if (result.status === 401) {
    // The refresh token is used up or revoked: the session is over.
    applySetCookies(requestSink(request), result.setCookies);
    response = NextResponse.next({ request });
    applySetCookies(response.cookies, result.setCookies);
    return { response: clearSession(request, response), isSignedIn: false };
  }
  return { response, isSignedIn: false };
}

function clearSession(request: NextRequest, response: NextResponse): NextResponse {
  const names = request.cookies.getAll().map((c) => c.name).filter((n) => isSessionCookieName(n) || n === SIGNED_IN_MARKER);
  for (const name of names) {
    request.cookies.delete(name);
    response.cookies.delete(name);
  }
  return response;
}

function clientIp(request: NextRequest): string | undefined {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || undefined;
}
