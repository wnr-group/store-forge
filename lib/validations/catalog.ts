import { z } from "zod";
import { COLLECTION_STATUSES, INVENTORY_REASONS, PRODUCT_STATUSES } from "@/lib/db/schema/enums";

/** Browser-supplied values are validated again on the server; nothing here is trusted. */

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGES_PER_PRODUCT = 10;
export const MAX_VARIANTS = 100;

const trimmed = (max: number, min = 1) => z.string().trim().min(min, "Required").max(max, `At most ${max} characters`);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `At most ${max} characters`)
    .optional()
    .transform((v) => (v ? v : null));

export const catalogSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "At least 2 characters")
  .max(80, "At most 80 characters")
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single hyphens");

/** Money as typed by the merchant ("1,299.50"); converted to minor units in the service using the store currency. */
const moneyField = z.string().trim().max(16, "Too large");
const optionalMoney = moneyField.optional().transform((v) => (v ? v : null));
const quantity = z.coerce.number({ error: "Enter a whole number" }).int("Enter a whole number").min(0, "Cannot be negative").max(1_000_000, "Too large");
const sku = z
  .string()
  .trim()
  .max(64, "At most 64 characters")
  .optional()
  .transform((v) => (v ? v : null));

export const optionSchema = z.object({
  name: trimmed(40),
  values: z
    .array(trimmed(40))
    .min(1, "Add at least one value")
    .max(20, "At most 20 values")
    .refine((v) => new Set(v.map((x) => x.toLowerCase())).size === v.length, "Values must be unique"),
});

export const variantSchema = z.object({
  /** Existing variant id when editing; absent for new combinations. */
  id: z.uuid().optional(),
  options: z.record(z.string(), z.string()),
  sku,
  price: moneyField.min(1, "Required"),
  compareAtPrice: optionalMoney,
  quantity,
  /** Storage path of one of this product's images (new uploads have no id yet). */
  imagePath: z.string().max(300).nullable().optional(),
  isActive: z.boolean().default(true),
});

export const uploadedImageSchema = z.object({
  /** Storage object path, re-verified server-side against tenant, product and the bucket contents. */
  path: z.string().min(10).max(300),
  altText: optionalText(300),
});

export const productInputSchema = z
  .object({
    /** Client-generated so images can be uploaded under the product folder before the row exists. */
    id: z.uuid(),
    name: trimmed(200),
    slug: catalogSlugSchema.optional(),
    description: optionalText(20000),
    shortDescription: optionalText(300),
    productType: optionalText(80),
    categoryId: z.uuid().nullable().default(null),
    collectionIds: z.array(z.uuid()).max(50).default([]),
    sku,
    price: moneyField.min(1, "Required"),
    compareAtPrice: optionalMoney,
    cost: optionalMoney,
    trackInventory: z.boolean().default(true),
    quantity: quantity.default(0),
    lowStockThreshold: quantity.default(5),
    status: z.enum(PRODUCT_STATUSES).default("draft"),
    options: z.array(optionSchema).max(3, "At most 3 options").default([]),
    variants: z.array(variantSchema).max(MAX_VARIANTS, `At most ${MAX_VARIANTS} variants`).default([]),
    /** Ordered; the first is the primary image. */
    images: z.array(uploadedImageSchema).max(MAX_IMAGES_PER_PRODUCT).default([]),
  })
  .superRefine((p, ctx) => {
    const names = p.options.map((o) => o.name.toLowerCase());
    if (new Set(names).size !== names.length) ctx.addIssue({ code: "custom", path: ["options"], message: "Option names must be unique" });
    if (p.options.length > 0 && p.variants.length === 0)
      ctx.addIssue({ code: "custom", path: ["variants"], message: "Generate at least one variant" });
    if (p.options.length === 0 && p.variants.length > 0)
      ctx.addIssue({ code: "custom", path: ["variants"], message: "Variants need at least one option" });
  });
export type ProductInput = z.input<typeof productInputSchema>;
export type ProductValues = z.output<typeof productInputSchema>;

export const productStatusSchema = z.enum(PRODUCT_STATUSES);
export const idsSchema = z.array(z.uuid()).min(1).max(100);

export const categoryInputSchema = z.object({
  name: trimmed(80),
  slug: catalogSlugSchema.optional(),
  description: optionalText(1000),
  parentId: z.uuid().nullable().default(null),
});
export type CategoryInput = z.input<typeof categoryInputSchema>;

export const collectionInputSchema = z.object({
  name: trimmed(80),
  slug: catalogSlugSchema.optional(),
  description: optionalText(1000),
  status: z.enum(COLLECTION_STATUSES).default("draft"),
  imagePath: z.string().max(300).nullable().default(null),
  productIds: z.array(z.uuid()).max(500).default([]),
});
export type CollectionInput = z.input<typeof collectionInputSchema>;

export const inventoryAdjustSchema = z
  .object({
    productId: z.uuid(),
    variantId: z.uuid().nullable().default(null),
    mode: z.enum(["add", "set"]),
    value: z.coerce.number({ error: "Enter a whole number" }).int("Enter a whole number").min(-1_000_000).max(1_000_000),
    reason: z.enum(INVENTORY_REASONS),
    note: optionalText(500),
  })
  .refine((v) => v.mode !== "set" || v.value >= 0, { path: ["value"], message: "Stock cannot be negative" });
export type InventoryAdjustInput = z.input<typeof inventoryAdjustSchema>;

export const customerInputSchema = z.object({
  fullName: trimmed(120),
  email: z.string().trim().toLowerCase().min(3, "Required").max(254).email("Enter a valid email"),
  phone: optionalText(32),
  notes: optionalText(2000),
});
export type CustomerInput = z.input<typeof customerInputSchema>;

export const storeSettingsSchema = z.object({
  name: trimmed(80, 2),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/, "3-40 characters: letters, numbers and hyphens"),
  description: optionalText(500),
  contactEmail: z
    .string()
    .trim()
    .max(254)
    .optional()
    .transform((v) => (v ? v : null))
    .pipe(z.string().email("Enter a valid email").nullable()),
  contactPhone: optionalText(32),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use a 3-letter currency code"),
  timezone: z.string().trim().min(1).max(64),
  logoPath: z.string().max(300).nullable().default(null),
});
export type StoreSettingsInput = z.input<typeof storeSettingsSchema>;

export const profileSchema = z.object({ fullName: trimmed(120) });

/** List pages read filters from the URL; invalid values fall back to defaults rather than erroring. */
export const PAGE_SIZE = 20;
const page = z.coerce.number().int().min(1).max(10_000).catch(1);

export const productListQuerySchema = z.object({
  q: z.string().trim().max(100).catch("").default(""),
  status: z.enum([...PRODUCT_STATUSES, "all"]).catch("all").default("all"),
  category: z.union([z.uuid(), z.literal("all"), z.literal("none")]).catch("all").default("all"),
  stock: z.enum(["all", "in", "low", "out", "untracked"]).catch("all").default("all"),
  sort: z.enum(["created", "name", "price"]).catch("created").default("created"),
  dir: z.enum(["asc", "desc"]).catch("desc").default("desc"),
  page: page.default(1),
});
export type ProductListQuery = z.output<typeof productListQuerySchema>;

export const customerListQuerySchema = z.object({
  q: z.string().trim().max(100).catch("").default(""),
  sort: z.enum(["created", "name", "spent", "orders"]).catch("created").default("created"),
  dir: z.enum(["asc", "desc"]).catch("desc").default("desc"),
  page: page.default(1),
});
export type CustomerListQuery = z.output<typeof customerListQuerySchema>;
