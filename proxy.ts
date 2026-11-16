import { NextResponse, type NextRequest } from "next/server";
import { isSubdomainAppPath, storeSlugFromHost, STORE_HEADER } from "@/lib/tenant/host";
import { resolveStoreHost } from "@/lib/tenant/resolve-host";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  // Credentials in a URL end up in history, server logs and Referer headers. If a login form was ever
  // submitted as a plain GET (e.g. before the page hydrated), drop them and show the clean form.
  const { pathname, searchParams } = request.nextUrl;
  if (pathname === "/login" && (searchParams.has("password") || searchParams.has("email"))) {
    const clean = request.nextUrl.clone();
    clean.search = "";
    const next = searchParams.get("next");
    if (next) clean.searchParams.set("next", next);
    return NextResponse.redirect(clean, 303);
  }

  // Never trust a client-supplied store header: only the Host header may set it (below).
  request.headers.delete(STORE_HEADER);

  const label = storeSlugFromHost(request.headers.get("host"), process.env.NEXT_PUBLIC_ROOT_DOMAIN);
  if (label) {
    // <store>-<publicId>.<root domain> (or the older <store>.<root domain>). The host only SELECTS a store: the public id
    // in it must match the one the API reports for that store, otherwise nothing is served for the host.
    let store;
    try {
      store = await resolveStoreHost(label);
    } catch {
      return new NextResponse("Service temporarily unavailable. Please try again shortly.", { status: 503, headers: { "retry-after": "10" } });
    }
    if (!store) {
      // Unknown host: render the storefront's own "not found" (also for /login and /dashboard, which belong to real stores only).
      const url = request.nextUrl.clone();
      url.pathname = `/s/${label}${url.pathname === "/" ? "" : url.pathname}`;
      return NextResponse.rewrite(url);
    }
    // /login and /dashboard are that store's app (session cookies are per host, so each store host has its own
    // sign-in); everything else is the public storefront (app/s/[slug]), addressed by the store's real slug.
    if (isSubdomainAppPath(request.nextUrl.pathname)) {
      request.headers.set(STORE_HEADER, store.slug);
      return updateSession(request);
    }
    const url = request.nextUrl.clone();
    url.pathname = `/s/${store.slug}${url.pathname === "/" ? "" : url.pathname}`;
    return NextResponse.rewrite(url);
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    // Skip static assets and image optimisation.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
