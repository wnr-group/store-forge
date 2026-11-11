import "server-only";
import { apiRequest } from "@/lib/api/client";

/** `GET /public/storefronts/:slug`: public data of an active store, no session. `template` is the database's own JSON, unchanged. */
export type StorefrontApi = {
  name: string;
  slug: string;
  description: string | null;
  logoPath: string | null;
  currency: string;
  products: {
    name: string;
    slug: string;
    shortDescription: string | null;
    priceMinor: number;
    compareAtPriceMinor: number | null;
    imagePath: string | null;
  }[];
  template: Record<string, unknown> | null;
};

export const getStorefrontApi = async (slug: string) =>
  (await apiRequest<StorefrontApi>(`/public/storefronts/${encodeURIComponent(slug)}`, { anonymous: true })).data;
