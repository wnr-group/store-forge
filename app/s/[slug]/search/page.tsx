import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublishedView } from "@/components/storefront/published-view";
import { getPublicCollectionApi } from "@/lib/api/endpoints/public-api";
import { productListDocument, searchProducts } from "@/lib/storefront/documents";
import { getPublicStorefront, getPublishedFrame } from "@/services/storefront.service";

/**
 * Search over the store's own products. The term comes from `?q=` and only filters the store's public product list. An
 * optional `?cat=<collection slug>` (the category menu of the Marketplace search bar) narrows it to that collection's products.
 */

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ q?: string | string[]; cat?: string | string[] }> };

export const metadata: Metadata = { title: "Search", robots: { index: false } };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.trim().slice(0, 100) ?? "";

export default async function SearchPage({ params, searchParams }: Props) {
  const { slug } = await params;
  if (slug !== slug.toLowerCase()) notFound();
  const store = await getPublicStorefront(slug);
  if (!store) notFound();
  const query = await searchParams;
  const term = first(query.q);
  const cat = first(query.cat);

  let results = searchProducts(store.products, term);
  let scope = "";
  if (cat) {
    // The collection is read inside this store only; a collection that cannot be read leaves the search unscoped.
    const collection = await getPublicCollectionApi(slug, cat).then((c) => c, () => null);
    if (collection) {
      const inside = new Set(collection.products.map((p) => p.slug));
      results = results.filter((p) => inside.has(p.slug));
      scope = collection.collection.name;
    }
  }

  const frame = await getPublishedFrame(slug);
  const where = scope ? ` in ${scope}` : "";
  const note = !term
    ? "Type a product name in the box above to search this store."
    : results.length === 0
      ? `No products match "${term}"${where}.`
      : `${results.length} result${results.length === 1 ? "" : "s"} for "${term}"${where}.`;
  return <PublishedView store={store} frame={frame} resource={{ products: results }} document={productListDocument(term ? `Search: ${term}` : "Search", note)} />;
}
