import type { Role } from "@/lib/auth/permissions";
import type { MemberPermissions } from "@/lib/domain/enums";

/** Memberships come from the StoreForge API (`GET /organizations`); see `lib/tenant/api-workspace.ts`. */
export type TenantSummary = { id: string; name: string; slug: string };
export type TenantMembership = { tenant: TenantSummary; role: Role; permissions: MemberPermissions; joinedAt: Date };
