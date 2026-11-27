import "server-only";
import { headers } from "next/headers";
import { isStoreLabel, storeSlugFromHost, STORE_HEADER } from "@/lib/tenant/host";

/**
 * The store named by the request's host (<store>.<root domain>), or null on the main domain.
 * The value comes from a header that proxy.ts deletes from every incoming request and then sets
 * only from the Host header, so a browser cannot forge it. It selects WHICH workspace to show;
 * membership is still verified in the database and by RLS.
 */
export async function getRequestStoreSlug(): Promise<string | null> {
  try {
    const value = (await headers()).get(STORE_HEADER);
    return isStoreLabel(value) ? value : null;
  } catch {
    return null; // outside a request (scripts, some tests)
  }
}

/**
 * True when the request's own Host is a store host (<store>.<root domain>). Unlike `getRequestStoreSlug` this does not depend on the
 * proxy's header, so it is the safe test for "must this request be sent to a store host?": a wrong "no" would bounce an owner who is
 * already on their store host back to the main site's redirect, in a loop.
 */
export async function isStoreHostRequest(): Promise<boolean> {
  try {
    const host = (await headers()).get("host");
    return storeSlugFromHost(host, process.env.NEXT_PUBLIC_ROOT_DOMAIN) !== null;
  } catch {
    return false;
  }
}

/**
 * True only when the request's Host IS the configured root domain (the StoreForge platform site). Anything else (a store host, or the
 * server's own address during a server action's internal render) is not the main site, so nothing may be redirected away from it.
 */
export async function isMainHostRequest(): Promise<boolean> {
  try {
    const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim().toLowerCase();
    const host = (await headers()).get("host")?.trim().toLowerCase();
    return Boolean(root && host && host === root);
  } catch {
    return false;
  }
}
