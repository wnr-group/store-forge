import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublishedView } from "@/components/storefront/published-view";
import { pageDocument } from "@/lib/storefront/documents";
import { defaultPageDocument, PAGE_LABELS, storedPageDocument, withPageContent, type PageKey } from "@/lib/storefront/pages";
import { getPublicContentPage, getPublicLandingPage, getPublicStorefront, getPublishedFrame } from "@/services/storefront.service";
import type { TemplateDocument } from "@/lib/templates/document";

/**
 * A published content page (About, Contact...) at the root of the store's address. Static routes such as /products win over
 * this one. A page written under Pages wins over a theme's designed About or Contact; when the store wrote none, the theme's
 * designed page is shown, if it has one.
 */

type Params = { params: Promise<{ slug: string; pageSlug: string }> };

const DESIGNED: readonly PageKey[] = ["about", "contact"];

/** The theme's saved About or Contact design, when `pageSlug` is one of them and the theme has it. */
async function designedPage(slug: string, pageSlug: string) {
  const key = DESIGNED.find((k) => k === pageSlug);
  if (!key) return null;
  const frame = await getPublishedFrame(slug);
  return frame && storedPageDocument(frame.layout.theme, key) ? { key, frame } : null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, pageSlug } = await params;
  const data = await getPublicContentPage(slug, pageSlug);
  if (data) return { title: `${data.page.title} | ${data.store.name}` };
  const designed = await designedPage(slug, pageSlug);
  const store = designed ? await getPublicStorefront(slug) : null;
  if (designed && store) return { title: `${PAGE_LABELS[designed.key].replace(" page", "")} | ${store.name}` };
  const landing = await getPublicLandingPage(slug, pageSlug);
  if (landing) {
    const s = await getPublicStorefront(slug);
    const storeName = s?.name ?? "";
    const title = landing.page?.seoTitle || landing.page?.title;
    return {
      title: title ? `${title} | ${storeName}` : storeName,
      description: landing.page?.seoDescription || landing.page?.description || undefined,
    };
  }
  return { title: "Page not found" };
}

export default async function ContentPage({ params }: Params) {
  const { slug, pageSlug } = await params;
  if (slug !== slug.toLowerCase() || pageSlug !== pageSlug.toLowerCase()) notFound();
  const [data, store] = await Promise.all([getPublicContentPage(slug, pageSlug), getPublicStorefront(slug)]);
  if (!store) notFound();
  if (!data) {
    const designed = await designedPage(slug, pageSlug);
    if (!designed) {
      const landing = await getPublicLandingPage(slug, pageSlug);
      if (!landing) notFound();
      const frame = await getPublishedFrame(slug);
      return (
        <PublishedView
          store={store}
          frame={frame}
          document={landing.template.document as unknown as TemplateDocument}
        />
      );
    }
    return <PublishedView store={store} frame={designed.frame} document={defaultPageDocument(designed.key)} page={designed.key} />;
  }
  const frame = await getPublishedFrame(slug);
  return <PublishedView store={store} frame={frame} document={pageDocument(data.page.title, data.page.body)} page="content" adapt={(layout) => withPageContent(layout, data.page)} />;
}
