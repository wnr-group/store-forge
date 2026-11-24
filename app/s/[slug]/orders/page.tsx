import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublishedView } from "@/components/storefront/published-view";
import { ordersDocument } from "@/lib/storefront/documents";
import { getPublicStorefront, getPublishedFrame } from "@/services/storefront.service";

/** The orders this browser placed in this store. The list is read from the browser; each order is fetched with its own token. */

type Params = { params: Promise<{ slug: string }> };

export const metadata: Metadata = { title: "Your orders", robots: { index: false } };

export default async function OrdersPage({ params }: Params) {
  const { slug } = await params;
  if (slug !== slug.toLowerCase()) notFound();
  const store = await getPublicStorefront(slug);
  if (!store) notFound();
  const frame = (await getPublishedFrame(slug)) ?? { layout: { theme: null, groups: {} }, collections: [] };
  return <PublishedView store={store} frame={frame} document={ordersDocument()} />;
}
