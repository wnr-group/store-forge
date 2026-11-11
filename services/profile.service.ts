import "server-only";
import { cookies } from "next/headers";
import { applySetCookies, authApi } from "@/lib/auth/nest-api";
import { getProfileApi, updateProfileApi } from "@/lib/api/endpoints/profile-api";

/**
 * The name shown in the account menu comes from the access token, so rotate the session once to put the new name in it
 * (best effort: until the next refresh the menu would otherwise show the old name).
 */
async function refreshSessionName(): Promise<void> {
  try {
    const store = await cookies();
    const result = await authApi("/auth/refresh", { method: "POST", cookieHeader: store.toString() });
    if (result.ok) applySetCookies(store, result.setCookies);
  } catch {
    /* the next automatic refresh picks the name up */
  }
}

/** Updates the signed-in user's own display name (`PATCH /users/me`; the API keeps the Auth display name in step). */
export async function updateOwnName(fullName: string): Promise<void> {
  await updateProfileApi(fullName);
  await refreshSessionName();
}

export async function getOwnProfile(): Promise<{ fullName: string | null }> {
  return { fullName: (await getProfileApi()).fullName };
}
