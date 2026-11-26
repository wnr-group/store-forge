import "server-only";
import { cookies } from "next/headers";
import { readStoredSession } from "@/lib/auth/nest-api";
import { AppError } from "@/lib/errors";
import { logEvent } from "@/lib/observability/log";
import { apiBaseUrl } from "./config";

/**
 * Downloads a file (a shipping label or an invoice PDF) from the StoreForge API for the signed-in user. Platform endpoints take no organization. Like `apiRequest`, it runs on the
 * server only: the access token comes from the HttpOnly cookie and never reaches the browser; the organization is the
 * caller's verified active tenant.
 */
export async function apiBinary(path: string, organizationId?: string): Promise<{ body: ArrayBuffer; contentType: string }> {
  const session = await readStoredSession(await cookies());
  if (!session) throw new AppError("UNAUTHENTICATED", "Your session has expired. Please sign in again.");
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, {
      headers: { Authorization: `Bearer ${session.accessToken}`, ...(organizationId ? { "X-Organization-Id": organizationId } : {}) },
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    logEvent("error", "api_unreachable", { path, error: "download" });
    throw new AppError("UNKNOWN", "Something went wrong. Please try again.");
  }
  if (response.status === 404) throw new AppError("NOT_FOUND", "That file is not available.");
  if (response.status === 401 || response.status === 403) throw new AppError(response.status === 401 ? "UNAUTHENTICATED" : "FORBIDDEN", "You do not have permission to do that.");
  if (!response.ok) {
    logEvent("error", "api_error", { path, status: response.status });
    throw new AppError("UNKNOWN", "Something went wrong. Please try again.");
  }
  return { body: await response.arrayBuffer(), contentType: response.headers.get("content-type") ?? "application/pdf" };
}
