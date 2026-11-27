/**
 * The published catalog hierarchy as the public API returns it (`GET /public/storefronts/:slug/catalog/...`, see the API's
 * `public-catalog.dto.ts`). Plain types and constants, safe for server and browser code: the same shape feeds every storefront template.
 */

export type PublicCatalogLevel = { id: string; name: string; position: number; canHoldProducts: boolean };

export type PublicCatalogNode = {
  id: string;
  parentId: string | null;
  levelId: string;
  name: string;
  slug: string;
  /** The slugs from the top level down to this item, joined by "/". */
  path: string;
  description: string | null;
  position: number;
  depth: number;
  seoTitle?: string | null;
  seoDescription?: string | null;
  /** The item's picture (a storage path for `publicImageUrl`) and its description; absent or null when it has none. */
  imagePath?: string | null;
  imageAlt?: string | null;
  hasChildren: boolean;
  /** Active products placed directly on this item. */
  productCount: number;
};

export type PublicCatalogStore = { name: string; slug: string; currency: string; description?: string | null; logoPath?: string | null };

/** `hierarchy` is null (and the lists are empty) for a store with no published catalog. */
export type PublicCatalogTree = {
  store: PublicCatalogStore;
  hierarchy: { id: string; name: string } | null;
  levels: PublicCatalogLevel[];
  nodes: PublicCatalogNode[];
  truncated: boolean;
};

export type PublicCatalogBreadcrumb = { id: string; name: string; slug: string; path: string; depth: number; levelId: string; levelName: string };

export type PublicCatalogProduct = {
  name: string;
  slug: string;
  partNumber: string | null;
  shortDescription: string | null;
  priceMinor: number;
  compareAtPriceMinor: number | null;
  imagePath: string | null;
  available: boolean;
};

export const PUBLIC_CATALOG_SORTS = ["position", "newest", "name", "price_asc", "price_desc"] as const;
export type PublicCatalogSort = (typeof PUBLIC_CATALOG_SORTS)[number];

export type PublicCatalogProductPage = { items: PublicCatalogProduct[]; page: number; limit: number; total: number; includeDescendants: boolean };

export type PublicCatalogNodePage = {
  store: PublicCatalogStore;
  hierarchy: { id: string; name: string };
  node: PublicCatalogNode & { level: PublicCatalogLevel };
  breadcrumbs: PublicCatalogBreadcrumb[];
  children: PublicCatalogNode[];
  products: PublicCatalogProductPage;
};
