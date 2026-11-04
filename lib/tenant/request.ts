import "server-only";
import { headers } from "next/headers";
import { isStoreLabel, STORE_HEADER } from "@/lib/tenant/host";

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
