import "server-only";
import { cookies } from "next/headers";
import { readStoredSession } from "@/lib/auth/nest-api";
import { AppError, type AppErrorCode } from "@/lib/errors";
import { logEvent } from "@/lib/observability/log";
import { apiBaseUrl } from "./config";

/**
 * The one place this app calls the StoreForge API for business data.
 *
 * Runs on the server only: the access token lives in an HttpOnly cookie and is read here, so no token ever reaches
 * browser code, and nothing is kept in local/session storage. The organization comes from the caller (the DB-verified
 * active tenant); the API checks membership again on every request and answers 403 for an organization the user does
 * not belong to.
 */

export type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  data?: T;
  meta?: PageMeta;
  error?: { code?: string; details?: unknown };
};

export type PageMeta = { page: number; limit: number; total: number; totalPages: number };

export type ApiQuery = Record<string, string | number | boolean | null | undefined>;

export type ApiCall = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  query?: ApiQuery;
  json?: unknown;
  /** Sent as `X-Organization-Id`. Omit for user-level and platform endpoints. */
  organizationId?: string;
  /** Extra request headers (for example the shopper's `x-order-token` or an `idempotency-key`). Never an Authorization header. */
  headers?: Record<string, string>;
  /** For public endpoints (branding, storefront): no session is read and no token is sent. */
  anonymous?: boolean;
  /**
   * Cache this PUBLIC read in Next's data cache under these tags (anonymous calls only; a signed-in call is never cached).
   * A tag names one store (`storefront:<slug>`), so an entry can never be served for another store and one call to
   * `invalidateStorefront` drops everything that store showed. `revalidate` is the safety-net lifetime in seconds.
   */
  cache?: { tags: string[]; revalidate: number };
  timeoutMs?: number;
};

const FALLBACK = "Something went wrong. Please try again.";

const CODE_BY_STATUS: Record<number, AppErrorCode> = {
  400: "VALIDATION",
  401: "UNAUTHENTICATED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  422: "VALIDATION",
  429: "RATE_LIMITED",
};

/** Query string: arrays are not used by any endpoint; `undefined`, `null` and `""` are skipped. */
export function serializeQuery(query?: ApiQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

/** Field errors are `{ field: message }`; anything else (e.g. the list of class-validator messages) is not shown per field. */
function fieldErrors(details: unknown): Record<string, string> | undefined {
  if (!details || typeof details !== "object" || Array.isArray(details)) return undefined;
  const entries = Object.entries(details).filter((e): e is [string, string] => typeof e[1] === "string");
  return entries.length ? Object.fromEntries(entries) : undefined;
}

/** Error codes whose `details` are passed through as typed, structured data (everything else keeps only flat field errors). */
const STRUCTURED_DETAIL_CODES = new Set(["PRODUCT_IMPORT_INVALID", "CHECKOUT_ISSUES", "DISCOUNT_INVALID"]);

/** Turns a failed response into the `AppError` the pages and server actions already know how to show. */
export function toAppError(status: number, body: ApiEnvelope<unknown> | null): AppError {
  // The body parser answers 413 before the API can build its message, so the text is written here.
  if (status === 413) return new AppError("VALIDATION", "The request is too large. Shorten long descriptions or split the file into smaller imports.");
  const code = CODE_BY_STATUS[status] ?? "UNKNOWN";
  const message = status >= 500 || !body?.message ? FALLBACK : body.message;
  const structured = body?.error?.code && STRUCTURED_DETAIL_CODES.has(body.error.code) ? body.error.details : undefined;
  return new AppError(code, message, fieldErrors(body?.error?.details), body?.error?.code, structured);
}

export type ApiResult<T> = { data: T; meta?: PageMeta };

/** One request. Throws `AppError` for any failure; 5xx and network errors become the generic message and are logged. */
export async function apiRequest<T = unknown>(path: string, call: ApiCall = {}): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (!call.anonymous) {
    const session = await readStoredSession(await cookies());
    if (!session) throw new AppError("UNAUTHENTICATED", "Your session has expired. Please sign in again.");
    headers.Authorization = `Bearer ${session.accessToken}`;
  }
  for (const [name, value] of Object.entries(call.headers ?? {})) if (name.toLowerCase() !== "authorization") headers[name] = value;
  if (call.organizationId) headers["X-Organization-Id"] = call.organizationId;
  if (call.json !== undefined) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}${serializeQuery(call.query)}`, {
      method: call.method ?? "GET",
      headers,
      body: call.json !== undefined ? JSON.stringify(call.json) : undefined,
      ...(call.anonymous && call.cache ? { next: { revalidate: call.cache.revalidate, tags: call.cache.tags } } : { cache: "no-store" as const }),
      redirect: "manual",
      signal: AbortSignal.timeout(call.timeoutMs ?? 15_000),
    });
  } catch (error) {
    logEvent("error", "api_unreachable", { path, error: error instanceof Error ? error.name : "unknown" });
    throw new AppError("UNKNOWN", FALLBACK);
  }

  let body: ApiEnvelope<T> | null = null;
  try {
    body = (await response.json()) as ApiEnvelope<T>;
  } catch {
    body = null;
  }
  if (!response.ok || !body?.success) {
    if (response.status >= 500 || !body) logEvent("error", "api_error", { path, status: response.status, code: body?.error?.code });
    throw toAppError(response.status, body);
  }
  return { data: body.data as T, meta: body.meta };
}
