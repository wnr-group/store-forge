import type { Metadata } from "next";
import { CategoryManager } from "@/components/categories/category-manager";
import { PageHeader } from "@/components/shared/page-header";
import { canDeleteCatalog, canManageCatalog } from "@/lib/auth/permissions";
import { requireWorkspaceCan } from "@/lib/tenant/context";
import { listCategories } from "@/services/category.service";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const { active } = await requireWorkspaceCan("catalog:view");
  const rows = await listCategories();
  return (
    <>
      <PageHeader title="Categories" description="Organise your catalog into a browsable taxonomy." />
      <CategoryManager rows={rows} canManage={canManageCatalog(active)} canDelete={canDeleteCatalog(active)} />
    </>
  );
}
