import type { Metadata } from "next";
import { CategoryManager } from "@/components/categories/category-manager";
import { canDeleteCatalog, canManageCatalog } from "@/lib/auth/permissions";
import { requireWorkspaceCan } from "@/lib/tenant/context";
import { listCategories } from "@/services/category.service";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const { active } = await requireWorkspaceCan("catalog:view");
  const rows = await listCategories();
  return (
    <>
      <CategoryManager rows={rows} canManage={canManageCatalog(active)} canDelete={canDeleteCatalog(active)} />
    </>
  );
}
