/**
 * Saving the editor's drafts, one run at a time, and waiting for a run that is already going.
 *
 * Autosave starts a run; Publish must not start another beside it, and must not read "a save is already running" as "the
 * save failed". `createFlusher` guarantees a single run in flight (a second `flush()` joins it) and `settle` waits for that
 * run, then saves again if anything was edited meanwhile, a bounded number of times. Plain data and promises, no React,
 * so every rule is unit-tested.
 */

export type FlushFailure = "conflict" | "validation" | "error" | "busy";

export type FlushResult = { ok: true } | { ok: false; reason: FlushFailure; message?: string };

export type Flusher = {
  /** Starts a save run, or joins the one already running (never two at once). */
  flush: () => Promise<FlushResult>;
  /** True while a run is in flight. */
  isRunning: () => boolean;
  /** Replaces the function a run executes (the editor passes its latest one; a run already in flight is not affected). */
  setRun: (runOnce: () => Promise<FlushResult>) => void;
  /**
   * Waits until everything is saved: first for a run in flight, then (if `isClean` says something is still unsaved, for
   * example typed while that run was finishing) for further runs, at most `maxPasses` of them. Stops at the first failure and
   * returns it. If edits keep coming past the bound the result is `busy`: nothing is reported as saved that is not.
   */
  settle: (isClean: () => boolean, maxPasses?: number) => Promise<FlushResult>;
};

export const SETTLE_PASSES = 3;

export function createFlusher(initialRun: () => Promise<FlushResult> = async () => ({ ok: true })): Flusher {
  let runOnce = initialRun;
  let inFlight: Promise<FlushResult> | null = null;

  const flush = (): Promise<FlushResult> => {
    if (inFlight) return inFlight;
    const run = (async (): Promise<FlushResult> => {
      try {
        return await runOnce();
      } catch {
        // A run that throws is a failed save, never an unhandled rejection for whoever joined it.
        return { ok: false, reason: "error" };
      } finally {
        inFlight = null;
      }
    })();
    inFlight = run;
    return run;
  };

  const settle = async (isClean: () => boolean, maxPasses = SETTLE_PASSES): Promise<FlushResult> => {
    for (let pass = 0; pass <= maxPasses; pass += 1) {
      if (inFlight) {
        const result = await inFlight;
        if (!result.ok) return result;
      }
      if (isClean()) return { ok: true };
      if (pass === maxPasses) break;
      const result = await flush();
      if (!result.ok) return result;
    }
    return isClean() ? { ok: true } : { ok: false, reason: "busy" };
  };

  return {
    flush,
    isRunning: () => inFlight !== null,
    setRun: (next) => {
      runOnce = next;
    },
    settle,
  };
}

/** What to tell the owner when a publish stopped because saving did not complete. Each reason says what is actually wrong. */
export function saveFailureMessage(result: Extract<FlushResult, { ok: false }>): string {
  switch (result.reason) {
    case "conflict":
      return "Someone else changed this design. Load the latest version first, then publish.";
    case "validation":
      return "Fix the highlighted problems before publishing.";
    case "busy":
      return "You kept editing while your changes were being saved. Click Publish again.";
    default:
      return result.message ?? "Your changes could not be saved. Please try again.";
  }
}
