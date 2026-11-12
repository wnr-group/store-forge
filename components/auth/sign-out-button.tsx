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
          window.location.assign(ROUTES.login);
        })
      }
    >
      {children}
    </button>
  );
}
