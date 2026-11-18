import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProductForm } from "@/components/products/product-form";
import { PageHeader } from "@/components/shared/page-header";
import { ROUTES } from "@/config/app";
import { canManageCatalog } from "@/lib/auth/permissions";
import { orderCategories } from "@/lib/categories/hierarchy";
import { requireWorkspaceCan } from "@/lib/tenant/context";
import { listCategories } from "@/services/category.service";
import { listCollections } from "@/services/collection.service";

export const metadata: Metadata = { title: "New product" };

export default async function NewProductPage() {
  const { active, store } = await requireWorkspaceCan("catalog:view");
  if (!canManageCatalog(active)) redirect(ROUTES.products);
  const [categories, collections] = await Promise.all([listCategories(), listCollections()]);
  return (
    <>
      <PageHeader title="New product" description="Add the essentials now; you can refine everything later." />
      <ProductForm
        mode="create"
        currency={store?.currency ?? "INR"}
        categories={orderCategories(categories).map((c) => ({ id: c.id, label: c.label }))}
        collections={collections.map((c) => ({ id: c.id, name: c.name }))}
        canDelete={false}
      />
    </>
  );
}
