import { getAuthApiConfig } from "@/lib/auth/nest-api";

/**
 * Base URL of the StoreForge API, e.g. `http://localhost:4000/api/v1` (server-only `API_BASE_URL`, the same variable the
 * authentication already uses). Every business operation goes through it; there is no direct-database alternative.
 * The browser never calls the API: the access token stays in the HttpOnly cookie and is attached by the server.
 */
export function apiBaseUrl(env: Record<string, string | undefined> = process.env): string {
  const config = getAuthApiConfig(env);
  if (!config) throw new Error("The StoreForge API is not configured: set API_BASE_URL and AUTH_BFF_SECRET.");
  return config.url;
}
