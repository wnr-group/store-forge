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

/** `GET /public/storefronts/:slug/products/:productSlug`: one active product, as the database function returns it. */
export type PublicProductApi = {
  store: { name: string; slug: string; description: string | null; logo_path: string | null; currency: string };
  product: {
    name: string;
    slug: string;
    description: string | null;
    short_description: string | null;
    product_type: string | null;
    sku: string | null;
    price_minor: number;
    compare_at_price_minor: number | null;
    has_variants: boolean;
    category_name: string | null;
  };
  images: { id: string; path: string; alt: string | null; position: number; is_primary: boolean }[];
  options: { name: string; values: string[] }[];
  variants: {
    id: string;
    title: string;
    options: Record<string, string> | null;
    sku: string | null;
    price_minor: number;
    compare_at_price_minor: number | null;
    image_id: string | null;
  }[];
  related: PublicProductCardApi[];
};

export type PublicProductCardApi = {
  name: string;
  slug: string;
  short_description: string | null;
  price_minor: number;
  compare_at_price_minor: number | null;
  image_path: string | null;
};

export const getPublicProductApi = async (slug: string, productSlug: string) =>
  (await apiRequest<PublicProductApi>(`/public/storefronts/${encodeURIComponent(slug)}/products/${encodeURIComponent(productSlug)}`, { anonymous: true })).data;

/** `GET /public/storefronts/:slug/collections/:collectionSlug`: one active collection with its active products. */
export type PublicCollectionDetailApi = {
  store: PublicProductApi["store"];
  collection: { id: string; name: string; slug: string; description: string | null; image_path: string | null };
  products: PublicProductCardApi[];
};

export const getPublicCollectionApi = async (slug: string, collectionSlug: string) =>
  (await apiRequest<PublicCollectionDetailApi>(`/public/storefronts/${encodeURIComponent(slug)}/collections/${encodeURIComponent(collectionSlug)}`, { anonymous: true })).data;

/** `GET /public/storefronts/:slug/pages[/:pageSlug]`: published content pages only. */
export type PublicPageLinkApi = { title: string; slug: string };
export type PublicPageApi = { store: PublicProductApi["store"]; page: { title: string; slug: string; body: string; updated_at: string } };

export const getPublicPagesApi = async (slug: string) =>
  (await apiRequest<PublicPageLinkApi[]>(`/public/storefronts/${encodeURIComponent(slug)}/pages`, { anonymous: true })).data;

export const getPublicPageApi = async (slug: string, pageSlug: string) =>
  (await apiRequest<PublicPageApi>(`/public/storefronts/${encodeURIComponent(slug)}/pages/${encodeURIComponent(pageSlug)}`, { anonymous: true })).data;

/** The published design of a page assigned to one product or collection (falls back to the store default). */
export const getPublicLayoutForApi = async (slug: string, kind: "product" | "collection", resource: string) =>
  (await apiRequest<PublicLayoutApi>(`/public/storefronts/${encodeURIComponent(slug)}/layout`, { anonymous: true, query: { kind, resource } })).data;
