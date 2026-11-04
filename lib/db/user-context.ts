import { sql, type SQL } from "drizzle-orm";
import type { Database } from "./index";

/**
 * Per-request database identity for row level security.
 *
 * The app connects as `storeforge_app` (a login role with no privileges of its
 * own). For every request we open a transaction and, TRANSACTION-LOCALLY:
 *   1. publish the verified user's id as the Supabase-style JWT claims that
 *      auth.uid() reads, and
 *   2. SET LOCAL ROLE authenticated, so the same RLS policies that guard
 *      PostgREST guard these queries.
 * `set_config(..., true)` and `SET LOCAL` are discarded at COMMIT/ROLLBACK, so
 * a pooled connection can never carry one request's identity into the next.
 *
 * This module is driver-agnostic and has no `server-only` import so the same
 * code path is exercised by the PGlite security tests.
 */

/** Hard-coded on purpose: the role is never derived from any input. */
const REQUEST_ROLE_SQL = sql.raw("set local role authenticated");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type DbTx = Parameters<Parameters<Database["transaction"]>[0]>[0];

export class RlsGuardError extends Error {
  constructor(message: string) {
    super(`RLS guard failed: ${message}`);
    this.name = "RlsGuardError";
  }
}

/** Normalises `tx.execute()` results across drivers (postgres-js: array; pglite: { rows }). */
export function rowsOf<T = Record<string, unknown>>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const rows = (result as { rows?: unknown } | null)?.rows;
  return Array.isArray(rows) ? (rows as T[]) : [];
}

// Connections that already passed the guard (checked once per client, not per request).
const verified = new WeakSet<object>();

/**
 * Refuses to run if RLS could be bypassed: the login role or the request role
 * is a superuser / has BYPASSRLS, or the role switch didn't take effect.
 * Runs inside the first request transaction, after SET LOCAL ROLE.
 */
async function assertRlsEnforced(tx: DbTx) {
  const rows = rowsOf<{ current_user: string; session_user: string; bad_roles: string[] | null }>(
    await tx.execute(sql`
      select current_user, session_user,
        (select array_agg(rolname) from pg_roles
          where rolname in (current_user, session_user) and (rolsuper or rolbypassrls)) as bad_roles
    `),
  );
  const row = rows[0];
  if (!row || row.current_user !== "authenticated") {
    throw new RlsGuardError(`request role is "${row?.current_user}", expected "authenticated"`);
  }
  if (row.bad_roles?.length) {
    throw new RlsGuardError(`role(s) ${row.bad_roles.join(", ")} can bypass row level security`);
  }
}

/**
 * Runs `fn` in a transaction acting as `userId`.
 *
 * `userId` MUST come from a server-validated Supabase session
 * (`supabase.auth.getUser()`), never from the browser. It is also checked to be
 * a UUID and passed as a bind parameter, never concatenated into SQL.
 * Any error thrown by `fn` rolls the whole transaction back.
 */
export async function withUserContext<T>(db: Database, userId: string, fn: (tx: DbTx) => Promise<T>): Promise<T> {
  if (!UUID.test(userId)) throw new Error("withUserContext: userId must be a UUID");
  const claims = JSON.stringify({ sub: userId, role: "authenticated" });

  return db.transaction(async (tx) => {
    const setClaims: SQL = sql`select
      set_config('request.jwt.claims', ${claims}, true),
      set_config('request.jwt.claim.sub', ${userId}, true),
      set_config('request.jwt.claim.role', 'authenticated', true)`;
    await tx.execute(setClaims);
    await tx.execute(REQUEST_ROLE_SQL);

    if (!verified.has(db)) {
      await assertRlsEnforced(tx);
      verified.add(db);
    }
    return fn(tx);
  });
}
