import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublishedView } from "@/components/storefront/published-view";
import { productListDocument } from "@/lib/storefront/documents";
import { getPublicStorefront, getPublishedFrame } from "@/services/storefront.service";

/** Every active product of the store. */

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const store = await getPublicStorefront((await params).slug);
  return store ? { title: `All products | ${store.name}` } : { title: "Store not found" };
}

export default async function ProductsPage({ params }: Params) {
  const { slug } = await params;
  if (slug !== slug.toLowerCase()) notFound();
  const store = await getPublicStorefront(slug);
  if (!store) notFound();
  const frame = await getPublishedFrame(slug);
  return <PublishedView store={store} frame={frame} document={productListDocument("All products")} />;
}
