"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { ROUTES } from "@/config/app";
import { useSignedIn } from "@/lib/auth/use-signed-in";
import { cn } from "@/lib/utils";

/**
 * Sign-in links in a store's public header. On <store>.<root domain> /login and /dashboard are that store's own app
 * (sessions are per host), so plain relative links are right there and on /s/<slug>. Signed-in visitors only get
 * Dashboard; until the cookie has been checked, Log in keeps its space but stays invisible so nothing flashes or shifts.
 */
export function StoreAuthActions() {
  const signedIn = useSignedIn();
  return (
    <div className="flex shrink-0 items-center gap-2">
      {signedIn !== true ? (
        <Link
          href={ROUTES.login}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), signedIn === null && "invisible")}
          aria-hidden={signedIn === null ? true : undefined}
          tabIndex={signedIn === null ? -1 : undefined}
        >
          Log in
        </Link>
      ) : null}
      <Link href={ROUTES.dashboard} className={buttonVariants({ size: "sm" })}>
        Dashboard
      </Link>
    </div>
  );
}
