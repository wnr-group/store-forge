import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublishedView } from "@/components/storefront/published-view";
import { orderDocument } from "@/lib/storefront/documents";
import { getPublicStorefront, getPublishedFrame } from "@/services/storefront.service";

/** One order. The page is the same for everyone; the order itself is fetched in the browser with the token saved at checkout. */

type Params = { params: Promise<{ slug: string; orderNumber: string }> };

export const metadata: Metadata = { title: "Your order", robots: { index: false } };

export default async function OrderPage({ params }: Params) {
  const { slug, orderNumber } = await params;
  if (slug !== slug.toLowerCase() || !/^[1-9]\d{0,9}$/.test(orderNumber)) notFound();
  const store = await getPublicStorefront(slug);
  if (!store) notFound();
  const frame = (await getPublishedFrame(slug)) ?? { layout: { theme: null, groups: {} }, collections: [] };
  return <PublishedView store={store} frame={frame} document={orderDocument()} resource={{ orderNumber: Number(orderNumber) }} />;
}
