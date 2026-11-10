"use client";

import Link from "next/link";
import { ROUTES } from "@/config/app";
import { useSignedIn } from "@/lib/auth/use-signed-in";
import { cn } from "@/lib/utils";
import { lpButton } from "./ui";

/**
 * One sign-in button: "Log in" for a visitor who is not signed in, "Dashboard" for one who is. Until the session
 * cookie has been checked the button keeps its space but stays invisible, so a signed-in visitor never sees Log in
 * flash and nothing shifts.
 */
export function AuthActions({ variant, onNavigate }: { variant: "header" | "menu"; onNavigate?: () => void }) {
  const signedIn = useSignedIn();
  const unchecked = signedIn === null;
  const link = (
    <Link
      href={signedIn === true ? ROUTES.dashboard : ROUTES.login}
      onClick={onNavigate}
      className={cn(lpButton("primary", variant === "header" ? "h-10 px-5" : "w-full"), unchecked && "invisible")}
      aria-hidden={unchecked ? true : undefined}
      tabIndex={unchecked ? -1 : undefined}
    >
      {signedIn === true ? "Dashboard" : "Log in"}
    </Link>
  );
  return variant === "header" ? link : <div className="mt-4 px-3">{link}</div>;
}
