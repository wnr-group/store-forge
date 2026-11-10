import { toFailure } from "@/lib/errors";
import { logEvent } from "@/lib/observability/log";
import type { ActionResult } from "@/types/action";

type Options = {
  /** Names the action in the structured log, e.g. "admin.org.create". Omit for actions that should not be logged. */
  operation?: string;
};

/**
 * Wraps a server action body: unknown errors are logged and replaced by a safe
 * message; AppErrors (validation, permission...) are returned as-is. Redirects
 * rethrow. Call redirect()/revalidatePath() outside or after `run` as appropriate.
 *
 * With an `operation`, one structured event is written per call: operation, outcome, error code and duration. Never the input.
 */
export async function run<T = undefined>(fn: () => Promise<T>, options: Options = {}): Promise<ActionResult<T>> {
  const started = Date.now();
  try {
    const data = await fn();
    if (options.operation) logEvent("info", "action", { operation: options.operation, outcome: "ok", durationMs: Date.now() - started });
    return { ok: true, data };
  } catch (e) {
    const failure = toFailure(e); // rethrows redirects and not-found; logs unexpected errors (cleaned)
    if (options.operation) {
      logEvent(failure.code === "UNKNOWN" ? "error" : "warn", "action", {
        operation: options.operation,
        outcome: "failed",
        code: failure.code,
        durationMs: Date.now() - started,
      });
    }
    return failure;
  }
}
