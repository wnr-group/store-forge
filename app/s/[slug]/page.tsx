import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TemplateRenderer } from "@/components/storefront/engine/renderer";
import { TemplateView } from "@/components/storefront/templates";
import { resolveTemplateKey, resolveTemplateSettings, savedFromPublic } from "@/lib/templates/resolve";
import { buildRenderContext, loadStorefrontPage } from "@/services/storefront-template.service";
import { EngineReadsDisabledError } from "@/services/engine-cutover.service";
import { getPublicStorefront } from "@/services/storefront.service";
import { publicImageUrl } from "@/lib/storage/paths";

/**
 * Cutover gate: until the persisted cutover marker is complete, loadStorefrontPage throws EngineReadsDisabledError and this page
 * serves the V1 storefront exactly as before (get_public_storefront + the V1 template components). The marker is the only switch.
 */
async function legacyMetadata(slug: string): Promise<Metadata> {
  const store = await getPublicStorefront(slug);
  return store ? { title: store.name, description: store.description ?? undefined } : { title: "Store not found" };
}

async function legacyHome(slug: string) {
  const store = await getPublicStorefront(slug);
  if (!store) notFound();
  const settings = resolveTemplateSettings(store, savedFromPublic(store.template));
  return (
    <div data-template={resolveTemplateKey(store.template?.key)} className="contents">
      <TemplateView templateKey={store.template?.key} store={store} settings={settings} />
    </div>
  );
}

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  if (!slug || slug !== slug.toLowerCase()) return { title: "Store not found" };

  let pageData;
  try {
    pageData = await loadStorefrontPage("index", slug);
  } catch (e) {
    if (e instanceof EngineReadsDisabledError) return legacyMetadata(slug);
    throw e;
  }
  if (!pageData) return { title: "Store not found" };

  const faviconUrl = pageData.faviconPath ? publicImageUrl(pageData.faviconPath) : undefined;

  return {
    title: pageData.store.name,
    description: pageData.store.description ?? undefined,
    icons: faviconUrl ? { icon: faviconUrl } : undefined,
  };
}

export default async function StorefrontPage({ params }: Params) {
  const { slug } = await params;
  if (!slug || slug !== slug.toLowerCase()) notFound();

  let pageData;
  try {
    pageData = await loadStorefrontPage("index", slug);
  } catch (e) {
    if (e instanceof EngineReadsDisabledError) return legacyHome(slug);
    throw e;
  }
  if (!pageData) notFound();

  const renderContext = buildRenderContext(pageData, `/s/${slug}`);

  return (
    <div
      data-template={pageData.layoutKey}
      data-template-source={pageData.source}
      className="contents"
    >
      {pageData.themeCss ? (
        <style>{`:root { ${pageData.themeCss} }`}</style>
      ) : null}
      <TemplateRenderer document={pageData.document} context={renderContext} mode="public" />
    </div>
  );
}
