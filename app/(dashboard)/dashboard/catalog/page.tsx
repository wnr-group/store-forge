import type { Metadata } from "next";
import { CatalogManager } from "@/components/catalog/catalog-manager";
import { canDeleteCatalog, canManageCatalog } from "@/lib/auth/permissions";
import { requireWorkspaceCan } from "@/lib/tenant/context";
import { getCatalogHierarchy, getCatalogTree } from "@/services/catalog.service";

export const metadata: Metadata = { title: "Catalog hierarchy" };

export default async function CatalogPage() {
  const { active, store } = await requireWorkspaceCan("catalog:view");
  const hierarchy = await getCatalogHierarchy();
  // No hierarchy yet: nothing to read (the tree call would answer the same "not set up").
  const tree = hierarchy ? await getCatalogTree() : { nodes: [], truncated: false };
  return <CatalogManager hierarchy={hierarchy} tree={tree.nodes} truncated={tree.truncated} canManage={canManageCatalog(active)} canDelete={canDeleteCatalog(active)} currency={store?.currency ?? "INR"} />;
}
