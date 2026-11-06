import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { stores, storeTemplateSettings } from "@/lib/db/schema";
import { mapErrors } from "@/lib/db/errors";
import { upsertTemplateSettings } from "@/lib/db/template-settings-upsert";
import { AppError } from "@/lib/errors";
import { storeFolder } from "@/lib/storage/paths";
import { removeObjects, verifyObjects } from "@/lib/storage/server";
import type { SavedTemplateSettings } from "@/lib/templates/types";
import { requireActiveTenant, withTenantDb } from "@/lib/tenant/context";
import { parseInput } from "@/lib/validations/parse";
import { templateSettingsSchema, type TemplateSettingsValues } from "@/lib/validations/templates";

export type StoredTemplateSettings = SavedTemplateSettings & { updatedAt: string };

/**
 * The primary store's saved template settings, or null when none are saved (the default template applies).
 * Any member may read; RLS repeats the membership check.
 */
export async function getTemplateSettings(): Promise<StoredTemplateSettings | null> {
  return withTenantDb({}, async (tx, ctx) => {
    const [store] = await tx.select({ id: stores.id }).from(stores).where(eq(stores.tenantId, ctx.tenantId)).orderBy(asc(stores.createdAt), asc(stores.id)).limit(1);
    if (!store) return null;
    const [row] = await tx
      .select()
      .from(storeTemplateSettings)
      .where(and(eq(storeTemplateSettings.storeId, store.id), eq(storeTemplateSettings.tenantId, ctx.tenantId)))
      .limit(1);
    if (!row) return null;
    return {
      templateKey: row.templateKey,
      accentColor: row.accentColor,
      heroHeading: row.heroHeading,
      heroSubheading: row.heroSubheading,
      heroImagePath: row.heroImagePath,
      updatedAt: row.updatedAt.toISOString(),
    };
  });
}

/**
 * Owner/manager only (enforced here AND by the table's RLS and grants). One upsert persists the template and all
 * four values. The hero image must be an existing object directly under this tenant's `store/` folder. The store
 * row is locked first, and the same lock is taken by updateStoreSettings, so a path can never become both the
 * logo and the hero image. The previous hero file is removed only after the save commits; a cleanup failure is
 * logged and never fails the save.
 */
export async function saveTemplateSettings(input: TemplateSettingsValues): Promise<void> {
  const v = parseInput(templateSettingsSchema, input);
  const { tenant } = await requireActiveTenant("store:manage");
  const hero = v.heroImagePath ? (await verifyObjects(storeFolder(tenant.id), [v.heroImagePath]))[0] : null;
  const previousHero = await mapErrors(() =>
    withTenantDb({ tenantId: tenant.id, permission: "store:manage" }, async (tx, ctx) => {
      const [store] = await tx
        .select({ id: stores.id, logoUrl: stores.logoUrl })
        .from(stores)
        .where(eq(stores.tenantId, ctx.tenantId))
        .orderBy(asc(stores.createdAt), asc(stores.id))
        .limit(1)
        .for("update");
      if (!store) throw new AppError("NOT_FOUND", "This workspace does not have a store.");
      if (hero && hero.path === store.logoUrl) {
        throw new AppError("VALIDATION", "That image is already used as the store logo. Upload a different image.", { heroImagePath: "Already used as the store logo" });
      }
      const [existing] = await tx.select({ path: storeTemplateSettings.heroImagePath }).from(storeTemplateSettings).where(eq(storeTemplateSettings.storeId, store.id)).limit(1);
      await upsertTemplateSettings(tx, {
        storeId: store.id,
        tenantId: ctx.tenantId,
        templateKey: v.templateKey,
        accentColor: v.accentColor,
        heroHeading: v.heroHeading,
        heroSubheading: v.heroSubheading,
        heroImagePath: hero?.path ?? null,
      });
      return existing?.path ?? null;
    }),
  );
  if (previousHero && previousHero !== (hero?.path ?? null)) {
    try {
      await removeObjects([previousHero]);
    } catch (e) {
      console.error("[templates] previous hero image was not removed and is now orphaned:", previousHero, e);
    }
  }
}
