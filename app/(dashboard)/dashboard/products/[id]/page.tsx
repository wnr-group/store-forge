import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ProductForm } from "@/components/products/product-form";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { canDeleteCatalog } from "@/lib/auth/permissions";
import { orderCategories } from "@/lib/categories/hierarchy";
import { requireWorkspaceCan } from "@/lib/tenant/context";
import { listCategories } from "@/services/category.service";
import { listCollections } from "@/services/collection.service";
import { getProduct } from "@/services/product.service";

export const metadata: Metadata = { title: "Edit product" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { active, store } = await requireWorkspaceCan("catalog:view");
  // Tenant-scoped lookup: an id from another merchant simply returns null (and RLS would hide it anyway).
  const [product, categories, collections] = await Promise.all([getProduct(id), listCategories(), listCollections()]);
  if (!product) notFound();

  return (
    <>
      <PageHeader
        title={product.product.name}
        description={`/${product.product.slug}`}
        actions={<StatusBadge tone={product.product.status === "active" ? "active" : "draft"}>{product.product.status === "active" ? "Active" : "Draft"}</StatusBadge>}
      />
      <ProductForm
        key={product.product.updatedAt.toISOString()}
        mode="edit"
        currency={store?.currency ?? "INR"}
        initial={product}
        categories={orderCategories(categories).map((c) => ({ id: c.id, label: c.label }))}
        collections={collections.map((c) => ({ id: c.id, name: c.name }))}
        canDelete={canDeleteCatalog(active)}
      />
    </>
  );
}
