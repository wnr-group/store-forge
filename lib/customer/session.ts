import "server-only";
import { cookies } from "next/headers";

/**
 * The shopper's account session, kept in an HttpOnly cookie on the store's own address. It is a different credential, with a
 * different name, from the owner/staff/admin cookies (`sb-...`), and nothing in the dashboard or admin code reads it. The
 * cookie holds only the opaque token the API issued; the API checks it against ONE store on every call, so the slug in the name
 * is bookkeeping (two stores on one host never share a cookie), not security.
 */
const PREFIX = "sf_cust_";

export const customerCookieName = (storeSlug: string) => `${PREFIX}${storeSlug.replace(/[^a-z0-9]/g, "_")}`;

export async function readCustomerToken(storeSlug: string): Promise<string | undefined> {
  const value = (await cookies()).get(customerCookieName(storeSlug))?.value;
  // The API issues 43 URL-safe characters; anything else is not ours and is never forwarded.
  return value && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : undefined;
}

export async function writeCustomerSession(storeSlug: string, token: string, expiresAt: string): Promise<void> {
  (await cookies()).set(customerCookieName(storeSlug), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export async function clearCustomerSession(storeSlug: string): Promise<void> {
  (await cookies()).delete(customerCookieName(storeSlug));
}

/**
 * Where to send a shopper after signing in. Only a fixed set of storefront paths is allowed, so a crafted `?next=` can never
 * send someone to another site (or to the dashboard).
 */
const NEXT_PATHS = /^\/(checkout|cart|account(\/(orders(\/[1-9]\d{0,9})?|addresses|profile))?)$/;

export function safeNext(value: string | string[] | null | undefined, fallback = "/account"): string {
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === "string" && NEXT_PATHS.test(v) ? v : fallback;
}
