import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TemplateView } from "@/components/storefront/templates";
import { resolveTemplateKey, resolveTemplateSettings, savedFromPublic } from "@/lib/templates/resolve";
import { getPublicStorefront } from "@/services/storefront.service";

/** The public storefront: everything comes from the StoreForge API (GET public storefront) and renders with the store's own template settings. */

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  if (!slug || slug !== slug.toLowerCase()) return { title: "Store not found" };
  const store = await getPublicStorefront(slug);
  return store ? { title: store.name, description: store.description ?? undefined } : { title: "Store not found" };
}

export default async function StorefrontPage({ params }: Params) {
  const { slug } = await params;
  if (!slug || slug !== slug.toLowerCase()) notFound();
  const store = await getPublicStorefront(slug);
  if (!store) notFound();
  const settings = resolveTemplateSettings(store, savedFromPublic(store.template));
  return (
    <div data-template={resolveTemplateKey(store.template?.key)} className="contents">
      <TemplateView templateKey={store.template?.key} store={store} settings={settings} />
    </div>
  );
}
