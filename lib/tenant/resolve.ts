/**
 * Pure active-tenant resolution. `memberships` must come from the database for
 * the validated user; `preferredId` is untrusted (cookie / client). A
 * preference that does not match a real membership is ignored.
 */
export function resolveActiveTenant<T extends { tenant: { id: string } }>(
  memberships: readonly T[],
  preferredId: string | null | undefined,
): T | null {
  if (memberships.length === 0) return null;
  return memberships.find((m) => m.tenant.id === preferredId) ?? memberships[0];
}
