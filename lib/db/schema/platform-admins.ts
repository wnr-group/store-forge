import { pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { authUsers } from "drizzle-orm/supabase";

/**
 * StoreForge Platform Admins. Deliberately separate from `memberships`/roles: tenant
 * roles never imply platform authority. No privileges are granted to anon/authenticated
 * and there are no policies, so the table is unreachable from the API; rows are added
 * only by the privileged `npm run admin:create` script. The app asks "am I an admin?"
 * through public.is_platform_admin(), which reads auth.uid() only.
 */
export const platformAdmins = pgTable("platform_admins", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

export type PlatformAdmin = typeof platformAdmins.$inferSelect;
