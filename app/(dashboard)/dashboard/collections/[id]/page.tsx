import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { CollectionForm } from "@/components/collections/collection-form";
import { PageHeader } from "@/components/shared/page-header";
import { canDeleteCatalog } from "@/lib/auth/permissions";
import { requireWorkspace } from "@/lib/tenant/context";
import { getCollection, listProductOptions } from "@/services/collection.service";

export const metadata: Metadata = { title: "Edit collection" };

export default async function EditCollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { active } = await requireWorkspace();
  const [collection, products] = await Promise.all([getCollection(id), listProductOptions()]);
  if (!collection) notFound();
  return (
    <>
      <PageHeader title={collection.name} description={`/${collection.slug}`} />
      <CollectionForm key={collection.updatedAt.toISOString()} mode="edit" initial={collection} products={products} canDelete={canDeleteCatalog(active.role)} />
    </>
  );
}
