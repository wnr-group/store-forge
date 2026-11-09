import "server-only";
import { sql } from "drizzle-orm";
import { getDatabase } from "@/lib/db";
import { rowsOf, withPublicContext } from "@/lib/db/user-context";

/**
 * The cutover gate (option B). The ONLY source of truth is the persisted marker behind public.template_engine_cutover_complete();
 * there is no environment flag, cache or in-memory copy that could disagree with it.
 *
 * Fail-closed: engine reads are allowed only when that function returns exactly `true`. A missing or incomplete marker, a missing
 * function (migration 0016 not applied), a non-boolean answer or ANY error (database down, timeout, permission) means CLOSED.
 * Every code path that reads template engine data must go through `assertEngineReadsEnabled` / `isEngineReadEnabled`.
 */
export class EngineReadsDisabledError extends Error {
  constructor(message = "Template engine reads are not enabled yet (cutover not complete).", options?: { cause?: unknown }) {
    super(message, options);
    this.name = "EngineReadsDisabledError";
  }
}

export async function isEngineReadEnabled(): Promise<boolean> {
  try {
    const rows = rowsOf<{ ok: unknown }>(
      await withPublicContext(getDatabase(), (tx) => tx.execute(sql`select public.template_engine_cutover_complete() as ok`)),
    );
    return rows[0]?.ok === true;
  } catch {
    return false;
  }
}

export async function assertEngineReadsEnabled(): Promise<void> {
  if (!(await isEngineReadEnabled())) throw new EngineReadsDisabledError();
}
