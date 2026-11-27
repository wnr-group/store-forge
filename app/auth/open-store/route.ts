import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/tenant/context";
import { storeDashboardUrl } from "@/lib/tenant/open-store";
import { browserOrigin } from "@/lib/tenant/request-origin";
import { isStoreHostRequest } from "@/lib/tenant/request";
import { ROUTES } from "@/config/app";

export const dynamic = "force-dynamic";

/**
 * "Dashboard" on the main site. Finds the signed-in person's store from their memberships (the active/default one, the same choice
 * `requireWorkspace` makes everywhere) and sends them to its dashboard on the store's own host, signed in. Someone with no workspace
 * goes where `requireWorkspace` sends them (onboarding, or the admin area for platform staff); a signed-out visitor goes to login.
 * Nothing here trusts the browser: the store comes from the API's membership list.
 */
export async function GET(request: Request) {
  // Already on a store host (e.g. the dashboard layout was rendered by a server action, which carries the server's own host, and sent the
  // browser here): the dashboard is right here, with this host's own session. Never answer a store host with the main-site lookup.
  if (await isStoreHostRequest()) return NextResponse.redirect(new URL(ROUTES.dashboard, browserOrigin(request)), 303);
  const { store, active } = await requireWorkspace();
  const target = store ? await storeDashboardUrl({ slug: store.slug, publicId: active.tenant.publicId }) : null;
  const res = NextResponse.redirect(target ?? new URL(ROUTES.dashboard, browserOrigin(request)), 303);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
