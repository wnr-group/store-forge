import "server-only";
import { headers } from "next/headers";

/** The caller's address from the proxy header. Falls back to a shared bucket when there is none (local development). */
export async function requestAddress(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || "unknown";
}
