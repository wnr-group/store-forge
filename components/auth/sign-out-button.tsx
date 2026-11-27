"use client";

import { useTransition } from "react";
import { signOutAction } from "@/app/(auth)/actions";
import { ROUTES } from "@/config/app";

/**
 * Signs out, then loads the sign-in page with a full page load (not a client-side navigation).
 *
 * A server action that calls redirect() makes Next fetch the target page from inside the server, and that internal
 * request carries the server's own host (localhost), not the store's. The proxy then no longer sees the store
 * subdomain, so the sign-in page shows the platform name until the next refresh. A real page load goes through the
 * proxy with the browser's own host, so the sign-in page names the store straight away.
 */
/**
 * On a store host the main site's own session (a separate, host-only cookie set) must be cleared too, or the landing page keeps showing
 * "Dashboard". Returns the main site's sign-out address (which comes back to this store's sign-in), or null when not on a store host.
 */
function mainSiteSignOut(): string | null {
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim().toLowerCase();
  const host = window.location.host.toLowerCase();
  if (!root || host === root || !host.endsWith(`.${root}`)) return null;
  const label = host.slice(0, -(root.length + 1));
  return `${window.location.protocol}//${root}/auth/sign-out?to=${encodeURIComponent(label)}`;
}

export function SignOutButton({ className, children }: { className?: string; children: React.ReactNode }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className={className}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await signOutAction();
          window.location.assign(mainSiteSignOut() ?? ROUTES.login);
        })
      }
    >
      {children}
    </button>
  );
}
