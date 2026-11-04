import "server-only";
import { asc, eq } from "drizzle-orm";
import { stores, type Store } from "@/lib/db/schema";
import { withAuthenticatedDb } from "@/lib/db/tenant-db";

export type { Store };

/**
 * Store queries take an already-authorised tenantId (from getActiveTenant /
 * withTenantDb) and filter on it explicitly. RLS repeats the membership check
 * in the database, so even a wrong tenantId here returns nothing.
 */
export async function listStores(tenantId: string): Promise<Store[]> {
  return withAuthenticatedDb((tx) =>
    tx.select().from(stores).where(eq(stores.tenantId, tenantId)).orderBy(asc(stores.createdAt), asc(stores.id)),
  );
}

/** The tenant's primary (oldest) store. */
export async function getPrimaryStore(tenantId: string): Promise<Store | null> {
  return withAuthenticatedDb(async (tx) => {
    const [store] = await tx
      .select()
      .from(stores)
      .where(eq(stores.tenantId, tenantId))
      .orderBy(asc(stores.createdAt), asc(stores.id))
      .limit(1);
    return store ?? null;
  });
}

/**
 * The tenant that owns the store with this slug - but only if the signed-in user is a member of it:
 * RLS hides every other tenant's stores, so a non-member (or a suspended company) gets null.
 */
export async function getTenantIdForStoreSlug(slug: string): Promise<string | null> {
  return withAuthenticatedDb(async (tx) => {
    const [row] = await tx.select({ tenantId: stores.tenantId }).from(stores).where(eq(stores.slug, slug)).limit(1);
    return row?.tenantId ?? null;
  });
}
