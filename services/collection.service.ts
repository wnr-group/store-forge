import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { collectionProducts, collections, products, type Collection } from "@/lib/db/schema";
import { mapErrors } from "@/lib/db/errors";
import { AppError } from "@/lib/errors";
import { collectionFolder } from "@/lib/storage/paths";
import { removeObjects, verifyObjects } from "@/lib/storage/server";
import { requireActiveTenant, withTenantDb } from "@/lib/tenant/context";
import { slugify } from "@/lib/utils/slug";
import type { CollectionInput } from "@/lib/validations/catalog";

export type CollectionRow = Collection & { productCount: number };

export async function listCollections(): Promise<CollectionRow[]> {
  return withTenantDb({}, async (tx, ctx) => {
    const rows = await tx
      .select({
        collection: collections,
        productCount: sql<number>`(select count(*)::int from "collection_products" cp where cp.collection_id = "collections"."id")`,
      })
      .from(collections)
      .where(eq(collections.tenantId, ctx.tenantId))
      .orderBy(asc(collections.name));
    return rows.map((r) => ({ ...r.collection, productCount: r.productCount }));
  });
}

export async function getCollection(id: string): Promise<(Collection & { productIds: string[] }) | null> {
  return withTenantDb({}, async (tx, ctx) => {
    const [c] = await tx.select().from(collections).where(and(eq(collections.id, id), eq(collections.tenantId, ctx.tenantId)));
    if (!c) return null;
    const links = await tx.select({ id: collectionProducts.productId }).from(collectionProducts).where(eq(collectionProducts.collectionId, id)).orderBy(asc(collectionProducts.position));
    return { ...c, productIds: links.map((l) => l.id) };
  });
}

/** Product choices for the collection picker (ids + names only). */
export async function listProductOptions(): Promise<{ id: string; name: string }[]> {
  return withTenantDb({}, (tx, ctx) =>
    tx.select({ id: products.id, name: products.name }).from(products).where(eq(products.tenantId, ctx.tenantId)).orderBy(asc(products.name)).limit(500),
  );
}

async function replaceProducts(tx: Parameters<Parameters<typeof withTenantDb>[1]>[0], tenantId: string, collectionId: string, productIds: string[]) {
  const unique = [...new Set(productIds)];
  if (unique.length) {
    const valid = await tx.select({ id: products.id }).from(products).where(and(eq(products.tenantId, tenantId), inArray(products.id, unique)));
    if (valid.length !== unique.length) throw new AppError("VALIDATION", "A selected product no longer exists.");
  }
  await tx.delete(collectionProducts).where(eq(collectionProducts.collectionId, collectionId));
  if (unique.length) await tx.insert(collectionProducts).values(unique.map((productId, position) => ({ tenantId, collectionId, productId, position })));
}

type Values = ReturnType<typeof import("@/lib/validations/catalog").collectionInputSchema.parse>;

export async function createCollection(id: string, input: Values): Promise<{ id: string }> {
  const { tenant } = await requireActiveTenant("catalog:manage");
  const [image] = input.imagePath ? await verifyObjects(collectionFolder(tenant.id, id), [input.imagePath]) : [];
  return withTenantDb({ tenantId: tenant.id, permission: "catalog:manage" }, (tx, ctx) =>
    mapErrors(async () => {
      await tx.insert(collections).values({
        id,
        tenantId: ctx.tenantId,
        name: input.name,
        slug: input.slug ?? (slugify(input.name).padEnd(2, "x") || "collection"),
        description: input.description,
        status: input.status,
        imagePath: image?.path ?? null,
      });
      await replaceProducts(tx, ctx.tenantId, id, input.productIds);
      return { id };
    }),
  );
}

export async function updateCollection(id: string, input: Values): Promise<void> {
  const { tenant } = await requireActiveTenant("catalog:manage");
  const folder = collectionFolder(tenant.id, id);
  const [image] = input.imagePath ? await verifyObjects(folder, [input.imagePath]) : [];
  const previous = await withTenantDb({ tenantId: tenant.id, permission: "catalog:manage" }, (tx, ctx) =>
    mapErrors(async () => {
      const [current] = await tx.select({ imagePath: collections.imagePath }).from(collections).where(and(eq(collections.id, id), eq(collections.tenantId, ctx.tenantId)));
      if (!current) throw new AppError("NOT_FOUND", "That collection no longer exists.");
      await tx
        .update(collections)
        .set({ name: input.name, description: input.description, status: input.status, imagePath: image?.path ?? null, ...(input.slug ? { slug: input.slug } : {}) })
        .where(and(eq(collections.id, id), eq(collections.tenantId, ctx.tenantId)));
      await replaceProducts(tx, ctx.tenantId, id, input.productIds);
      return current.imagePath;
    }),
  );
  if (previous && previous !== (image?.path ?? null)) await removeObjects([previous]);
}

export async function deleteCollection(id: string): Promise<void> {
  const imagePath = await withTenantDb({ permission: "catalog:delete" }, (tx, ctx) =>
    mapErrors(async () => {
      const rows = await tx.delete(collections).where(and(eq(collections.id, id), eq(collections.tenantId, ctx.tenantId))).returning({ imagePath: collections.imagePath });
      if (!rows.length) throw new AppError("NOT_FOUND", "That collection no longer exists.");
      return rows[0].imagePath;
    }),
  );
  if (imagePath) await removeObjects([imagePath]);
}

export type { CollectionInput };
