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

/** `GET /public/storefronts/:slug/layout`: the PUBLISHED design of a page. Drafts are never returned; anything unpublished is null. */
export type PublicLayoutApi = {
  source: "assigned" | "default" | null;
  template: { name: string; version_number: number; document: Record<string, unknown> } | null;
  theme: Record<string, unknown> | null;
  groups: { header?: Record<string, unknown> | null; footer?: Record<string, unknown> | null; announcement?: Record<string, unknown> | null };
};

export const getPublicLayoutApi = async (slug: string, kind: "index" | "product" | "collection" = "index") =>
  (await apiRequest<PublicLayoutApi>(`/public/storefronts/${encodeURIComponent(slug)}/layout`, { anonymous: true, query: { kind } })).data;

/** `GET /public/storefronts/:slug/collections` */
export type PublicCollectionApi = { id: string; name: string; slug: string; description: string | null; image_path: string | null; product_count: number };

export const getPublicCollectionsApi = async (slug: string) =>
  (await apiRequest<PublicCollectionApi[]>(`/public/storefronts/${encodeURIComponent(slug)}/collections`, { anonymous: true })).data;
