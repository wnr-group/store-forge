"use client";

import { useSyncExternalStore } from "react";

/**
 * Supabase's session cookie (`sb-<project>-auth-token`, possibly chunked as `.0`, `.1`) is readable by the browser
 * (httpOnly is false by default), so a public page can tell a signed-in visitor apart without a server lookup and
 * stays fully static. The check is optimistic: a stale cookie only means the Dashboard link goes through the proxy,
 * which refreshes the session or sends the visitor to /login.
 */
const subscribe = () => () => {};
const hasSessionCookie = () => /(?:^|;\s*)sb-[^=;]*-auth-token(?:\.\d+)?=/.test(document.cookie);

/** `null` until the browser has been checked (and during server rendering), then true or false. */
export function useSignedIn(): boolean | null {
  return useSyncExternalStore(subscribe, hasSessionCookie, () => null);
}
