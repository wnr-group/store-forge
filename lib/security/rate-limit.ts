import "server-only";
import { createHmac } from "node:crypto";
import { sql } from "drizzle-orm";
import { headers } from "next/headers";
import { getRateLimitSecret } from "@/config/env";
import { getDatabase } from "@/lib/db";
import { errorChain } from "@/lib/db/errors";
import { withAuthenticatedDb } from "@/lib/db/tenant-db";
import { rowsOf, withPublicContext } from "@/lib/db/user-context";
import { AppError } from "@/lib/errors";
import { describeError, logEvent } from "@/lib/observability/log";

/**
 * Rate limiting for sensitive Platform Admin operations and for sign-in attempts. Counters live in the database
 * (rate_limit_admin / rate_limit_login), so every server instance shares them. Fixed windows: after `limit` attempts in a window
 * the operation is refused until the window ends. Refusals are logged.
 *
 * If the limiter itself cannot be reached (for example the database hiccups) the operation is allowed and the problem is logged:
 * a limiter fault must not lock the admins, or everyone, out. Authorisation is separate and always enforced.
 */

/** Per admin, per window. Deleting an organization is limited here without changing how deletion works. */
export const ADMIN_RATE_LIMITS = {
  "org.create": { limit: 10, windowSeconds: 600 },
  "org.delete": { limit: 5, windowSeconds: 600 },
  "org.edit": { limit: 60, windowSeconds: 600 },
  "team.manage": { limit: 30, windowSeconds: 600 },
  "ownership.change": { limit: 5, windowSeconds: 600 },
  "admin.manage": { limit: 10, windowSeconds: 600 },
  "settings.update": { limit: 20, windowSeconds: 600 },
} as const;
export type AdminRateBucket = keyof typeof ADMIN_RATE_LIMITS;

type Hit = { allowed: boolean; remaining: number; retry_after_seconds: number };

/** "about 45 seconds" / "about 8 minutes" */
export function waitText(seconds: number): string {
  const s = Math.max(1, Math.round(seconds));
  return s < 90 ? `${s} second${s === 1 ? "" : "s"}` : `${Math.ceil(s / 60)} minutes`;
}

function tooMany(retryAfterSeconds: number) {
  return new AppError("RATE_LIMITED", `Too many requests. Please wait about ${waitText(retryAfterSeconds)} and try again.`);
}

/**
 * Counts one attempt by the signed-in Platform Admin and throws RATE_LIMITED when they are over the limit for `bucket`. Call it first
 * in the action. Signed-out callers get UNAUTHENTICATED and non-admins FORBIDDEN, so it also acts as an early authorisation check.
 */
export async function enforceAdminRateLimit(bucket: AdminRateBucket): Promise<void> {
  const { limit, windowSeconds } = ADMIN_RATE_LIMITS[bucket];
  let hit: Hit | undefined;
  try {
    hit = await withAuthenticatedDb(async (tx) =>
      rowsOf<Hit>(await tx.execute(sql`select * from public.rate_limit_admin(${bucket}, ${limit}, ${windowSeconds})`))[0],
    );
  } catch (error) {
    if (error instanceof AppError) throw error; // signed out
    if (errorChain(error).includes("not_platform_admin")) throw new AppError("FORBIDDEN", "You do not have permission to do that.");
    logEvent("error", "rate_limit_unavailable", { bucket, error: describeError(error) });
    return;
  }
  if (hit && !hit.allowed) {
    logEvent("warn", "rate_limited", { bucket, limit, windowSeconds, retryAfterSeconds: hit.retry_after_seconds });
    throw tooMany(hit.retry_after_seconds);
  }
}

// ---- Sign-in attempts ---------------------------------------------------------------------------------------------

const hmac = (value: string) => createHmac("sha256", getRateLimitSecret()).update(value).digest("hex");

/** The two counters for one attempt: this address + e-mail, and this address alone. Only keyed hashes are ever sent to the database. */
export function loginSubjects(ip: string, email: string): { email: string; ip: string } {
  const address = ip.trim().toLowerCase() || "unknown";
  return { email: hmac(`${address}|${email.trim().toLowerCase()}`), ip: hmac(address) };
}

/** The caller's address from the proxy header. Falls back to a shared bucket when there is none (local development). */
export async function requestAddress(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Counts one sign-in attempt and throws RATE_LIMITED when this address (or this address + e-mail) has made too many in the window
 * (8 and 40 per 15 minutes). Runs before the password is checked. Supabase applies its own limits as well; this one is ours.
 */
export async function enforceLoginRateLimit(email: string): Promise<void> {
  let worst: Hit | undefined;
  try {
    const subjects = loginSubjects(await requestAddress(), email);
    const hits = await withPublicContext(getDatabase(), async (tx) => {
      const byEmail = rowsOf<Hit>(await tx.execute(sql`select * from public.rate_limit_login(${subjects.email}, 'email')`))[0];
      const byIp = rowsOf<Hit>(await tx.execute(sql`select * from public.rate_limit_login(${subjects.ip}, 'ip')`))[0];
      return [byEmail, byIp];
    });
    worst = hits.filter((h): h is Hit => Boolean(h) && !h!.allowed).sort((a, b) => b.retry_after_seconds - a.retry_after_seconds)[0];
  } catch (error) {
    logEvent("error", "rate_limit_unavailable", { bucket: "login", error: describeError(error) });
    return;
  }
  if (worst) {
    logEvent("warn", "rate_limited", { bucket: "login", retryAfterSeconds: worst.retry_after_seconds });
    throw tooMany(worst.retry_after_seconds);
  }
}
