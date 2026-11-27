import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CatalogImport } from "@/components/catalog/catalog-import";
import { PageHeader } from "@/components/shared/page-header";
import { ROUTES } from "@/config/app";
import { canManageCatalog } from "@/lib/auth/permissions";
import { requireWorkspaceCan } from "@/lib/tenant/context";
import { getCatalogHierarchy } from "@/services/catalog.service";

export const metadata: Metadata = { title: "Import catalog" };
export const runtime = "nodejs";

export default async function ImportCatalogPage() {
  const { active } = await requireWorkspaceCan("catalog:view");
  if (!canManageCatalog(active)) redirect(ROUTES.catalog);
  const hierarchy = await getCatalogHierarchy();
  return (
    <>
      <PageHeader title="Import catalog" description="Create levels, items and product placements from a CSV or Excel file. You see what will happen before anything is saved." />
      <CatalogImport hierarchyExists={hierarchy !== null} levelNames={hierarchy?.levels.map((l) => l.name) ?? []} />
    </>
  );
}
