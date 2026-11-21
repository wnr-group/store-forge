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
import { getStoreApi } from "@/lib/api/endpoints/store-api";
import { AppError } from "@/lib/errors";
import { minorToInput } from "@/lib/money";
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

/** What the editor's card dialog edits: the few fields a product card shows. Prices are decimal text in the product's currency. */
export type QuickEditProduct = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  price: string;
  compareAtPrice: string;
  currency: string;
  /** A product with variants has a price per variant, so its price is edited on the product page. */
  hasVariants: boolean;
  imagePath: string | null;
  priceMinor: number;
  compareAtPriceMinor: number | null;
};

const toQuickEdit = (d: ProductDetailApi, currency: string): QuickEditProduct => ({
  id: d.id,
  slug: d.slug,
  name: d.name,
  shortDescription: d.shortDescription ?? "",
  price: minorToInput(d.priceMinor, currency),
  compareAtPrice: minorToInput(d.compareAtPriceMinor, currency),
  currency,
  hasVariants: d.variants.length > 0,
  imagePath: d.images[0]?.storagePath ?? null,
  priceMinor: d.priceMinor,
  compareAtPriceMinor: d.compareAtPriceMinor,
});

/** The product a storefront card shows, found by its address. Cards carry the slug, not the id. */
async function findProductId(organizationId: string, slug: string, name: string): Promise<string> {
  for (const search of [name, slug]) {
    const { items } = await listProductsApi(organizationId, { page: 1, limit: 50, search });
    const match = items.find((p) => p.slug === slug);
    if (match) return match.id;
  }
  throw new AppError("NOT_FOUND", "That product could not be found. It may have been removed.");
}

/** Reads the product behind a card, for the editor's "edit product" dialog. */
export async function getProductForQuickEdit(slug: string, name: string): Promise<QuickEditProduct> {
  const { tenant } = await requireActiveTenant();
  const id = await findProductId(tenant.id, slug, name);
  const [detail, store] = await Promise.all([getProductApi(tenant.id, id), getStoreApi(tenant.id)]);
  return toQuickEdit(detail, store.currency);
}

export type QuickEditPatch = {
  id: string;
  name: string;
  shortDescription: string;
  price: string;
  compareAtPrice: string;
  /** Storage path of a newly uploaded main picture; null keeps the pictures as they are. */
  imagePath: string | null;
};

/**
 * The whole product as the update expects it, with the card's fields changed: the update replaces the product, so everything
 * else (variants, options, stock, collections, the other pictures) is sent back as it is. A new main picture replaces the old
 * one and keeps the rest. Not validated here: the caller runs it through the product schema first.
 */
export async function buildQuickEditPayload(patch: QuickEditPatch): Promise<Record<string, unknown>> {
  const { tenant } = await requireActiveTenant("catalog:manage");
  const [d, store] = await Promise.all([getProductApi(tenant.id, patch.id), getStoreApi(tenant.id)]);
  const currency = store.currency;
  const current = toQuickEdit(d, currency);
  if (current.hasVariants && (patch.price.trim() !== current.price || patch.compareAtPrice.trim() !== current.compareAtPrice)) {
    throw new AppError("VALIDATION", "This product has variants, each with its own price. Change prices on the product page.");
  }
  const pathById = new Map(d.images.map((i) => [i.id, i.storagePath]));
  const kept = d.images.map((i) => ({ path: i.storagePath, altText: i.altText ?? "" }));
  const images = patch.imagePath && patch.imagePath !== current.imagePath ? [{ path: patch.imagePath, altText: patch.name }, ...kept.slice(1)] : kept;
  return {
    id: d.id,
    name: patch.name,
    slug: d.slug,
    description: d.description ?? "",
    shortDescription: patch.shortDescription,
    productType: d.productType ?? "",
    categoryId: d.categoryId ?? null,
    collectionIds: d.collectionIds,
    sku: d.sku ?? "",
    price: current.hasVariants ? current.price : patch.price,
    compareAtPrice: current.hasVariants ? current.compareAtPrice : patch.compareAtPrice,
    cost: minorToInput(d.costMinor, currency),
    trackInventory: d.trackInventory,
    quantity: String(d.quantity),
    lowStockThreshold: String(d.lowStockThreshold),
    status: d.status,
    options: d.options.map((o) => ({ name: o.name, values: o.values })),
    variants: d.variants.map((v) => ({
      id: v.id,
      options: v.options,
      sku: v.sku ?? "",
      price: minorToInput(v.priceMinor, currency),
      compareAtPrice: minorToInput(v.compareAtPriceMinor, currency),
      quantity: v.quantity,
      imagePath: v.imageId ? (pathById.get(v.imageId) ?? null) : null,
      isActive: v.isActive,
    })),
    images,
  };
}

/** After a card edit: the product as the card shows it now. */
export async function readQuickEdit(id: string): Promise<QuickEditProduct> {
  const { tenant } = await requireActiveTenant();
  const [detail, store] = await Promise.all([getProductApi(tenant.id, id), getStoreApi(tenant.id)]);
  return toQuickEdit(detail, store.currency);
}
