"use client";

import Link from "next/link";
import { ROUTES } from "@/config/app";
import { useSignedIn } from "@/lib/auth/use-signed-in";
import { cn } from "@/lib/utils";
import { lpButton } from "./ui";

/**
 * The account buttons of the public header. A visitor who is not signed in sees "Login" and "Get Started" (the start of the self-service
 * sign-up); a signed-in one sees a single "Dashboard" button that opens their own workspace (the app itself decides where that is, and
 * nothing here points at the Platform Admin area). Until the session cookie has been checked the buttons keep their space but stay
 * invisible, so a signed-in visitor never sees Login flash and nothing shifts.
 */
export function AuthActions({ variant, onNavigate }: { variant: "header" | "menu"; onNavigate?: () => void }) {
  const signedIn = useSignedIn();
  const unchecked = signedIn === null;
  const hidden = unchecked ? { "aria-hidden": true, tabIndex: -1 } : {};
  const size = variant === "header" ? "h-10 px-5" : "w-full";

  const buttons =
    signedIn === true ? (
      <Link href={ROUTES.dashboard} onClick={onNavigate} className={cn(lpButton("primary", size), unchecked && "invisible")} {...hidden}>
        Dashboard
      </Link>
    ) : (
      <>
        <Link href={ROUTES.login} onClick={onNavigate} className={cn(lpButton("secondary", size), unchecked && "invisible")} {...hidden}>
          Login
        </Link>
        <Link href={ROUTES.signup} onClick={onNavigate} className={cn(lpButton("primary", size), unchecked && "invisible")} {...hidden}>
          Get Started
        </Link>
      </>
    );
  return variant === "header" ? <div className="flex items-center gap-2">{buttons}</div> : <div className="mt-4 flex flex-col gap-2 px-3">{buttons}</div>;
}
