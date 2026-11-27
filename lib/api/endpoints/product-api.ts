import "server-only";
import { apiRequest, type PageMeta } from "@/lib/api/client";

/** `/products` of the StoreForge API. Dates arrive as ISO strings; money fields ending in `Minor` are minor units. */
export type ProductListItemApi = {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  /** Not unique and never replaces the SKU. Optional so an API that predates it still parses. */
  partNumber?: string | null;
  status: string;
  priceMinor: number;
  hasVariants: boolean;
  variantCount: number;
  trackInventory: boolean;
  stock: number;
  lowStockThreshold: number;
  categoryName: string | null;
  imagePath: string | null;
  updatedAt: string;
  createdAt: string;
};

export type ProductOptionApi = { id: string; name: string; position: number; values: string[] };
export type ProductVariantApi = {
  id: string;
  title: string;
  options: Record<string, string>;
  sku: string | null;
  priceMinor: number;
  compareAtPriceMinor: number | null;
  quantity: number;
  imageId: string | null;
  isActive: boolean;
  position: number;
};
export type ProductImageApi = {
  id: string;
  storagePath: string;
  altText: string | null;
  position: number;
  isPrimary: boolean;
  mimeType: string;
  sizeBytes: number;
};

export type ProductDetailApi = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  shortDescription: string | null;
  productType: string | null;
  categoryId: string | null;
  sku: string | null;
  partNumber?: string | null;
  priceMinor: number;
  compareAtPriceMinor: number | null;
  costMinor: number | null;
  hasVariants: boolean;
  trackInventory: boolean;
  quantity: number;
  lowStockThreshold: number;
  weightGrams: number;
  taxRateBps: number | null;
  hsnCode: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  options: ProductOptionApi[];
  variants: ProductVariantApi[];
  images: ProductImageApi[];
  collectionIds: string[];
};

export type ProductListApiQuery = {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  category?: string;
  stock?: string;
  sortBy?: "createdAt" | "name" | "price";
  sortOrder?: "asc" | "desc";
};

/** Request body for create (with `id`) and update. Prices are decimal text in the store currency; the API parses them. */
export type ProductApiInput = Record<string, unknown> & { name: string; price: string };

export async function listProductsApi(organizationId: string, query: ProductListApiQuery): Promise<{ items: ProductListItemApi[]; meta: PageMeta }> {
  const { data, meta } = await apiRequest<ProductListItemApi[]>("/products", { organizationId, query });
  return { items: data, meta: meta ?? { page: query.page, limit: query.limit, total: data.length, totalPages: 1 } };
}

export const getProductApi = async (organizationId: string, id: string) =>
  (await apiRequest<ProductDetailApi>(`/products/${id}`, { organizationId })).data;

export const createProductApi = async (organizationId: string, input: ProductApiInput) =>
  (await apiRequest<ProductDetailApi>("/products", { method: "POST", json: input, organizationId })).data;

export const updateProductApi = async (organizationId: string, id: string, input: ProductApiInput) =>
  (await apiRequest<ProductDetailApi>(`/products/${id}`, { method: "PATCH", json: input, organizationId })).data;

export const bulkDeleteProductsApi = async (organizationId: string, ids: string[]) =>
  (await apiRequest<{ count: number }>("/products/bulk-delete", { method: "POST", json: { ids }, organizationId })).data.count;

export const bulkProductStatusApi = async (organizationId: string, ids: string[], status: string) =>
  (await apiRequest<{ count: number }>("/products/bulk-status", { method: "POST", json: { ids, status }, organizationId })).data.count;

export const duplicateProductApi = async (organizationId: string, id: string) =>
  (await apiRequest<ProductDetailApi>(`/products/${id}/duplicate`, { method: "POST", organizationId })).data;

export type ProductImportRowApi = { row: number } & Record<string, unknown>;
export const importProductsApi = async (organizationId: string, rows: ProductImportRowApi[]) =>
  (await apiRequest<{ count: number }>("/products/import", { method: "POST", json: { rows }, organizationId, timeoutMs: 60_000 })).data;
