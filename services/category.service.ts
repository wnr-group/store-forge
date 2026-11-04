import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { categories, products, type Category } from "@/lib/db/schema";
import { mapErrors } from "@/lib/db/errors";
import type { DbTx } from "@/lib/db/tenant-db";
import { AppError } from "@/lib/errors";
import { withTenantDb } from "@/lib/tenant/context";
import { slugify } from "@/lib/utils/slug";
import type { CategoryInput } from "@/lib/validations/catalog";

export type CategoryRow = Category & { productCount: number; parentName: string | null };

export async function listCategories(): Promise<CategoryRow[]> {
  return withTenantDb({}, async (tx, ctx) => {
    const rows = await tx
      .select({
        category: categories,
        productCount: sql<number>`(select count(*)::int from ${products} p where p.category_id = ${categories.id})`,
      })
      .from(categories)
      .where(eq(categories.tenantId, ctx.tenantId))
      .orderBy(asc(categories.name));
    const names = new Map(rows.map((r) => [r.category.id, r.category.name]));
    return rows.map((r) => ({ ...r.category, productCount: r.productCount, parentName: r.category.parentId ? (names.get(r.category.parentId) ?? null) : null }));
  });
}

export async function getCategory(id: string): Promise<Category | null> {
  return withTenantDb({}, async (tx, ctx) => {
    const [c] = await tx.select().from(categories).where(and(eq(categories.id, id), eq(categories.tenantId, ctx.tenantId)));
    return c ?? null;
  });
}

/** A category may not become its own ancestor. Walks up from the proposed parent. */
async function assertNoCycle(tx: DbTx, tenantId: string, id: string, parentId: string | null) {
  let cursor = parentId;
  for (let depth = 0; cursor && depth < 50; depth++) {
    if (cursor === id) throw new AppError("VALIDATION", "A category cannot be moved under itself.", { parentId: "Choose a different parent" });
    const [p] = await tx.select({ parentId: categories.parentId }).from(categories).where(and(eq(categories.id, cursor), eq(categories.tenantId, tenantId)));
    if (!p) throw new AppError("VALIDATION", "The parent category no longer exists.", { parentId: "Choose a different parent" });
    cursor = p.parentId;
  }
}

export async function createCategory(input: ReturnType<typeof normalize>): Promise<{ id: string }> {
  return withTenantDb({ permission: "catalog:manage" }, (tx, ctx) =>
    mapErrors(async () => {
      await assertNoCycle(tx, ctx.tenantId, "", input.parentId);
      const [row] = await tx
        .insert(categories)
        .values({ tenantId: ctx.tenantId, name: input.name, slug: input.slug ?? (slugify(input.name) || "category"), description: input.description, parentId: input.parentId })
        .returning({ id: categories.id });
      return row;
    }),
  );
}

export async function updateCategory(id: string, input: ReturnType<typeof normalize>): Promise<void> {
  await withTenantDb({ permission: "catalog:manage" }, (tx, ctx) =>
    mapErrors(async () => {
      await assertNoCycle(tx, ctx.tenantId, id, input.parentId);
      const rows = await tx
        .update(categories)
        .set({ name: input.name, description: input.description, parentId: input.parentId, ...(input.slug ? { slug: input.slug } : {}) })
        .where(and(eq(categories.id, id), eq(categories.tenantId, ctx.tenantId)))
        .returning({ id: categories.id });
      if (!rows.length) throw new AppError("NOT_FOUND", "That category no longer exists.");
    }),
  );
}

/** Products in the category become uncategorised; child categories become top-level. */
export async function deleteCategory(id: string): Promise<void> {
  await withTenantDb({ permission: "catalog:delete" }, (tx, ctx) =>
    mapErrors(async () => {
      const rows = await tx.delete(categories).where(and(eq(categories.id, id), eq(categories.tenantId, ctx.tenantId))).returning({ id: categories.id });
      if (!rows.length) throw new AppError("NOT_FOUND", "That category no longer exists.");
    }),
  );
}

/** Shape the validated form input for the service layer. */
export function normalize(input: Pick<CategoryInput, "name" | "description" | "parentId"> & { slug?: string }) {
  return { name: input.name, slug: input.slug, description: input.description ?? null, parentId: input.parentId ?? null };
}
