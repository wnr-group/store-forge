import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublishedView } from "@/components/storefront/published-view";
import type { TemplateDocument } from "@/lib/templates/document";
import { getPublishedCollectionPage } from "@/services/storefront.service";

/** A collection page, drawn by the store's published collection design. Unknown or inactive collections are a 404. */

type Params = { params: Promise<{ slug: string; collectionSlug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, collectionSlug } = await params;
  const page = await getPublishedCollectionPage(slug, collectionSlug);
  if (!page) return { title: "Collection not found" };
  return { title: `${String(page.resource.name)} | ${page.store.name}`, description: (page.resource.description as string | null) ?? undefined };
}

export default async function CollectionPage({ params }: Params) {
  const { slug, collectionSlug } = await params;
  if (slug !== slug.toLowerCase()) notFound();
  const page = await getPublishedCollectionPage(slug, collectionSlug);
  if (!page) notFound();
  return <PublishedView store={page.store} frame={page} document={page.layout.template.document as unknown as TemplateDocument} resource={page.resource} />;
}
