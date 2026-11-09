import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

/**
 * Internal notes Platform Admins keep about an organization. Never visible to the organization: the table has no
 * grants and no policies, and is reached only through admin-only SQL functions. Only the author can edit a note;
 * nothing deletes one except the organization itself being deleted. `author_id` is not a foreign key, so a note
 * outlives its author's account, and the author's e-mail is copied in.
 */
export const organizationSupportNotes = pgTable(
  "organization_support_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").notNull(),
    authorEmail: text("author_email").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("organization_support_notes_body_check", sql`char_length(btrim(${t.body})) between 1 and 2000`),
    index("organization_support_notes_tenant_idx").on(t.tenantId, t.createdAt.desc()),
    index("organization_support_notes_created_idx").on(t.createdAt.desc()),
  ],
).enableRLS();

export type OrganizationSupportNote = typeof organizationSupportNotes.$inferSelect;
