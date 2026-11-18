import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublishedView } from "@/components/storefront/published-view";
import { pageDocument } from "@/lib/storefront/documents";
import { withPageContent } from "@/lib/storefront/pages";
import { getPublicContentPage, getPublicStorefront, getPublishedFrame } from "@/services/storefront.service";

/** A published content page (About, Contact...) at the root of the store's address. Static routes such as /products win over this one. */

type Params = { params: Promise<{ slug: string; pageSlug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, pageSlug } = await params;
  const data = await getPublicContentPage(slug, pageSlug);
  return data ? { title: `${data.page.title} | ${data.store.name}` } : { title: "Page not found" };
}

export default async function ContentPage({ params }: Params) {
  const { slug, pageSlug } = await params;
  if (slug !== slug.toLowerCase() || pageSlug !== pageSlug.toLowerCase()) notFound();
  const [data, store] = await Promise.all([getPublicContentPage(slug, pageSlug), getPublicStorefront(slug)]);
  if (!data || !store) notFound();
  const frame = await getPublishedFrame(slug);
  return <PublishedView store={store} frame={frame} document={pageDocument(data.page.title, data.page.body)} page="content" adapt={(layout) => withPageContent(layout, data.page)} />;
}
