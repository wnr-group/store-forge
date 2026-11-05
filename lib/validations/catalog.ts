import { z } from "zod";
import { COLLECTION_STATUSES, INVENTORY_REASONS, PRODUCT_STATUSES } from "@/lib/db/schema/enums";
import {
  emailField,
  isSupportedCurrency,
  isValidTimeZone,
  moneyText,
  moneyValue,
  optionalEmail,
  optionalMoneyText,
  optionalPhone,
  optionalText,
  requiredText,
  wholeNumber,
} from "./fields";
import { storeSlugSchema } from "./company";

/** Browser-supplied values are validated again on the server; nothing here is trusted. */

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGES_PER_PRODUCT = 10;
export const MAX_VARIANTS = 100;

const trimmed = requiredText;

export const catalogSlugSchema = z
  .string({ error: "Slug is required." })
  .trim()
  .toLowerCase()
  .min(2, "Slug must be at least 2 characters.")
  .max(80, "Slug must be at most 80 characters.")
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single hyphens.");

const sku = z
  .string()
  .trim()
  .max(64, "SKU must be at most 64 characters.")
  .nullish()
  .transform((v) => (v ? v : null));

/** Compare-at only makes sense as a "was" price, so it must exceed the selling price. */
function checkCompareAt(price: unknown, compareAt: unknown, ctx: z.RefinementCtx, path: (string | number)[]) {
  if (typeof price !== "string" || typeof compareAt !== "string") return;
  const p = moneyValue(price);
  const c = moneyValue(compareAt);
  if (p !== null && c !== null && c <= p) ctx.addIssue({ code: "custom", path, message: "Compare-at price must be greater than the price." });
}

export const optionSchema = z.object({
  name: trimmed("Option name", 40),
  values: z
    .array(trimmed("Option value", 40))
    .min(1, "Add at least one option value.")
    .max(20, "At most 20 option values.")
    .refine((v) => new Set(v.map((x) => x.toLowerCase())).size === v.length, "Option values must be unique."),
});

export const variantSchema = z
  .object({
    /** Existing variant id when editing; absent for new combinations. */
    id: z.uuid().optional(),
    options: z.record(z.string(), z.string()),
    sku,
    price: moneyText("Variant price", { required: true, positive: true }),
    compareAtPrice: optionalMoneyText("Compare-at price"),
    quantity: wholeNumber("Variant stock"),
    /** Storage path of one of this product's images (new uploads have no id yet). */
    imagePath: z.string().max(300).nullable().optional(),
    isActive: z.boolean().default(true),
  })
  .superRefine((v, ctx) => checkCompareAt(v.price, v.compareAtPrice, ctx, ["compareAtPrice"]));

export const uploadedImageSchema = z.object({
  /** Storage object path, re-verified server-side against tenant, product and the bucket contents. */
  path: z.string().min(10).max(300),
  altText: optionalText("Alt text", 300),
});

export const productInputSchema = z
  .object({
    /** Client-generated so images can be uploaded under the product folder before the row exists. */
    id: z.uuid(),
    name: trimmed("Product name", 200),
    slug: catalogSlugSchema.optional(),
    description: optionalText("Description", 20000),
    shortDescription: optionalText("Short description", 300),
    productType: optionalText("Product type", 80),
    categoryId: z.uuid("Please select a valid category.").nullable().default(null),
    collectionIds: z.array(z.uuid()).max(50).default([]),
    sku,
    price: moneyText("Price", { required: true, positive: true }),
    compareAtPrice: optionalMoneyText("Compare-at price"),
    cost: optionalMoneyText("Cost per item"),
    trackInventory: z.boolean().default(true),
    quantity: wholeNumber("Inventory quantity").default(0),
    lowStockThreshold: wholeNumber("Low-stock threshold").default(5),
    status: z.enum(PRODUCT_STATUSES, { error: "Please select a valid status." }).default("draft"),
    options: z.array(optionSchema).max(3, "At most 3 options.").default([]),
    variants: z.array(variantSchema).max(MAX_VARIANTS, `At most ${MAX_VARIANTS} variants.`).default([]),
    /** Ordered; the first is the primary image. */
    images: z.array(uploadedImageSchema).max(MAX_IMAGES_PER_PRODUCT, `At most ${MAX_IMAGES_PER_PRODUCT} images.`).default([]),
  })
  .superRefine((p, ctx) => {
    checkCompareAt(p.price, p.compareAtPrice, ctx, ["compareAtPrice"]);
    const names = p.options.map((o) => o.name.toLowerCase());
    if (new Set(names).size !== names.length) ctx.addIssue({ code: "custom", path: ["options"], message: "Option names must be unique." });
    if (p.options.length > 0 && p.variants.length === 0)
      ctx.addIssue({ code: "custom", path: ["variants"], message: "Generate at least one variant." });
    if (p.options.length === 0 && p.variants.length > 0)
      ctx.addIssue({ code: "custom", path: ["variants"], message: "Variants need at least one option." });
    // A SKU identifies one sellable unit, so it cannot repeat inside the same submission.
    const seen = new Set<string>();
    const claim = (value: string | null, path: (string | number)[]) => {
      if (!value) return;
      const key = value.toLowerCase();
      if (seen.has(key)) ctx.addIssue({ code: "custom", path, message: "This SKU is used more than once on this product." });
      else seen.add(key);
    };
    // With variants the product-level SKU is discarded by the service, so only variant SKUs compete.
    if (p.variants.length === 0) claim(p.sku, ["sku"]);
    p.variants.forEach((v, i) => claim(v.sku, ["variants", i, "sku"]));
  });
export type ProductInput = z.input<typeof productInputSchema>;
export type ProductValues = z.output<typeof productInputSchema>;

export const productStatusSchema = z.enum(PRODUCT_STATUSES);
export const idsSchema = z.array(z.uuid()).min(1).max(100);

export const categoryInputSchema = z.object({
  name: trimmed("Category name", 80),
  slug: catalogSlugSchema.optional(),
  description: optionalText("Description", 1000),
  parentId: z.uuid("Please select a valid parent category.").nullable().default(null),
});
export type CategoryInput = z.input<typeof categoryInputSchema>;

export const collectionInputSchema = z.object({
  name: trimmed("Collection name", 80),
  slug: catalogSlugSchema.optional(),
  description: optionalText("Description", 1000),
  status: z.enum(COLLECTION_STATUSES, { error: "Please select a valid status." }).default("draft"),
  imagePath: z.string().max(300).nullable().default(null),
  productIds: z.array(z.uuid()).max(500, "At most 500 products per collection.").default([]),
});
export type CollectionInput = z.input<typeof collectionInputSchema>;

export const inventoryAdjustSchema = z
  .object({
    productId: z.uuid(),
    variantId: z.uuid().nullable().default(null),
    mode: z.enum(["add", "set"], { error: "Please select an adjustment type." }),
    value: wholeNumber("Quantity", { min: -1_000_000, max: 1_000_000 }),
    reason: z.enum(INVENTORY_REASONS, { error: "Please select a reason." }),
    note: optionalText("Note", 500),
  })
  .superRefine((v, ctx) => {
    if (typeof v.value !== "number") return;
    if (v.mode === "set" && v.value < 0) ctx.addIssue({ code: "custom", path: ["value"], message: "Stock cannot be negative." });
    if (v.mode === "add" && v.value === 0) ctx.addIssue({ code: "custom", path: ["value"], message: "Enter a quantity other than zero." });
  });
export type InventoryAdjustInput = z.input<typeof inventoryAdjustSchema>;

export const customerInputSchema = z.object({
  fullName: trimmed("Customer name", 120),
  email: emailField("Email address"),
  phone: optionalPhone,
  notes: optionalText("Notes", 2000),
});
export type CustomerInput = z.input<typeof customerInputSchema>;

export const storeSettingsSchema = z.object({
  name: trimmed("Store name", 80, 2),
  slug: storeSlugSchema,
  description: optionalText("Store description", 500),
  contactEmail: optionalEmail("Store email"),
  contactPhone: optionalPhone,
  currency: z
    .string({ error: "Currency is required." })
    .trim()
    .toUpperCase()
    .min(1, "Currency is required.")
    .refine(isSupportedCurrency, "Please select a supported currency."),
  timezone: z
    .string({ error: "Timezone is required." })
    .trim()
    .min(1, "Timezone is required.")
    .max(64, "Please select a valid timezone.")
    .refine(isValidTimeZone, "Please select a valid timezone."),
  logoPath: z.string().max(300).nullable().default(null),
});
export type StoreSettingsInput = z.input<typeof storeSettingsSchema>;

export const profileSchema = z.object({ fullName: trimmed("Full name", 120, 2) });

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
