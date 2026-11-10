"use client";

import { useSyncExternalStore } from "react";

/**
 * A public page can tell a signed-in visitor apart without a server lookup and stays fully static. Two cookies count:
 *  - `sf_signed_in`, a token-free marker set next to the HttpOnly session cookies when the StoreForge API owns the session
 *    (the tokens themselves are then invisible to page scripts), and
 *  - Supabase's own session cookie (`sb-<project>-auth-token`, possibly chunked as `.0`, `.1`), readable only in the
 *    previous direct-to-Supabase mode.
 * The check is optimistic: a stale cookie only means the Dashboard link goes through the proxy, which refreshes the
 * session or sends the visitor to /login.
 */
const subscribe = () => () => {};
const hasSessionCookie = () => /(?:^|;\s*)(?:sf_signed_in=1|sb-[^=;]*-auth-token(?:\.\d+)?=)/.test(document.cookie);

/** `null` until the browser has been checked (and during server rendering), then true or false. */
export function useSignedIn(): boolean | null {
  return useSyncExternalStore(subscribe, hasSessionCookie, () => null);
}
