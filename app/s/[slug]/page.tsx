import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublishedView } from "@/components/storefront/published-view";
import { TemplateView } from "@/components/storefront/templates";
import { homeMetadata } from "@/lib/storefront/seo";
import type { TemplateDocument } from "@/lib/templates/document";
import { resolveTemplateKey, resolveTemplateSettings, savedFromPublic } from "@/lib/templates/resolve";
import { getPublicStorefront, getPublishedDesign } from "@/services/storefront.service";

/** The public storefront: everything comes from the StoreForge API (GET public storefront) and renders with the store's own template settings. */

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  if (!slug || slug !== slug.toLowerCase()) return { title: "Store not found" };
  const store = await getPublicStorefront(slug);
  // Home page only: the store's own SEO title and description, falling back to its name and description (see lib/storefront/seo.ts).
  return store ? homeMetadata(store) : { title: "Store not found" };
}

export default async function StorefrontPage({ params }: Params) {
  const { slug } = await params;
  if (!slug || slug !== slug.toLowerCase()) notFound();
  const store = await getPublicStorefront(slug);
  if (!store) notFound();

  // A published design from the Theme Store wins; without one the store keeps its built-in template.
  const design = await getPublishedDesign(slug);
  if (design) {
    return <PublishedView store={store} frame={design} document={design.layout.template.document as unknown as TemplateDocument} />;
  }

  const settings = resolveTemplateSettings(store, savedFromPublic(store.template));
  return (
    <div data-template={resolveTemplateKey(store.template?.key)} className="contents">
      <TemplateView templateKey={store.template?.key} store={store} settings={settings} />
    </div>
  );
}
