import "server-only";
import { eq } from "drizzle-orm";
import { profiles } from "@/lib/db/schema";
import { withAuthenticatedDb } from "@/lib/db/tenant-db";
import { AppError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

/** Updates the signed-in user's own display name (profiles RLS allows only the own row). */
export async function updateOwnName(fullName: string): Promise<void> {
  await withAuthenticatedDb(async (tx, user) => {
    const rows = await tx.update(profiles).set({ fullName }).where(eq(profiles.id, user.id)).returning({ id: profiles.id });
    if (!rows.length) throw new AppError("NOT_FOUND", "Your profile could not be found.");
  });
  // Keep the Auth metadata (shown in the account menu) in step with the profile row.
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ data: { full_name: fullName } });
  if (error) console.error("[profile] auth metadata update failed", error.message);
}

export async function getOwnProfile(): Promise<{ fullName: string | null }> {
  return withAuthenticatedDb(async (tx, user) => {
    const [p] = await tx.select({ fullName: profiles.fullName }).from(profiles).where(eq(profiles.id, user.id));
    return { fullName: p?.fullName ?? null };
  });
}
