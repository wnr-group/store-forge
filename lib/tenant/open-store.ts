import "server-only";
import { ROUTES } from "@/config/app";
import { logEvent } from "@/lib/observability/log";
import { storefrontUrl, storeHostLabel } from "@/lib/tenant/host";
import { issueStoreHandoff } from "@/services/auth.service";

/**
 * Where a store owner's dashboard lives: on THEIR store host (`<store>-<id>.<root>/dashboard`), never on the main domain, which is the
 * StoreForge platform. Session cookies are host-only, so the owner arrives signed out; the address carries a one-time code (made by the
 * API, only for a store they belong to, valid for one minute) that the store host trades for its own session (`app/auth/handoff`).
 *
 * `null` when no root domain is configured (a single-host deployment has no store hosts: the dashboard stays where it is).
 * If the code cannot be made, the owner still lands on their store host, at its sign-in page: never on the main domain.
 */
export async function storeDashboardUrl(store: { slug: string; publicId: string }): Promise<string | null> {
  const base = storefrontUrl(store.slug, process.env.NEXT_PUBLIC_ROOT_DOMAIN, store.publicId);
  if (!base) return null;
  try {
    const code = await issueStoreHandoff(storeHostLabel(store.slug, store.publicId));
    return `${base}${ROUTES.handoff}?code=${encodeURIComponent(code)}`;
  } catch (error) {
    logEvent("warn", "store_handoff", { outcome: "failed", error: error instanceof Error ? error.name : "unknown" });
    return `${base}${ROUTES.login}?next=${encodeURIComponent(ROUTES.dashboard)}`;
  }
}

/** True when the owner's dashboard has a store host of its own to live on. */
export const hasStoreHost = (store: { slug: string; publicId: string }) => storefrontUrl(store.slug, process.env.NEXT_PUBLIC_ROOT_DOMAIN, store.publicId) !== null;
