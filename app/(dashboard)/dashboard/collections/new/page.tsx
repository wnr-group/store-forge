import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CollectionForm } from "@/components/collections/collection-form";
import { PageHeader } from "@/components/shared/page-header";
import { ROUTES } from "@/config/app";
import { canManageCatalog } from "@/lib/auth/permissions";
import { requireWorkspaceCan } from "@/lib/tenant/context";
import { listProductOptions } from "@/services/collection.service";

export const metadata: Metadata = { title: "New collection" };

export default async function NewCollectionPage() {
  const { active } = await requireWorkspaceCan("catalog:view");
  if (!canManageCatalog(active)) redirect(ROUTES.collections);
  return (
    <>
      <PageHeader title="New collection" />
      <CollectionForm mode="create" products={await listProductOptions()} canDelete={false} />
    </>
  );
}
