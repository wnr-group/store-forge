import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublishedView } from "@/components/storefront/published-view";
import type { TemplateDocument } from "@/lib/templates/document";
import { getPublishedProductPage } from "@/services/storefront.service";

/** A product page of the store, drawn by the store's published product design. Unknown or inactive products are a 404. */

type Params = { params: Promise<{ slug: string; productSlug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, productSlug } = await params;
  const page = await getPublishedProductPage(slug, productSlug);
  if (!page) return { title: "Product not found" };
  return { title: `${String(page.resource.name)} | ${page.store.name}`, description: (page.resource.short_description as string | null) ?? undefined };
}

export default async function ProductPage({ params }: Params) {
  const { slug, productSlug } = await params;
  if (slug !== slug.toLowerCase()) notFound();
  const page = await getPublishedProductPage(slug, productSlug);
  if (!page) notFound();
  return <PublishedView store={page.store} frame={page} document={page.layout.template.document as unknown as TemplateDocument} resource={page.resource} />;
}
