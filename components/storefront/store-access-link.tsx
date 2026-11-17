"use client";

import Link from "next/link";
import { useSignedIn } from "@/lib/auth/use-signed-in";

// A cookie check only (no network): a signed-in visitor goes straight to /dashboard instead of through /login, whose redirect a
// client-side navigation cannot follow. /dashboard still validates the session itself. The session cookies are HttpOnly, so
// the check reads the token-free `sf_signed_in` marker (see useSignedIn). It runs on the client so the storefront stays
// cacheable; until it has run the link shows the signed-out label, which avoids a hydration mismatch.
export function StoreAccessLink({ className }: { className?: string }) {
  const signedIn = useSignedIn() === true;
  return (
    <Link href={signedIn ? "/dashboard" : "/login"} prefetch={false} className={className}>
      {signedIn ? "Dashboard" : "Store login"}
    </Link>
  );
}
