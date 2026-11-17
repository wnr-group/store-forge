import { ROUTES } from "@/config/app";

/** The part of the API's sign-in profile that decides where a user lands. */
export type SignInIdentity = { platformAdminLevel: string | null; membershipCount: number };

/**
 * Where a user lands after signing in without a specific destination. Mirrors `requireWorkspace`: a user with a workspace
 * gets its dashboard; a Platform Admin with no workspace belongs in the admin area (so they skip a `/dashboard` hop that
 * would only redirect them there). Both facts come from the API's own answer (database-backed), never from the browser.
 * `/dashboard` and the admin pages still authorise on every request, so this only saves a redirect.
 */
export function defaultHomePath(identity: SignInIdentity | null): string {
  if (identity && identity.membershipCount === 0 && identity.platformAdminLevel !== null) return ROUTES.admin;
  return ROUTES.dashboard;
}

/** Reads the identity out of the API's login `data`, or null when it is missing or not shaped as expected. */
export function identityFromLogin(data: unknown): SignInIdentity | null {
  if (!data || typeof data !== "object") return null;
  const { platformAdminLevel, memberships } = data as { platformAdminLevel?: unknown; memberships?: unknown };
  if (!Array.isArray(memberships) || (platformAdminLevel !== null && typeof platformAdminLevel !== "string")) return null;
  return { platformAdminLevel, membershipCount: memberships.length };
}
