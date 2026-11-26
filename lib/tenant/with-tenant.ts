import "server-only";
import type { Permission } from "@/lib/auth/permissions";
import { requireActiveTenant } from "@/lib/tenant/context";

/**
 * Runs one API call for the ACTIVE tenant after checking `permission` (the API checks it again). The organization id is never
 * an argument of a service function: it always comes from the verified session membership.
 */
export async function withTenant<T>(permission: Permission, call: (organizationId: string) => Promise<T>): Promise<T> {
  const { tenant } = await requireActiveTenant(permission);
  return call(tenant.id);
}
