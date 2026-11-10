"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
// A cookie check only (no network): a signed-in visitor goes straight to /dashboard instead of through /login, whose redirect a
// client-side navigation cannot follow. /dashboard still validates the session itself. Read on the client so the storefront
// stays cacheable; the server snapshot is signed-out, which avoids a hydration mismatch.
const hasSession = () => document.cookie.split("; ").some((c) => c.startsWith("sb-") && c.split("=")[0].includes("auth-token"));

export function StoreAccessLink({ className }: { className?: string }) {
  const signedIn = useSyncExternalStore(subscribe, hasSession, () => false);
  return (
    <Link href={signedIn ? "/dashboard" : "/login"} prefetch={false} className={className}>
      {signedIn ? "Dashboard" : "Store login"}
    </Link>
  );
}
