import "server-only";
import { apiRequest } from "@/lib/api/client";

/** `GET/PATCH /store` of the StoreForge API. */
export type StoreApi = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoPath: string | null;
  /** SEO title and description of the storefront home page (max 70 / 160 characters). Null: the store name / description are used. */
  metaTitle: string | null;
  metaDescription: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  currency: string;
  timezone: string;
  status: string;
  /** True once the organization has products or orders: the currency can no longer change. */
  currencyLocked: boolean;
  createdAt: string;
  updatedAt: string;
};

export type StoreApiInput = {
  name: string;
  slug: string;
  description: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  currency: string;
  timezone: string;
  logoPath: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
};

export const getStoreApi = async (organizationId: string) => (await apiRequest<StoreApi>("/store", { organizationId })).data;

export const updateStoreApi = async (organizationId: string, input: StoreApiInput) =>
  (await apiRequest<StoreApi>("/store", { method: "PATCH", json: input, organizationId })).data;
