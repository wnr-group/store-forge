import { toFailure } from "@/lib/errors";
import type { ActionResult } from "@/types/action";

/**
 * Wraps a server action body: unknown errors are logged and replaced by a safe
 * message; AppErrors (validation, permission...) are returned as-is. Redirects
 * rethrow. Call redirect()/revalidatePath() outside or after `run` as appropriate.
 */
export async function run<T = undefined>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    return toFailure(e);
  }
}
