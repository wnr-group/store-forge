"use client";

import Link from "next/link";
import { ROUTES } from "@/config/app";
import { useSignedIn } from "@/lib/auth/use-signed-in";
import { cn } from "@/lib/utils";
import { lpButton } from "./ui";

/**
 * "Log in" for visitors who are not signed in, "Dashboard" for everyone. While the cookie has not been checked yet
 * the Log in button keeps its space but is invisible, so a signed-in visitor never sees it flash and nothing shifts.
 */
export function AuthActions({ variant, onNavigate }: { variant: "header" | "menu"; onNavigate?: () => void }) {
  const signedIn = useSignedIn();
  const size = variant === "header" ? "h-10 px-5" : undefined;
  const showLogin = signedIn !== true;

  return (
    <div className={cn(variant === "header" ? "flex items-center gap-2" : cn("mt-4 grid gap-3 px-3", showLogin ? "grid-cols-2" : "grid-cols-1"))}>
      {showLogin ? (
        <Link
          href={ROUTES.login}
          onClick={onNavigate}
          className={cn(lpButton("secondary", size), signedIn === null && "invisible")}
          aria-hidden={signedIn === null ? true : undefined}
          tabIndex={signedIn === null ? -1 : undefined}
        >
          Log in
        </Link>
      ) : null}
      <Link href={ROUTES.dashboard} onClick={onNavigate} className={lpButton("primary", size)}>
        Dashboard
      </Link>
    </div>
  );
}
