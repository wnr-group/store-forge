import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { authUsers } from "drizzle-orm/supabase";
import { MEMBERSHIP_ROLES } from "./enums";
import { tenants } from "./tenants";

/** User <-> tenant link carrying the role. The 'owner' row is created only by onboarding. */
export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    role: text("role", { enum: MEMBERSHIP_ROLES }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("memberships_tenant_id_user_id_key").on(t.tenantId, t.userId),
    check("memberships_role_check", sql`${t.role} in ('owner', 'admin', 'staff')`),
    index("memberships_user_id_idx").on(t.userId),
  ],
).enableRLS();

export type Membership = typeof memberships.$inferSelect;
