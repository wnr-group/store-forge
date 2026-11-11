import "server-only";
import type { Product, ProductImage, ProductOption, ProductVariant } from "@/lib/domain/entities";
import {
  bulkDeleteProductsApi,
  bulkProductStatusApi,
  createProductApi,
  duplicateProductApi,
  getProductApi,
  listProductsApi,
  updateProductApi,
  type ProductApiInput,
  type ProductDetailApi,
  type ProductListItemApi,
} from "@/lib/api/endpoints/product-api";
import { AppError } from "@/lib/errors";
import { requireActiveTenant } from "@/lib/tenant/context";
import { PAGE_SIZE, type ProductListQuery, type ProductValues } from "@/lib/validations/catalog";

/**
 * Products (with options, variants, images and collections), served by the StoreForge API (`/products`). The API parses
 * prices with the store's currency, verifies images under the storage locks, keeps stock and SKU rules, saves everything
 * in one transaction and removes replaced image files after it commits.
 */
export type ProductRow = {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  status: Product["status"];
  priceMinor: number;
  hasVariants: boolean;
  variantCount: number;
  trackInventory: boolean;
  stock: number;
  lowStockThreshold: number;
  categoryName: string | null;
  imagePath: string | null;
  updatedAt: Date;
  createdAt: Date;
};

export type Paged<T> = { items: T[]; total: number; page: number; pageSize: number };

export type ProductDetail = {
  product: Product;
  options: ProductOption[];
  variants: ProductVariant[];
  images: ProductImage[];
  collectionIds: string[];
};

const SORT_BY = { created: "createdAt", name: "name", price: "price" } as const;

const toListRow = (p: ProductListItemApi): ProductRow => ({
  ...p,
  status: p.status as Product["status"],
  updatedAt: new Date(p.updatedAt),
  createdAt: new Date(p.createdAt),
});

/** The API's flat detail becomes the `{ product, options, variants, images, collectionIds }` the pages use. Child rows get the product's dates (the API omits them). */
function toDetail(d: ProductDetailApi, tenantId: string): ProductDetail {
  const { options, variants, images, collectionIds, ...rest } = d;
  const createdAt = new Date(d.createdAt);
  const updatedAt = new Date(d.updatedAt);
  return {
    product: { ...rest, tenantId, status: rest.status as Product["status"], createdAt, updatedAt },
    options: options.map((o) => ({ ...o, tenantId, productId: d.id, createdAt, updatedAt })),
    variants: variants.map((v) => ({ ...v, tenantId, productId: d.id, createdAt, updatedAt })),
    images: images.map((i) => ({ ...i, tenantId, productId: d.id, createdAt })),
    collectionIds,
  };
}

export async function listProducts(q: ProductListQuery): Promise<Paged<ProductRow>> {
  const { tenant } = await requireActiveTenant();
  const { items, meta } = await listProductsApi(tenant.id, {
    page: q.page,
    limit: PAGE_SIZE,
    search: q.q,
    status: q.status,
    category: q.category,
    stock: q.stock,
    sortBy: SORT_BY[q.sort],
    sortOrder: q.dir,
  });
  return { items: items.map(toListRow), total: meta.total, page: meta.page, pageSize: PAGE_SIZE };
}

export async function getProduct(id: string): Promise<ProductDetail | null> {
  const { tenant } = await requireActiveTenant();
  try {
    return toDetail(await getProductApi(tenant.id, id), tenant.id);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") return null;
    throw error;
  }
}

/** A variant must use declared option values, and no two variants may share a combination. */
function checkVariants(values: ProductValues) {
  const declared = new Map(values.options.map((o) => [o.name, new Set(o.values)]));
  const seen = new Set<string>();
  for (const v of values.variants) {
    const keys = Object.keys(v.options);
    if (keys.length !== declared.size || !keys.every((k) => declared.get(k)?.has(v.options[k])))
      throw new AppError("VALIDATION", "A variant uses an option value that does not exist.");
    const signature = JSON.stringify([...keys].sort().map((k) => [k, v.options[k]]));
    if (seen.has(signature)) throw new AppError("VALIDATION", "Two variants have the same option combination.");
    seen.add(signature);
  }
}

/** The store currency is applied by the API (the form never decides it). */
export async function createProduct(values: ProductValues): Promise<{ id: string }> {
  checkVariants(values);
  const { tenant } = await requireActiveTenant("catalog:manage");
  return { id: (await createProductApi(tenant.id, values as unknown as ProductApiInput)).id };
}

export async function updateProduct(values: ProductValues): Promise<{ id: string }> {
  checkVariants(values);
  const { tenant } = await requireActiveTenant("catalog:manage");
  const { id, ...body } = values;
  await updateProductApi(tenant.id, id, body as unknown as ProductApiInput);
  return { id };
}

/** Deletes products (owner/admin); the API removes their image files afterwards. Returns how many were deleted. */
export async function deleteProducts(ids: string[]): Promise<number> {
  const { tenant } = await requireActiveTenant("catalog:delete");
  return bulkDeleteProductsApi(tenant.id, ids);
}

export async function setProductsStatus(ids: string[], status: Product["status"]): Promise<number> {
  const { tenant } = await requireActiveTenant("catalog:manage");
  return bulkProductStatusApi(tenant.id, ids, status);
}

/** Copies the product as a draft. Images are not copied (files stay tied to the original). */
export async function duplicateProduct(id: string): Promise<{ id: string }> {
  const { tenant } = await requireActiveTenant("catalog:manage");
  return { id: (await duplicateProductApi(tenant.id, id)).id };
}
