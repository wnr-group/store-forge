import { NextResponse } from "next/server";
import { ROUTES } from "@/config/app";
import { storeSlugFromHost } from "@/lib/tenant/host";
import { browserOrigin } from "@/lib/tenant/request-origin";
import { signOut } from "@/services/auth.service";

export const dynamic = "force-dynamic";

/**
 * The main site's half of signing out from a store host. Cookies are host-only, so signing out on `<store>-<id>.<root>` clears only that
 * host's cookies; the session the person may also have on the main site (and the marker that makes the landing page say "Dashboard")
 * stays until it is cleared HERE, on the main host. The store host's sign-out button sends the browser through this route, which then
 * returns it to that store's sign-in page. `to` is only honoured when it names a real store host label under this root domain
 * (never an arbitrary address), otherwise the person lands on the main site's sign-in page.
 */
export async function GET(request: Request) {
  await signOut();
  const origin = new URL(browserOrigin(request));
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  const label = new URL(request.url).searchParams.get("to") ?? "";
  const host = root && label ? `${label}.${root}` : null;
  const target = host && storeSlugFromHost(host, root) ? `${origin.protocol}//${host}${ROUTES.login}` : new URL(ROUTES.login, origin).toString();
  const res = NextResponse.redirect(target, 303);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
