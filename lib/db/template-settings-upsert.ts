import { sql } from "drizzle-orm";
import type { DbTx } from "@/lib/db/tenant-db";

export type TemplateSettingsRow = {
  storeId: string;
  tenantId: string;
  templateKey: string;
  accentColor: string | null;
  heroHeading: string | null;
  heroSubheading: string | null;
  heroImagePath: string | null;
};

/**
 * Insert or update the one settings row of a store. This is written as explicit SQL on purpose: the app role may
 * only INSERT the seven columns listed below (never `updated_at`, which a trigger maintains), and Drizzle's insert
 * builder names every column (with DEFAULT for `updated_at`), which PostgreSQL rejects as a column-privilege error.
 * The conflict branch only touches the five customization columns, so tenant_id and store_id can never change.
 */
export async function upsertTemplateSettings(tx: Pick<DbTx, "execute">, row: TemplateSettingsRow): Promise<void> {
  await tx.execute(sql`
    insert into public.store_template_settings
      (store_id, tenant_id, template_key, accent_color, hero_heading, hero_subheading, hero_image_path)
    values
      (${row.storeId}, ${row.tenantId}, ${row.templateKey}, ${row.accentColor}, ${row.heroHeading}, ${row.heroSubheading}, ${row.heroImagePath})
    on conflict (store_id) do update set
      template_key = excluded.template_key,
      accent_color = excluded.accent_color,
      hero_heading = excluded.hero_heading,
      hero_subheading = excluded.hero_subheading,
      hero_image_path = excluded.hero_image_path
  `);
}
