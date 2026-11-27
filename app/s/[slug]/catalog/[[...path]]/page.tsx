import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublishedView } from "@/components/storefront/published-view";
import { catalogDocument } from "@/lib/storefront/documents";
import { parseCatalogQuery } from "@/lib/storefront/catalog";
import { getPublishedCatalogPage } from "@/services/storefront.service";

/**
 * The catalog hierarchy of a store: `/catalog` is the top, `/catalog/<item>/<item>/...` is one item (any depth the owner configured).
 * One route and one data shape for every template: the store's own theme, header and footer frame the page, and the template's look
 * draws it. A store without a published catalog, and an item that does not exist or is not public, are a 404.
 */

type Props = { params: Promise<{ slug: string; path?: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const load = async ({ params, searchParams }: Props) => {
  const { slug, path } = await params;
  if (slug !== slug.toLowerCase()) return null;
  const query = parseCatalogQuery(await searchParams);
  return getPublishedCatalogPage(slug, (path ?? []).join("/"), query.page, query.sort, query.all);
};

export async function generateMetadata(props: Props): Promise<Metadata> {
  const page = await load(props);
  if (!page) return { title: "Not found", robots: { index: false } };
  const { data, store } = page;
  // A re-sorted or "include sub-groups" view repeats the same parts: only the plain address is for search engines.
  const robots = data.query.sort !== "position" || data.query.all ? { index: false, follow: true } : undefined;
  if (data.node) {
    return { title: data.node.seoTitle || `${data.node.name} | ${store.name}`, description: data.node.seoDescription || data.node.description || undefined, robots };
  }
  return { title: `${data.hierarchyName ?? "Catalog"} | ${store.name}`, robots };
}

export default async function CatalogPage(props: Props) {
  const page = await load(props);
  if (!page) notFound();
  return <PublishedView store={page.store} frame={page.frame} document={catalogDocument()} catalog={page.data} />;
}
