import "server-only";
import { isRole } from "@/lib/auth/permissions";
import { getCurrentOrganizationApi, listMyOrganizationsApi, type OrganizationSummaryApi } from "@/lib/api/endpoints/organization-api";
import type { StoreApi } from "@/lib/api/endpoints/store-api";
import type { MemberPermissions } from "@/lib/domain/enums";
import { AppError } from "@/lib/errors";
import { resolveActiveTenant } from "@/lib/tenant/resolve";
import type { Store } from "@/services/store.service";
import type { TenantMembership } from "@/services/tenant.service";

export type WorkspaceData = { memberships: TenantMembership[]; active: TenantMembership | null; store: Store | null };

const toMembership = (o: OrganizationSummaryApi): TenantMembership => ({
  tenant: { id: o.id, name: o.name, slug: o.slug, publicId: o.publicId },
  role: o.role as TenantMembership["role"],
  permissions: o.permissions as MemberPermissions,
  joinedAt: new Date(o.joinedAt),
});

const toStore = (s: StoreApi, tenantId: string): Store => ({
  id: s.id,
  tenantId,
  name: s.name,
  slug: s.slug,
  description: s.description,
  logoUrl: s.logoPath,
  contactEmail: s.contactEmail,
  contactPhone: s.contactPhone,
  currency: s.currency,
  timezone: s.timezone,
  status: s.status as Store["status"],
  createdAt: new Date(s.createdAt),
  updatedAt: new Date(s.updatedAt),
});

/**
 * Memberships, the active tenant and its primary store, all from the StoreForge API.
 *
 * `storeSlug` (the host's store) and `preferredId` (the cookie) only SELECT among the memberships the API returned; the
 * API verifies membership again for every call that names an organization. A forged id or slug matches nothing.
 *
 * On a store host the slug is matched against the primary store of each of the user's organizations
 * (`GET /organizations/current`, in parallel). There is no endpoint that maps a store address to an organization for a
 * signed-in member, so this costs one call per membership (see docs/FULL_APPLICATION_API_MIGRATION_STATUS.md).
 */
export async function loadWorkspaceViaApi(storeSlug: string | null, preferredId: string | undefined): Promise<WorkspaceData> {
  const memberships = (await listMyOrganizationsApi()).filter((o) => isRole(o.role)).map(toMembership);
  if (memberships.length === 0) return { memberships, active: null, store: null };

  if (storeSlug) {
    const looked = await Promise.all(
      memberships.map(async (m) => {
        try {
          return { m, store: (await getCurrentOrganizationApi(m.tenant.id)).store };
        } catch (error) {
          // A suspended organization or a revoked membership simply does not match this host.
          if (error instanceof AppError && (error.code === "FORBIDDEN" || error.code === "NOT_FOUND")) return { m, store: null };
          throw error;
        }
      }),
    );
    const hit = looked.find((l) => l.store?.slug === storeSlug);
    return { memberships, active: hit?.m ?? null, store: hit?.store ? toStore(hit.store, hit.m.tenant.id) : null };
  }

  const active = resolveActiveTenant(memberships, preferredId);
  if (!active) return { memberships, active: null, store: null };
  const current = await getCurrentOrganizationApi(active.tenant.id);
  return { memberships, active, store: current.store ? toStore(current.store, active.tenant.id) : null };
}
