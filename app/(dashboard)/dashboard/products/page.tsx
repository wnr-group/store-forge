import type { Metadata } from "next";
import Link from "next/link";
import { PackageOpen, Plus, SearchX, Upload } from "lucide-react";
import { ProductTable } from "@/components/products/product-table";
import { EmptyState } from "@/components/shared/empty-state";
import { ListFilters } from "@/components/shared/list-filters";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { buttonVariants } from "@/components/ui/button";
import { ROUTES } from "@/config/app";
import { canDeleteCatalog, canManageCatalog } from "@/lib/auth/permissions";
import { requireWorkspaceCan } from "@/lib/tenant/context";
import { productListQuerySchema } from "@/lib/validations/catalog";
import { orderCategories } from "@/lib/categories/hierarchy";
import { listCategories } from "@/services/category.service";
import { listProducts } from "@/services/product.service";

export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const query = productListQuerySchema.parse(Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
  const { active, store } = await requireWorkspaceCan("catalog:view");
  const [result, categories] = await Promise.all([listProducts(query), listCategories()]);
  const currency = store?.currency ?? "INR";
  const canManage = canManageCatalog(active);
  const filtered = Boolean(query.q) || query.status !== "all" || query.category !== "all" || query.stock !== "all";

  const importButton = canManage ? (
    <Link href={`${ROUTES.products}/import`} className={buttonVariants({ variant: "outline" })}>
      <Upload aria-hidden /> Import
    </Link>
  ) : null;

  const addButton = canManage ? (
    <Link href={`${ROUTES.products}/new`} className={buttonVariants()}>
      <Plus aria-hidden /> Add product
    </Link>
  ) : null;

  return (
    <>
      <PageHeader title="Products" description="Manage your catalog, pricing and stock." actions={<div className="flex gap-2">{importButton}{addButton}</div>} />

      {result.total === 0 && !filtered ? (
        <EmptyState
          icon={PackageOpen}
          title="No products yet"
          description="Add your first product to start building your catalog. You can add images, variants and stock once it is created."
          action={addButton}
        />
      ) : (
        <>
          <ListFilters
            searchPlaceholder="Search by name or SKU"
            filters={[
              { key: "status", label: "Status", options: [{ value: "all", label: "All statuses" }, { value: "active", label: "Active" }, { value: "draft", label: "Draft" }] },
              {
                key: "category",
                label: "Category",
                options: [{ value: "all", label: "All categories" }, { value: "none", label: "Uncategorised" }, ...orderCategories(categories).map((c) => ({ value: c.id, label: c.label }))],
              },
              {
                key: "stock",
                label: "Inventory",
                options: [
                  { value: "all", label: "Any stock" },
                  { value: "in", label: "In stock" },
                  { value: "low", label: "Low stock" },
                  { value: "out", label: "Out of stock" },
                  { value: "untracked", label: "Not tracked" },
                ],
              },
            ]}
            sortOptions={[
              { value: "created:desc", label: "Newest first" },
              { value: "created:asc", label: "Oldest first" },
              { value: "name:asc", label: "Name A–Z" },
              { value: "name:desc", label: "Name Z–A" },
              { value: "price:asc", label: "Price: low to high" },
              { value: "price:desc", label: "Price: high to low" },
            ]}
          />
          {result.items.length === 0 ? (
            <EmptyState icon={SearchX} title="No products match" description="Try a different search or clear the filters." />
          ) : (
            <>
              <ProductTable rows={result.items} currency={currency} timezone={store?.timezone ?? "UTC"} canManage={canManage} canDelete={canDeleteCatalog(active)} />
              <Pagination page={result.page} pageSize={result.pageSize} total={result.total} basePath={ROUTES.products} params={{ q: query.q, status: query.status, category: query.category, stock: query.stock, sort: raw.sort as string | undefined, dir: raw.dir as string | undefined }} />
            </>
          )}
        </>
      )}
    </>
  );
}
