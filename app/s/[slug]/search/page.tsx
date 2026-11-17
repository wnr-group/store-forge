import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublishedView } from "@/components/storefront/published-view";
import { productListDocument, searchProducts } from "@/lib/storefront/documents";
import { getPublicStorefront, getPublishedFrame } from "@/services/storefront.service";

/** Search over the store's own products. The term comes from `?q=` and only filters the store's public product list. */

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ q?: string | string[] }> };

export const metadata: Metadata = { title: "Search", robots: { index: false } };

export default async function SearchPage({ params, searchParams }: Props) {
  const { slug } = await params;
  if (slug !== slug.toLowerCase()) notFound();
  const store = await getPublicStorefront(slug);
  if (!store) notFound();
  const raw = (await searchParams).q;
  const term = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, 100) ?? "";
  const results = searchProducts(store.products, term);
  const frame = await getPublishedFrame(slug);
  const note = !term
    ? "Type a product name in the box above to search this store."
    : results.length === 0
      ? `No products match "${term}".`
      : `${results.length} result${results.length === 1 ? "" : "s"} for "${term}".`;
  return <PublishedView store={store} frame={frame} resource={{ products: results }} document={productListDocument(term ? `Search: ${term}` : "Search", note)} />;
}
