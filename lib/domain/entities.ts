import type {
  CollectionStatus,
  InventoryReason,
  OrderStatus,
  ProductStatus,
  StoreStatus,
} from "./enums";

/**
 * Row shapes the UI and the services work with (the StoreForge API returns them; dates are revived to `Date` by the
 * services). Plain types: nothing here knows about a database client.
 */

export type Store = {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description: string | null;
  /** Object path of the logo in the `products` bucket (`{tenant_id}/store/...`), not a URL. */
  logoUrl: string | null;
  /** SEO title and description of the storefront home page. */
  metaTitle: string | null;
  metaDescription: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  currency: string;
  timezone: string;
  status: StoreStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type Category = {
  id: string;
  tenantId: string;
  parentId: string | null;
  name: string;
  slug: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type Collection = {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description: string | null;
  /** Object path in the `products` bucket: `{tenant_id}/collections/{id}/...` */
  imagePath: string | null;
  status: CollectionStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type Product = {
  id: string;
  tenantId: string;
  categoryId: string | null;
  name: string;
  slug: string;
  description: string | null;
  shortDescription: string | null;
  productType: string | null;
  /** Used when the product has no variants. With variants, SKU/price/stock live on the variants. */
  sku: string | null;
  priceMinor: number;
  compareAtPriceMinor: number | null;
  costMinor: number | null;
  hasVariants: boolean;
  trackInventory: boolean;
  quantity: number;
  lowStockThreshold: number;
  /** Packed shipping weight per unit in grams (0 = not set). */
  weightGrams: number;
  /** GST rate in basis points, or null for the store default. */
  taxRateBps: number | null;
  /** HSN (goods) or SAC (services) code. */
  hsnCode: string | null;
  status: ProductStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type ProductImage = {
  id: string;
  tenantId: string;
  productId: string;
  /** Object path in the `products` bucket: `{tenant_id}/{product_id}/{file}`. */
  storagePath: string;
  altText: string | null;
  position: number;
  isPrimary: boolean;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
};

export type ProductOption = {
  id: string;
  tenantId: string;
  productId: string;
  name: string;
  position: number;
  values: string[];
};

export type ProductVariant = {
  id: string;
  tenantId: string;
  productId: string;
  title: string;
  /** e.g. {"Size":"M","Color":"Black"} */
  options: Record<string, string>;
  sku: string | null;
  priceMinor: number;
  compareAtPriceMinor: number | null;
  quantity: number;
  imageId: string | null;
  isActive: boolean;
  position: number;
  createdAt: Date;
  updatedAt: Date;
};

export type InventoryAdjustment = {
  id: string;
  tenantId: string;
  productId: string;
  variantId: string | null;
  delta: number;
  quantityAfter: number;
  reason: InventoryReason;
  note: string | null;
  createdBy: string | null;
  createdAt: Date;
};

export type Customer = {
  id: string;
  tenantId: string;
  email: string;
  fullName: string;
  phone: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type Order = {
  id: string;
  tenantId: string;
  customerId: string | null;
  orderNumber: number;
  status: OrderStatus;
  currency: string;
  subtotalMinor: number;
  totalMinor: number;
  placedAt: Date;
  createdAt: Date;
};
