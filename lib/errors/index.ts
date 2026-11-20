import { describeError, logEvent } from "@/lib/observability/log";
import type { ActionResult } from "@/types/action";

export type AppErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "UNKNOWN";

/** An error whose `message` is safe to show to end users. */
export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message: string,
    public readonly fieldErrors?: Record<string, string>,
    /** Typed, allow-listed structured details (for example the rows of a failed import). Never raw API internals. */
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

const GENERIC_MESSAGE = "Something went wrong. Please try again.";

/**
 * Converts anything thrown into a safe ActionResult.
 * Unknown errors (database messages, stack traces, secrets) are logged on the
 * server and replaced with a generic message - never forwarded to the browser.
 */
export function toFailure(error: unknown): Extract<ActionResult, { ok: false }> {
  // Next.js implements redirect()/notFound() by throwing; never swallow those.
  const digest = (error as { digest?: unknown } | null)?.digest;
  if (typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK"))) {
    throw error;
  }
  if (error instanceof AppError) {
    return { ok: false, error: error.message, code: error.code, fieldErrors: error.fieldErrors, details: error.details };
  }
  // Logged without bound SQL parameters, tokens, connection strings or e-mail addresses (see lib/observability/log.ts).
  logEvent("error", "unhandled", { error: describeError(error) });
  return { ok: false, error: GENERIC_MESSAGE, code: "UNKNOWN" };
}
