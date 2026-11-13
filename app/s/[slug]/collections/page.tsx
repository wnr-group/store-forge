import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublishedView } from "@/components/storefront/published-view";
import { getPublicCollectionsApi } from "@/lib/api/endpoints/public-api";
import { collectionsDocument } from "@/lib/storefront/documents";
import { getPublicStorefront, getPublishedFrame } from "@/services/storefront.service";

/** Every active collection of the store. */

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const store = await getPublicStorefront((await params).slug);
  return store ? { title: `Collections | ${store.name}` } : { title: "Store not found" };
}

export default async function CollectionsPage({ params }: Params) {
  const { slug } = await params;
  if (slug !== slug.toLowerCase()) notFound();
  const store = await getPublicStorefront(slug);
  if (!store) notFound();
  const frame = (await getPublishedFrame(slug)) ?? { layout: { theme: null, groups: {} }, collections: [] };
  // Collections come straight from the API so the page also works before a design is published.
  const collections = await getPublicCollectionsApi(slug).catch(() => frame.collections);
  return <PublishedView store={store} frame={{ ...frame, collections }} document={collectionsDocument()} />;
}
