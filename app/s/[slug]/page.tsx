import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TemplateRenderer } from "@/components/storefront/engine/renderer";
import { TemplateView } from "@/components/storefront/templates";
import type { TemplateDocument } from "@/lib/templates/document";
import { resolveTemplateKey, resolveTemplateSettings, savedFromPublic } from "@/lib/templates/resolve";
import { getPublicStorefront, getPublishedDesign } from "@/services/storefront.service";

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

  // A published design from the Theme Store wins; without one the store keeps its built-in template.
  const design = await getPublishedDesign(slug);
  if (design) {
    const { layout, collections } = design;
    return (
      <TemplateRenderer
        document={layout.template.document as unknown as TemplateDocument}
        mode="public"
        context={{
          store,
          collections,
          theme: layout.theme ?? undefined,
          groupHeader: layout.groups.header ?? undefined,
          groupFooter: layout.groups.footer ?? undefined,
          groupAnnouncement: layout.groups.announcement ?? undefined,
        }}
      />
    );
  }

  const settings = resolveTemplateSettings(store, savedFromPublic(store.template));
  return (
    <div data-template={resolveTemplateKey(store.template?.key)} className="contents">
      <TemplateView templateKey={store.template?.key} store={store} settings={settings} />
    </div>
  );
}
