"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { ROUTES } from "@/config/app";
import { useSignedIn } from "@/lib/auth/use-signed-in";
import { cn } from "@/lib/utils";

/**
 * One sign-in button in a store's public header: "Log in" for a visitor who is not signed in to THIS address,
 * "Dashboard" for one who is. Sessions are per host (<store>.<root domain> has its own sign-in), so being signed in
 * as a Platform Admin on the main site does not count here. Until the cookie has been checked, the button keeps its
 * space but stays invisible, so a signed-in visitor never sees Log in flash and nothing shifts.
 */
export function StoreAuthActions() {
  const signedIn = useSignedIn();
  if (signedIn === true) {
    return (
      <Link href={ROUTES.dashboard} className={cn(buttonVariants({ size: "sm" }), "shrink-0")}>
        Dashboard
      </Link>
    );
  }
  return (
    <Link
      href={ROUTES.login}
      className={cn(buttonVariants({ size: "sm" }), "shrink-0", signedIn === null && "invisible")}
      aria-hidden={signedIn === null ? true : undefined}
      tabIndex={signedIn === null ? -1 : undefined}
    >
      Log in
    </Link>
  );
}
