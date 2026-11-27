import { NextResponse, type NextRequest } from "next/server";
import { ROUTES } from "@/config/app";
import { applySetCookies } from "@/lib/auth/nest-api";
import { logEvent } from "@/lib/observability/log";
import { storeSlugFromHost } from "@/lib/tenant/host";
import { browserOrigin } from "@/lib/tenant/request-origin";
import { exchangeStoreHandoff } from "@/services/auth.service";

export const dynamic = "force-dynamic";

/**
 * A store host's end of the sign-in handoff. The main site sent the owner here with a one-time code; the API trades it for THIS host's
 * own session (cookies stay host-only, nothing is shared with other hosts) and the owner continues to the dashboard. The code works
 * once, for this host only, and for a minute. Anything wrong (missing, used, expired, other host) sends the person to this host's
 * sign-in page, so a bad link never leaves them stuck or on the main domain.
 */
export async function GET(request: NextRequest) {
  // Built from the Host the browser used, so the redirect stays on THIS store host (where the new cookie belongs).
  const url = new URL(browserOrigin(request));
  const to = (path: string) => {
    url.pathname = path;
    const res = NextResponse.redirect(url, 303);
    res.headers.set("Cache-Control", "no-store");
    res.headers.set("Referrer-Policy", "no-referrer");
    return res;
  };

  // The host label the proxy already resolved to a real store; only that host can receive a code made for it.
  const audience = storeSlugFromHost(request.headers.get("host"), process.env.NEXT_PUBLIC_ROOT_DOMAIN);
  const code = request.nextUrl.searchParams.get("code");
  if (!audience || !code || code.length > 2000) return to(ROUTES.login);

  try {
    const cookies = await exchangeStoreHandoff(code, audience);
    const res = to(ROUTES.dashboard);
    applySetCookies(res.cookies, cookies);
    logEvent("info", "store_handoff", { outcome: "ok" });
    return res;
  } catch (error) {
    logEvent("warn", "store_handoff", { outcome: "failed", error: error instanceof Error ? error.name : "unknown" });
    url.searchParams.set("next", ROUTES.dashboard);
    return to(ROUTES.login);
  }
}
