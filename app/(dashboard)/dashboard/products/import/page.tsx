import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProductImport } from "@/components/products/product-import";
import { PageHeader } from "@/components/shared/page-header";
import { ROUTES } from "@/config/app";
import { canManageCatalog } from "@/lib/auth/permissions";
import { requireWorkspaceCan } from "@/lib/tenant/context";

export const metadata: Metadata = { title: "Import products" };
export const runtime = "nodejs";

export default async function ImportProductsPage() {
  const { active } = await requireWorkspaceCan("catalog:view");
  if (!canManageCatalog(active)) redirect(ROUTES.products);
  return (
    <>
      <PageHeader title="Import products" description="Add many simple products at once from a CSV or Excel file." />
      <ProductImport />
    </>
  );
}
