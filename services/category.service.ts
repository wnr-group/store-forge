import "server-only";
import type { Category } from "@/lib/domain/entities";
import {
  createCategoryApi,
  deleteCategoryApi,
  getCategoryApi,
  listCategoriesApi,
  updateCategoryApi,
  type CategoryApi,
} from "@/lib/api/endpoints/category-api";
import { AppError } from "@/lib/errors";
import { requireActiveTenant } from "@/lib/tenant/context";

/** Categories, served by the StoreForge API (`/categories`). The API owns the rules (cycle check, slugs, uncategorising on delete). */
export type CategoryRow = Category & { productCount: number; parentName: string | null };

const toRow = (c: CategoryApi, tenantId: string): CategoryRow => ({ ...c, tenantId, createdAt: new Date(c.createdAt), updatedAt: new Date(c.updatedAt) });

export async function listCategories(): Promise<CategoryRow[]> {
  const { tenant } = await requireActiveTenant();
  return (await listCategoriesApi(tenant.id)).map((c) => toRow(c, tenant.id));
}

export async function getCategory(id: string): Promise<Category | null> {
  const { tenant } = await requireActiveTenant();
  try {
    return toRow(await getCategoryApi(tenant.id, id), tenant.id);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") return null;
    throw error;
  }
}

export async function createCategory(input: ReturnType<typeof normalize>): Promise<{ id: string }> {
  const { tenant } = await requireActiveTenant("catalog:manage");
  const { id } = await createCategoryApi(tenant.id, input);
  return { id };
}

export async function updateCategory(id: string, input: ReturnType<typeof normalize>): Promise<void> {
  const { tenant } = await requireActiveTenant("catalog:manage");
  await updateCategoryApi(tenant.id, id, input);
}

/** Products in the category become uncategorised; child categories become top-level (done by the API). */
export async function deleteCategory(id: string): Promise<void> {
  const { tenant } = await requireActiveTenant("catalog:delete");
  await deleteCategoryApi(tenant.id, id);
}

/** Shape the validated form input for the service layer. */
export function normalize(input: { name: string; slug?: string; description?: string | null; parentId?: string | null }) {
  return { name: input.name, slug: input.slug, description: input.description ?? null, parentId: input.parentId ?? null };
}
