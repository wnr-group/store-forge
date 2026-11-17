import "server-only";
import { AppError } from "@/lib/errors";
import { logEvent } from "@/lib/observability/log";

/**
 * Client for the StoreForge API's authentication endpoints (NestJS, `/api/v1/auth/*`).
 *
 * Sign-in, sign-out, token refresh, password change and session checks go through the API, which talks to Supabase Auth
 * internally. This app only relays: it calls the API from the SERVER (so the browser never talks to the API for
 * authentication and the cookies stay host-scoped, one set per store host), and copies the API's `Set-Cookie` headers onto
 * its own response. The browser therefore only ever sees HttpOnly cookies on this app's own host.
 *
 * `API_BASE_URL` and `AUTH_BFF_SECRET` are required: there is no direct-to-Supabase sign-in any more.
 */

export type AuthApiConfig = { url: string; secret: string };

/** `null` when `API_BASE_URL` is unset (callers then fail with a clear error). Throws if it is half configured. */
export function getAuthApiConfig(env: Record<string, string | undefined> = process.env): AuthApiConfig | null {
  const url = env.API_BASE_URL?.trim().replace(/\/+$/, "");
  const secret = env.AUTH_BFF_SECRET?.trim();
  if (!url) return null;
  if (!/^https?:\/\//.test(url)) throw new Error("API_BASE_URL must be an http(s) URL, e.g. http://localhost:4000/api/v1.");
  if (!secret || secret.length < 32)
    throw new Error("AUTH_BFF_SECRET (at least 32 characters, the same value as in the API) is required when API_BASE_URL is set.");
  return { url, secret };
}

export const authApiEnabled = () => getAuthApiConfig() !== null;

export type AuthApiBody<T> = {
  success: boolean;
  message?: string;
  data?: T;
  error?: { code?: string; details?: unknown };
};

export type AuthApiResult<T> = { status: number; ok: boolean; body: AuthApiBody<T> | null; setCookies: string[] };

export type AuthApiCall = {
  method?: "GET" | "POST";
  json?: unknown;
  /** The visitor's cookies, forwarded so the API can read the session. */
  cookieHeader?: string | null;
  /** An access token for endpoints that use the Authorization header. */
  bearer?: string;
  /** The visitor's address, for login rate limiting. */
  clientIp?: string;
};

/**
 * One call to the API. Never throws for an HTTP error status (the caller maps it); throws only when the API cannot be
 * reached. Secrets and cookies are never logged.
 */
export async function authApi<T = unknown>(path: string, call: AuthApiCall = {}, config = getAuthApiConfig()): Promise<AuthApiResult<T>> {
  if (!config) throw new Error("The auth API is not configured (API_BASE_URL).");
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Internal-Auth": config.secret,
  };
  if (call.json !== undefined) headers["Content-Type"] = "application/json";
  if (call.cookieHeader) headers.Cookie = call.cookieHeader;
  if (call.bearer) headers.Authorization = `Bearer ${call.bearer}`;
  if (call.clientIp) headers["X-Forwarded-For"] = call.clientIp;

  let response: Response;
  try {
    response = await fetch(`${config.url}${path}`, {
      method: call.method ?? "GET",
      headers,
      body: call.json !== undefined ? JSON.stringify(call.json) : undefined,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    logEvent("error", "auth_api_unreachable", { path, error: error instanceof Error ? error.name : "unknown" });
    throw new AppError("UNKNOWN", "Something went wrong. Please try again.");
  }

  let body: AuthApiBody<T> | null = null;
  try {
    body = (await response.json()) as AuthApiBody<T>;
  } catch {
    body = null;
  }
  return { status: response.status, ok: response.ok, body, setCookies: response.headers.getSetCookie() };
}

// ---------------------------------------------------------------------------------------------------------------------
// Cookies
// ---------------------------------------------------------------------------------------------------------------------

export type ParsedCookie = {
  name: string;
  value: string;
  options: { maxAge?: number; expires?: Date; path?: string; sameSite?: "lax" | "strict" | "none"; httpOnly?: boolean; secure?: boolean };
};

/** Parses one `Set-Cookie` header line. `Domain` is dropped on purpose: cookies stay host-only on this app's host. */
export function parseSetCookie(line: string): ParsedCookie | null {
  const [pair, ...attrs] = line.split(";").map((part) => part.trim());
  const eq = pair.indexOf("=");
  if (eq <= 0) return null;
  const options: ParsedCookie["options"] = {};
  for (const attr of attrs) {
    const [rawKey, ...rest] = attr.split("=");
    const key = rawKey.toLowerCase();
    const value = rest.join("=");
    if (key === "max-age" && /^-?\d+$/.test(value)) options.maxAge = Number(value);
    else if (key === "expires" && !Number.isNaN(Date.parse(value))) options.expires = new Date(value);
    else if (key === "path") options.path = value || "/";
    else if (key === "samesite" && ["lax", "strict", "none"].includes(value.toLowerCase())) options.sameSite = value.toLowerCase() as "lax" | "strict" | "none";
    else if (key === "httponly") options.httpOnly = true;
    else if (key === "secure") options.secure = true;
  }
  return { name: pair.slice(0, eq), value: pair.slice(eq + 1), options };
}

/** What a cookie jar needs: Next's `cookies()` store and `NextResponse.cookies` both fit. */
export type CookieSink = { set(name: string, value: string, options?: ParsedCookie["options"]): unknown; delete(name: string): unknown };

/** Applies the API's cookies to this app's response. A cookie the API expired is deleted. */
export function applySetCookies(sink: CookieSink, lines: string[]): void {
  for (const line of lines) {
    const cookie = parseSetCookie(line);
    if (!cookie) continue;
    if (cookie.value === "" || cookie.options.maxAge === 0) sink.delete(cookie.name);
    else sink.set(cookie.name, cookie.value, { path: "/", ...cookie.options });
  }
}

export const SIGNED_IN_MARKER = "sf_signed_in";
const SESSION_COOKIE = /^sb-.+-auth-token(?:\.\d+)?$/;

export const isSessionCookieName = (name: string) => SESSION_COOKIE.test(name);

export type CookieReader = { getAll(): { name: string; value: string }[] };

/** Base64url -> UTF-8 text, with Web APIs only (this also runs in the proxy). Whitespace and `=` are ignored. Throws on anything else invalid. */
function stringFromBase64URL(input: string): string {
  const b64 = input.replace(/[\s=]/g, "").replace(/-/g, "+").replace(/_/g, "/");
  if (b64.length % 4 === 1 || /[^A-Za-z0-9+/]/.test(b64)) throw new Error("Invalid base64url");
  const binary = atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, "="));
  return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

/** The cookie value, or its numbered chunks (`key.0`, `key.1`, ...) joined, as the API writes a large session. */
function combineChunks(key: string, cookies: { name: string; value: string }[]): string | null {
  const get = (name: string) => cookies.find((c) => c.name === name)?.value || null;
  const whole = get(key);
  if (whole) return whole;
  const parts: string[] = [];
  for (let i = 0; ; i++) {
    const chunk = get(`${key}.${i}`);
    if (!chunk) break;
    parts.push(chunk);
  }
  return parts.length ? parts.join("") : null;
}

export type StoredSession = { accessToken: string; refreshToken: string | null; expiresAt: number | null };

/** Reads (without verifying) the session cookie the API sets (the format `@supabase/ssr` writes on the API side): `sb-<ref>-auth-token`, possibly chunked, `base64-` encoded. */
export async function readStoredSession(cookies: CookieReader): Promise<StoredSession | null> {
  const all = cookies.getAll();
  const base = all.map((c) => c.name).find((name) => /^sb-.+-auth-token$/.test(name) || /^sb-.+-auth-token\.0$/.test(name));
  if (!base) return null;
  const key = base.replace(/\.0$/, "");
  const raw = combineChunks(key, all);
  if (!raw) return null;
  try {
    const json = raw.startsWith("base64-") ? stringFromBase64URL(raw.slice("base64-".length)) : raw;
    const s = JSON.parse(json) as { access_token?: unknown; refresh_token?: unknown; expires_at?: unknown };
    if (typeof s.access_token !== "string" || !s.access_token) return null;
    return {
      accessToken: s.access_token,
      refreshToken: typeof s.refresh_token === "string" && s.refresh_token ? s.refresh_token : null,
      expiresAt: typeof s.expires_at === "number" ? s.expires_at : null,
    };
  } catch {
    return null;
  }
}

/** The `exp` claim of a JWT WITHOUT verifying it. Only for deciding whether to refresh; trust comes from the API. */
export function unverifiedExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(stringFromBase64URL(token.split(".")[1] ?? "")) as { exp?: unknown };
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}
