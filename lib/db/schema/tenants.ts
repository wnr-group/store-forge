import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { authUsers } from "drizzle-orm/supabase";
import { SLUG_PATTERN } from "./enums";

/** A merchant organisation. Created only through create_tenant_with_store(). */
export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    createdBy: uuid("created_by").references(() => authUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("tenants_slug_key").on(t.slug),
    check("tenants_name_check", sql`char_length(btrim(${t.name})) between 2 and 80`),
    check("tenants_slug_check", sql`${t.slug} ~ ${sql.raw(`'${SLUG_PATTERN}'`)}`),
    index("tenants_created_by_idx").on(t.createdBy),
  ],
).enableRLS();

export type Tenant = typeof tenants.$inferSelect;
