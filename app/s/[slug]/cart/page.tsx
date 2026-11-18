import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublishedView } from "@/components/storefront/published-view";
import { cartDocument } from "@/lib/storefront/documents";
import { getPublicStorefront, getPublishedFrame } from "@/services/storefront.service";

/** The shopper's bag. The page holds no store data of its own: the lines come from the browser's cart for this store. */

type Params = { params: Promise<{ slug: string }> };

export const metadata: Metadata = { title: "Your bag", robots: { index: false } };

export default async function CartPage({ params }: Params) {
  const { slug } = await params;
  if (slug !== slug.toLowerCase()) notFound();
  const store = await getPublicStorefront(slug);
  if (!store) notFound();
  const frame = (await getPublishedFrame(slug)) ?? { layout: { theme: null, groups: {} }, collections: [] };
  return <PublishedView store={store} frame={frame} document={cartDocument()} page="cart" />;
}
