import "server-only";
import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import {
  categories,
  collectionProducts,
  collections,
  productImages,
  productOptions,
  products,
  productVariants,
  type Product,
  type ProductImage,
  type ProductOption,
  type ProductVariant,
} from "@/lib/db/schema";
import { mapErrors } from "@/lib/db/errors";
import type { DbTx } from "@/lib/db/tenant-db";
import { requireActiveTenant, withTenantDb } from "@/lib/tenant/context";
import { AppError } from "@/lib/errors";
import { parseMoney } from "@/lib/money";
import { slugify } from "@/lib/utils/slug";
import { PAGE_SIZE, type ProductListQuery, type ProductValues } from "@/lib/validations/catalog";
import { productFolder } from "@/lib/storage/paths";
import { verifyObjects, removeObjects } from "@/lib/storage/server";

/** Stock the merchant can actually sell: variant total for products with variants, else the product quantity. */
// NOTE: correlated subqueries use explicit "products"."id": Drizzle omits the table qualifier in
// single-table selects, and a bare "id" would silently bind to the INNER table.
const effectiveStock = sql<number>`case when "products"."has_variants"
  then coalesce((select sum(v.quantity) from "product_variants" v where v.product_id = "products"."id" and v.is_active), 0)
  else "products"."quantity" end`;

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

function productFilters(ctxTenant: string, q: ProductListQuery): SQL {
  const where: (SQL | undefined)[] = [eq(products.tenantId, ctxTenant)];
  if (q.q) {
    const term = `%${q.q.replace(/[%_\\]/g, "\\$&")}%`;
    where.push(or(ilike(products.name, term), ilike(products.sku, term)));
  }
  if (q.status !== "all") where.push(eq(products.status, q.status));
  if (q.category === "none") where.push(sql`${products.categoryId} is null`);
  else if (q.category !== "all") where.push(eq(products.categoryId, q.category));
  switch (q.stock) {
    case "untracked":
      where.push(eq(products.trackInventory, false));
      break;
    case "out":
      where.push(sql`${products.trackInventory} and ${effectiveStock} <= 0`);
      break;
    case "low":
      where.push(sql`${products.trackInventory} and ${effectiveStock} > 0 and ${effectiveStock} <= ${products.lowStockThreshold}`);
      break;
    case "in":
      where.push(sql`${products.trackInventory} and ${effectiveStock} > ${products.lowStockThreshold}`);
      break;
  }
  return and(...where) as SQL;
}

/** Server-side search / filter / sort / pagination. Only one page of rows ever leaves the database. */
export async function listProducts(q: ProductListQuery): Promise<Paged<ProductRow>> {
  return withTenantDb({}, async (tx, ctx) => {
    const where = productFilters(ctx.tenantId, q);
    const dir = q.dir === "asc" ? asc : desc;
    const order =
      q.sort === "name" ? dir(products.name) : q.sort === "price" ? dir(products.priceMinor) : dir(products.createdAt);

    const [rows, [{ total }]] = await Promise.all([
      tx
        .select({
          id: products.id,
          name: products.name,
          slug: products.slug,
          sku: products.sku,
          status: products.status,
          priceMinor: products.priceMinor,
          hasVariants: products.hasVariants,
          variantCount: sql<number>`(select count(*)::int from "product_variants" v where v.product_id = "products"."id")`,
          trackInventory: products.trackInventory,
          stock: sql<number>`${effectiveStock}::int`,
          lowStockThreshold: products.lowStockThreshold,
          categoryName: categories.name,
          imagePath: sql<string | null>`(select i.storage_path from "product_images" i where i.product_id = "products"."id" order by i.is_primary desc, i.position asc limit 1)`,
          updatedAt: products.updatedAt,
          createdAt: products.createdAt,
        })
        .from(products)
        .leftJoin(categories, eq(categories.id, products.categoryId))
        .where(where)
        .orderBy(order, asc(products.id))
        .limit(PAGE_SIZE)
        .offset((q.page - 1) * PAGE_SIZE),
      tx.select({ total: sql<number>`count(*)::int` }).from(products).where(where),
    ]);
    return { items: rows, total, page: q.page, pageSize: PAGE_SIZE };
  });
}

export type ProductDetail = {
  product: Product;
  options: ProductOption[];
  variants: ProductVariant[];
  images: ProductImage[];
  collectionIds: string[];
};

export async function getProduct(id: string): Promise<ProductDetail | null> {
  return withTenantDb({}, async (tx, ctx) => {
    const [product] = await tx.select().from(products).where(and(eq(products.id, id), eq(products.tenantId, ctx.tenantId)));
    if (!product) return null;
    const [options, variants, images, links] = await Promise.all([
      tx.select().from(productOptions).where(eq(productOptions.productId, id)).orderBy(asc(productOptions.position)),
      tx.select().from(productVariants).where(eq(productVariants.productId, id)).orderBy(asc(productVariants.position), asc(productVariants.title)),
      tx.select().from(productImages).where(eq(productImages.productId, id)).orderBy(asc(productImages.position)),
      tx.select({ id: collectionProducts.collectionId }).from(collectionProducts).where(eq(collectionProducts.productId, id)),
    ]);
    return { product, options, variants, images, collectionIds: links.map((l) => l.id) };
  });
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

function money(value: string | null, currency: string, label: string): number | null {
  if (value === null) return null;
  const minor = parseMoney(value, currency);
  if (minor === null) throw new AppError("VALIDATION", `${label} is not a valid amount.`, { [label.toLowerCase()]: "Invalid amount" });
  return minor;
}

async function uniqueSlug(tx: DbTx, tenantId: string, base: string, excludeId?: string): Promise<string> {
  // The DB check requires 2-80 chars; pad one-letter names ("A" -> "a-item").
  const root = base.length >= 2 ? base : `${base || "product"}-item`;
  const taken = await tx
    .select({ slug: products.slug })
    .from(products)
    .where(and(eq(products.tenantId, tenantId), or(eq(products.slug, root), ilike(products.slug, `${root}-%`)), excludeId ? sql`${products.id} <> ${excludeId}` : undefined));
  const used = new Set(taken.map((t) => t.slug));
  if (!used.has(root)) return root;
  for (let n = 2; n < 1000; n++) if (!used.has(`${root}-${n}`)) return `${root}-${n}`;
  return `${root}-${Date.now()}`;
}

async function replaceOptions(tx: DbTx, tenantId: string, productId: string, values: ProductValues) {
  await tx.delete(productOptions).where(eq(productOptions.productId, productId));
  if (values.options.length)
    await tx.insert(productOptions).values(values.options.map((o, i) => ({ tenantId, productId, name: o.name, values: o.values, position: i })));
}

/** Variants must use exactly the declared options and only declared values. */
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

async function syncVariants(tx: DbTx, tenantId: string, productId: string, values: ProductValues, currency: string, imageIdMap: Map<string, string>) {
  const existing = await tx.select({ id: productVariants.id }).from(productVariants).where(eq(productVariants.productId, productId));
  const existingIds = new Set(existing.map((e) => e.id));
  const keep = new Set(values.variants.flatMap((v) => (v.id && existingIds.has(v.id) ? [v.id] : [])));
  const removed = [...existingIds].filter((id) => !keep.has(id));
  if (removed.length) await tx.delete(productVariants).where(and(eq(productVariants.productId, productId), inArray(productVariants.id, removed)));

  for (const [position, v] of values.variants.entries()) {
    const row = {
      title: Object.values(v.options).join(" / "),
      options: v.options,
      sku: v.sku,
      priceMinor: money(v.price, currency, "Variant price") ?? 0,
      compareAtPriceMinor: money(v.compareAtPrice, currency, "Compare-at price"),
      quantity: v.quantity,
      imageId: v.imagePath ? (imageIdMap.get(v.imagePath) ?? null) : null,
      isActive: v.isActive,
      position,
    };
    if (v.id && existingIds.has(v.id)) await tx.update(productVariants).set(row).where(and(eq(productVariants.id, v.id), eq(productVariants.productId, productId)));
    else await tx.insert(productVariants).values({ ...row, tenantId, productId });
  }
}

/** Reconciles image rows: verified new uploads are inserted, removed ones deleted, order/primary/alt updated. */
async function syncImages(tx: DbTx, tenantId: string, productId: string, values: ProductValues, verified: Map<string, { mimeType: string; sizeBytes: number }>) {
  const existing = await tx.select().from(productImages).where(eq(productImages.productId, productId));
  const byPath = new Map(existing.map((e) => [e.storagePath, e]));
  const wanted = new Set(values.images.map((i) => i.path));
  const removed = existing.filter((e) => !wanted.has(e.storagePath));
  if (removed.length) await tx.delete(productImages).where(and(eq(productImages.productId, productId), inArray(productImages.id, removed.map((r) => r.id))));

  // Clear the primary flag first so the one-primary unique index never trips mid-update.
  await tx.update(productImages).set({ isPrimary: false }).where(eq(productImages.productId, productId));
  const idByPath = new Map<string, string>();
  for (const [position, img] of values.images.entries()) {
    const found = byPath.get(img.path);
    if (found) {
      await tx.update(productImages).set({ position, isPrimary: position === 0, altText: img.altText }).where(eq(productImages.id, found.id));
      idByPath.set(img.path, found.id);
    } else {
      const meta = verified.get(img.path);
      if (!meta) throw new AppError("VALIDATION", "An uploaded image could not be verified.");
      const [row] = await tx
        .insert(productImages)
        .values({ tenantId, productId, storagePath: img.path, altText: img.altText, position, isPrimary: position === 0, mimeType: meta.mimeType, sizeBytes: meta.sizeBytes })
        .returning({ id: productImages.id });
      idByPath.set(img.path, row.id);
    }
  }
  return { removedPaths: removed.map((r) => r.storagePath), idByPath };
}

async function syncCollections(tx: DbTx, tenantId: string, productId: string, collectionIds: string[]) {
  if (collectionIds.length) {
    const valid = await tx.select({ id: collections.id }).from(collections).where(and(eq(collections.tenantId, tenantId), inArray(collections.id, collectionIds)));
    if (valid.length !== new Set(collectionIds).size) throw new AppError("VALIDATION", "A selected collection no longer exists.");
  }
  await tx.delete(collectionProducts).where(eq(collectionProducts.productId, productId));
  if (collectionIds.length) await tx.insert(collectionProducts).values([...new Set(collectionIds)].map((collectionId) => ({ tenantId, collectionId, productId })));
}

async function assertCategory(tx: DbTx, tenantId: string, categoryId: string | null) {
  if (!categoryId) return;
  const [c] = await tx.select({ id: categories.id }).from(categories).where(and(eq(categories.id, categoryId), eq(categories.tenantId, tenantId)));
  if (!c) throw new AppError("VALIDATION", "The selected category no longer exists.", { categoryId: "Choose another category" });
}

function productColumns(values: ProductValues, currency: string) {
  const hasVariants = values.variants.length > 0;
  return {
    name: values.name,
    description: values.description,
    shortDescription: values.shortDescription,
    productType: values.productType,
    categoryId: values.categoryId,
    // With variants, SKU / price / stock live on the variants; the product row keeps its base price for display.
    sku: hasVariants ? null : values.sku,
    priceMinor: money(values.price, currency, "Price") ?? 0,
    compareAtPriceMinor: money(values.compareAtPrice, currency, "Compare-at price"),
    costMinor: money(values.cost, currency, "Cost"),
    hasVariants,
    trackInventory: values.trackInventory,
    quantity: hasVariants ? 0 : values.quantity,
    lowStockThreshold: values.lowStockThreshold,
    status: values.status,
  };
}

async function verifiedImages(tenantId: string, productId: string, values: ProductValues, alreadyStored: Set<string>) {
  const fresh = values.images.map((i) => i.path).filter((p) => !alreadyStored.has(p));
  const checked = await verifyObjects(productFolder(tenantId, productId), fresh);
  return new Map(checked.map((c) => [c.path, { mimeType: c.mimeType, sizeBytes: c.sizeBytes }]));
}

export async function createProduct(values: ProductValues, currency: string): Promise<{ id: string }> {
  checkVariants(values);
  const { tenant } = await requireActiveTenant("catalog:manage");
  // Storage is checked first; the DB transaction below either records everything or nothing.
  const verified = await verifiedImages(tenant.id, values.id, values, new Set());
  return mapErrors(() =>
    withTenantDb({ tenantId: tenant.id, permission: "catalog:manage" }, async (tx, ctx) => {
      await assertCategory(tx, ctx.tenantId, values.categoryId);
      const slug = values.slug ?? (await uniqueSlug(tx, ctx.tenantId, slugify(values.name)));
      await tx.insert(products).values({ id: values.id, tenantId: ctx.tenantId, slug, ...productColumns(values, currency) });
      await replaceOptions(tx, ctx.tenantId, values.id, values);
      const { idByPath } = await syncImages(tx, ctx.tenantId, values.id, values, verified);
      await syncVariants(tx, ctx.tenantId, values.id, values, currency, idByPath);
      await syncCollections(tx, ctx.tenantId, values.id, values.collectionIds);
      return { id: values.id };
    }),
  );
}

export async function updateProduct(values: ProductValues, currency: string): Promise<{ id: string }> {
  checkVariants(values);
  const { tenant } = await requireActiveTenant("catalog:manage");
  const existing = await withTenantDb({ tenantId: tenant.id }, (tx, ctx) =>
    tx.select({ path: productImages.storagePath }).from(productImages).where(and(eq(productImages.productId, values.id), eq(productImages.tenantId, ctx.tenantId))),
  );
  const verified = await verifiedImages(tenant.id, values.id, values, new Set(existing.map((e) => e.path)));
  const removedPaths = await mapErrors(() =>
    withTenantDb({ tenantId: tenant.id, permission: "catalog:manage" }, async (tx, ctx) => {
      const [current] = await tx.select({ id: products.id, slug: products.slug }).from(products).where(and(eq(products.id, values.id), eq(products.tenantId, ctx.tenantId)));
      if (!current) throw new AppError("NOT_FOUND", "That product no longer exists.");
      await assertCategory(tx, ctx.tenantId, values.categoryId);
      const slug = values.slug ?? current.slug;
      await tx.update(products).set({ slug, ...productColumns(values, currency) }).where(and(eq(products.id, values.id), eq(products.tenantId, ctx.tenantId)));
      await replaceOptions(tx, ctx.tenantId, values.id, values);
      const images = await syncImages(tx, ctx.tenantId, values.id, values, verified);
      await syncVariants(tx, ctx.tenantId, values.id, values, currency, images.idByPath);
      await syncCollections(tx, ctx.tenantId, values.id, values.collectionIds);
      return images.removedPaths;
    }),
  );
  // Only after the transaction committed: a rollback must never orphan DB rows from their files.
  await removeObjects(removedPaths);
  return { id: values.id };
}

/** Deletes products (owner/admin) and then their image files. Returns how many were deleted. */
export async function deleteProducts(ids: string[]): Promise<number> {
  const { count, paths } = await withTenantDb({ permission: "catalog:delete" }, (tx, ctx) =>
    mapErrors(async () => {
      const imgs = await tx.select({ path: productImages.storagePath }).from(productImages).where(and(eq(productImages.tenantId, ctx.tenantId), inArray(productImages.productId, ids)));
      const deleted = await tx.delete(products).where(and(eq(products.tenantId, ctx.tenantId), inArray(products.id, ids))).returning({ id: products.id });
      return { count: deleted.length, paths: deleted.length ? imgs.map((i) => i.path) : [] };
    }),
  );
  await removeObjects(paths);
  return count;
}

export async function setProductsStatus(ids: string[], status: Product["status"]): Promise<number> {
  return withTenantDb({ permission: "catalog:manage" }, (tx, ctx) =>
    mapErrors(async () => {
      const rows = await tx.update(products).set({ status }).where(and(eq(products.tenantId, ctx.tenantId), inArray(products.id, ids))).returning({ id: products.id });
      return rows.length;
    }),
  );
}

/** Copies the product as a draft. Images are not copied (files stay tied to the original). */
export async function duplicateProduct(id: string): Promise<{ id: string }> {
  return withTenantDb({ permission: "catalog:manage" }, (tx, ctx) =>
    mapErrors(async () => {
      const [src] = await tx.select().from(products).where(and(eq(products.id, id), eq(products.tenantId, ctx.tenantId)));
      if (!src) throw new AppError("NOT_FOUND", "That product no longer exists.");
      const [options, variants] = await Promise.all([
        tx.select().from(productOptions).where(eq(productOptions.productId, id)),
        tx.select().from(productVariants).where(eq(productVariants.productId, id)),
      ]);
      const name = `${src.name} (copy)`.slice(0, 200);
      const slug = await uniqueSlug(tx, ctx.tenantId, `${src.slug}-copy`.slice(0, 80));
      const [copy] = await tx
        .insert(products)
        .values({ ...src, id: undefined, name, slug, sku: null, status: "draft", createdAt: undefined, updatedAt: undefined })
        .returning({ id: products.id });
      if (options.length) await tx.insert(productOptions).values(options.map((o) => ({ tenantId: ctx.tenantId, productId: copy.id, name: o.name, values: o.values, position: o.position })));
      if (variants.length)
        await tx.insert(productVariants).values(
          variants.map((v) => ({ tenantId: ctx.tenantId, productId: copy.id, title: v.title, options: v.options, sku: null, priceMinor: v.priceMinor, compareAtPriceMinor: v.compareAtPriceMinor, quantity: v.quantity, isActive: v.isActive, position: v.position })),
        );
      return { id: copy.id };
    }),
  );
}
