import "server-only";
import { cache } from "react";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { requirePlatformAdmin, requireSuperAdmin } from "@/lib/auth/platform";
import { getDatabase } from "@/lib/db";
import { withAuthenticatedDb } from "@/lib/db/tenant-db";
import { rowsOf, withPublicContext } from "@/lib/db/user-context";
import type { platformSettingsSchema } from "@/lib/validations/admin-platform";
import { recordAudit } from "@/services/admin-audit.service";
import { mapProvisioningError } from "@/services/platform.service";

/**
 * Platform settings: the values that used to be hardcoded. Stored in a table nobody can reach directly; admins read them
 * through get_platform_settings(), super admins change them through platform_update_settings() (validated again in SQL), and
 * signed-out pages may read only the platform name and a support e-mail. Nothing secret is stored here.
 */

export type PlatformSettingsView = {
  platformName: string;
  supportEmail: string | null;
  defaultCurrency: string;
  defaultTimezone: string;
  defaultStoreStatus: "active" | "inactive";
  /** Added to the built-in reserved list; the built-in names can never be removed. */
  reservedSubdomains: string[];
  updatedAt: Date;
  updatedByEmail: string | null;
};

const raw = z.object({
  platform_name: z.string(),
  support_email: z.string().nullable(),
  default_currency: z.string(),
  default_timezone: z.string(),
  default_store_status: z.enum(["active", "inactive"]),
  reserved_subdomains: z.array(z.string()),
  updated_at: z.union([z.string(), z.date()]),
  updated_by_email: z.string().nullable(),
});

const toView = (r: z.infer<typeof raw>): PlatformSettingsView => ({
  platformName: r.platform_name,
  supportEmail: r.support_email,
  defaultCurrency: r.default_currency,
  defaultTimezone: r.default_timezone,
  defaultStoreStatus: r.default_store_status,
  reservedSubdomains: r.reserved_subdomains,
  updatedAt: new Date(r.updated_at),
  updatedByEmail: r.updated_by_email,
});

type Tx = Parameters<Parameters<typeof withAuthenticatedDb>[0]>[0];
async function fetchSettings(tx: Tx): Promise<PlatformSettingsView> {
  return toView(raw.parse(rowsOf(await tx.execute(sql`select * from public.get_platform_settings()`))[0]));
}

export async function getPlatformSettings(): Promise<PlatformSettingsView> {
  await requirePlatformAdmin();
  return withAuthenticatedDb((tx) => fetchSettings(tx));
}

export type PublicBranding = { platformName: string; supportEmail: string | null };
const DEFAULT_BRANDING: PublicBranding = { platformName: "StoreForge", supportEmail: null };

/**
 * The platform name and support contact, for pages anyone can open (sign-in, "no workspace"). Needs no session. If the
 * database cannot be reached the defaults are used, so a settings problem can never stop someone from signing in.
 */
export const getPublicBranding = cache(async (): Promise<PublicBranding> => {
  try {
    const row = await withPublicContext(getDatabase(), async (tx) =>
      rowsOf<{ platform_name: string; support_email: string | null }>(await tx.execute(sql`select * from public.get_public_platform_settings()`))[0],
    );
    return row ? { platformName: row.platform_name, supportEmail: row.support_email } : DEFAULT_BRANDING;
  } catch (error) {
    console.error("[platform-settings] public branding unavailable, using defaults", error instanceof Error ? error.message : error);
    return DEFAULT_BRANDING;
  }
});

type Next = z.output<typeof platformSettingsSchema>;

const same = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i]);

/** Super admins only. Nothing is written (or logged) when nothing changed; the audit entry lists what did. */
export async function updatePlatformSettings(v: Next): Promise<void> {
  await requireSuperAdmin();
  try {
    await withAuthenticatedDb(async (tx) => {
      const before = await fetchSettings(tx);
      const previous: Record<string, unknown> = {};
      const next: Record<string, unknown> = {};
      const changed: string[] = [];
      const note = (key: string, a: unknown, b: unknown, equal = a === b) => {
        if (equal) return;
        changed.push(key);
        previous[key] = a;
        next[key] = b;
      };
      note("platformName", before.platformName, v.platformName);
      note("supportEmail", before.supportEmail, v.supportEmail);
      note("defaultCurrency", before.defaultCurrency, v.defaultCurrency);
      note("defaultTimezone", before.defaultTimezone, v.defaultTimezone);
      note("defaultStoreStatus", before.defaultStoreStatus, v.defaultStoreStatus);
      note("reservedSubdomains", before.reservedSubdomains, v.reservedSubdomains, same(before.reservedSubdomains, v.reservedSubdomains));
      if (changed.length === 0) return;
      await tx.execute(sql`select public.platform_update_settings(
        ${v.platformName}, ${v.supportEmail}, ${v.defaultCurrency}, ${v.defaultTimezone}, ${v.defaultStoreStatus}, ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(v.reservedSubdomains)}::jsonb)))`);
      await recordAudit(tx, {
        action: "platform_settings.updated",
        entityType: "platform_settings",
        description: `Updated platform settings: ${changed.join(", ")}`,
        previous,
        next,
      });
    });
  } catch (error) {
    return mapProvisioningError(error);
  }
}
