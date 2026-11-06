import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TemplateView } from "@/components/storefront/templates";
import { resolveTemplateKey, resolveTemplateSettings, savedFromPublic } from "@/lib/templates/resolve";
import { getPublicStorefront } from "@/services/storefront.service";

/**
 * Public storefront, reached through the proxy rewrite from <slug>.<root domain>. Everything shown
 * comes from get_public_storefront(): public fields of an active store only, plus its selected template
 * and saved customization (the default template when none is saved).
 */
type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const store = await getPublicStorefront((await params).slug);
  return store ? { title: store.name, description: store.description ?? undefined } : { title: "Store not found" };
}

export default async function StorefrontPage({ params }: Params) {
  const { slug } = await params;
  // Also reachable as /s/<slug> on the main domain; the data is public either way.
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
