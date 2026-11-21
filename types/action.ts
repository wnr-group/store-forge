/** Uniform return type for server actions invoked from client forms. */
export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | {
      ok: false;
      error: string;
      code?: string;
      fieldErrors?: Record<string, string>;
      /** Structured details for allow-listed failures (see lib/api/client.ts); undefined for everything else. */
      details?: unknown;
    };
