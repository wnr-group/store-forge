import "server-only";
import { apiRequest } from "@/lib/api/client";
import type { StoreApi } from "@/lib/api/endpoints/store-api";

/** `GET /organizations` and `GET /organizations/current` of the StoreForge API. Dates are ISO strings. */
export type OrganizationSummaryApi = {
  id: string;
  name: string;
  slug: string;
  /** Read-only public identifier of the organization (the suffix of its storefront address). */
  publicId: string;
  role: string;
  permissions: Record<string, string>;
  /** Independent grants ('attest', 'discard'); the Owner holds all of them. */
  capabilities?: string[];
  joinedAt: string;
};

export type CurrentOrganizationApi = {
  organization: { id: string; name: string; slug: string; publicId: string };
  role: string;
  roleLabel: string;
  permissions: Record<string, string>;
  capabilities?: string[];
  access: { module: string; label: string; level: string }[];
  store: StoreApi | null;
};

/** The organizations the signed-in user is an active member of. No organization header. */
export const listMyOrganizationsApi = async () => (await apiRequest<OrganizationSummaryApi[]>("/organizations")).data;

/** The named organization with its primary store. The API answers 403 when the user is not a member. */
export const getCurrentOrganizationApi = async (organizationId: string) =>
  (await apiRequest<CurrentOrganizationApi>("/organizations/current", { organizationId })).data;
