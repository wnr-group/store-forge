import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProductForm } from "@/components/products/product-form";
import { PageHeader } from "@/components/shared/page-header";
import { ROUTES } from "@/config/app";
import { canManageCatalog } from "@/lib/auth/permissions";
import { requireWorkspace } from "@/lib/tenant/context";
import { listCategories } from "@/services/category.service";
import { listCollections } from "@/services/collection.service";

export const metadata: Metadata = { title: "New product" };

export default async function NewProductPage() {
  const { active, store } = await requireWorkspace();
  if (!canManageCatalog(active.role)) redirect(ROUTES.products);
  const [categories, collections] = await Promise.all([listCategories(), listCollections()]);
  return (
    <>
      <PageHeader title="New product" description="Add the essentials now; you can refine everything later." />
      <ProductForm
        mode="create"
        currency={store?.currency ?? "INR"}
        categories={categories.map((c) => ({ id: c.id, label: c.parentName ? `${c.parentName} › ${c.name}` : c.name }))}
        collections={collections.map((c) => ({ id: c.id, name: c.name }))}
        canDelete={false}
      />
    </>
  );
}
