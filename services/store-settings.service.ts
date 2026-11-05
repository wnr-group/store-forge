import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { orders, products, stores } from "@/lib/db/schema";
import { mapErrors } from "@/lib/db/errors";
import { rowsOf } from "@/lib/db/user-context";
import { AppError } from "@/lib/errors";
import { storeFolder } from "@/lib/storage/paths";
import { removeObjects, verifyObjects } from "@/lib/storage/server";
import { requireActiveTenant, withTenantDb } from "@/lib/tenant/context";

export type StoreSettingsValues = {
  name: string;
  slug: string;
  description: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  currency: string;
  timezone: string;
  logoPath: string | null;
};

/**
 * Owner/admin only (enforced here AND by the stores UPDATE policy). The logo must be an
 * existing object under this tenant's `store/` folder; the previous logo file is removed
 * after the update commits.
 */
export async function updateStoreSettings(v: StoreSettingsValues): Promise<void> {
  const { tenant } = await requireActiveTenant("store:manage");
  const logo = v.logoPath ? (await verifyObjects(storeFolder(tenant.id), [v.logoPath]))[0] : null;
  const previousLogo = await mapErrors(() =>
    withTenantDb({ tenantId: tenant.id, permission: "store:manage" }, async (tx, ctx) => {
      const [store] = await tx.select().from(stores).where(eq(stores.tenantId, ctx.tenantId)).orderBy(asc(stores.createdAt), asc(stores.id)).limit(1);
      if (!store) throw new AppError("NOT_FOUND", "This workspace does not have a store.");
      if (v.slug !== store.slug) {
        const rows = rowsOf<{ ok: boolean }>(await tx.execute(sql`select public.is_store_slug_available(${v.slug}) as ok`));
        if (!rows[0]?.ok) throw new AppError("CONFLICT", "That store address is not available.", { slug: "This store address is not available." });
      }
      if (v.currency !== store.currency && (await hasMoneyData(tx, ctx.tenantId)))
        throw new AppError("VALIDATION", "Currency cannot be changed once you have products or orders.", { currency: "Locked: prices already exist" });
      if (v.timezone && !isValidTimeZone(v.timezone)) throw new AppError("VALIDATION", "Unknown timezone.", { timezone: "Choose a valid timezone" });
      await tx
        .update(stores)
        .set({
          name: v.name,
          slug: v.slug,
          description: v.description,
          contactEmail: v.contactEmail,
          contactPhone: v.contactPhone,
          currency: v.currency,
          timezone: v.timezone,
          logoUrl: logo?.path ?? null,
        })
        .where(and(eq(stores.id, store.id), eq(stores.tenantId, ctx.tenantId)));
      return store.logoUrl;
    }),
  );
  if (previousLogo && previousLogo !== (logo?.path ?? null)) await removeObjects([previousLogo]);
}

type Tx = Parameters<Parameters<typeof withTenantDb>[1]>[0];

/** Amounts are stored in the currency's minor units, so the currency is fixed once any exist. */
async function hasMoneyData(tx: Tx, tenantId: string): Promise<boolean> {
  const [p] = await tx.select({ id: products.id }).from(products).where(eq(products.tenantId, tenantId)).limit(1);
  if (p) return true;
  const [o] = await tx.select({ id: orders.id }).from(orders).where(eq(orders.tenantId, tenantId)).limit(1);
  return Boolean(o);
}

export async function isCurrencyLocked(): Promise<boolean> {
  return withTenantDb({}, (tx, ctx) => hasMoneyData(tx, ctx.tenantId));
}

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
