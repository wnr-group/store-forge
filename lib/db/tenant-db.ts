import "server-only";
import { getCurrentUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { getDatabase } from "./index";
import { withUserContext, type DbTx } from "./user-context";

export type { DbTx } from "./user-context";

/**
 * The ONLY way application code should query the database.
 *
 * 1. Validates the Supabase Auth session on the server (getUser()).
 * 2. Opens a transaction acting as that user (row level security applies).
 * 3. Commits on success, rolls back if `fn` throws.
 *
 * It deliberately accepts no user id: identity can only come from the
 * validated session, so a caller cannot act as someone else.
 */
export async function withAuthenticatedDb<T>(fn: (tx: DbTx, user: { id: string }) => Promise<T>): Promise<T> {
  const user = await getCurrentUser();
  if (!user) throw new AppError("UNAUTHENTICATED", "Your session has expired. Please sign in again.");
  return withUserContext(getDatabase(), user.id, (tx) => fn(tx, { id: user.id }));
}
