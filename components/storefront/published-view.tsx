import { TemplateRenderer } from "@/components/storefront/engine/renderer";
import type { CollectionProductSummary, RenderContext } from "@/components/storefront/engine/types";
import { withPageBackground } from "@/lib/storefront/documents";
import { resolvePageDocument, type PageKey } from "@/lib/storefront/pages";
import type { TemplateDocument } from "@/lib/templates/document";
import type { PublicCollectionApi, PublicLayoutApi } from "@/lib/api/endpoints/public-api";
import type { PublicStorefront } from "@/services/storefront.service";

type Frame = { layout: Pick<PublicLayoutApi, "theme" | "groups">; collections: PublicCollectionApi[]; collectionProducts?: Record<string, CollectionProductSummary[]> } | null;

/**
 * Renders one storefront page with the same engine the editor preview uses. `frame` carries the store's published
 * theme and header/footer/announcement; without a published design the engine's built-in chrome is used. Links are
 * rooted at "" because a store lives at the root of its own address.
 */
export function PublishedView({
  store,
  document,
  frame,
  resource,
  page,
  adapt,
}: {
  store: PublicStorefront;
  document: TemplateDocument;
  frame: Frame;
  resource?: Record<string, unknown>;
  /** A generated page the merchant can design: their edited version, if saved in the theme, replaces `document`. */
  page?: PageKey;
  /** Final touch on the page chosen above (the search page puts its live title and note in). */
  adapt?: (doc: TemplateDocument) => TemplateDocument;
}) {
  const context: RenderContext = {
    store,
    collections: frame?.collections ?? [],
    collectionProducts: frame?.collectionProducts,
    resource,
    theme: frame?.layout.theme ?? undefined,
    groupHeader: frame?.layout.groups.header ?? undefined,
    groupFooter: frame?.layout.groups.footer ?? undefined,
    groupAnnouncement: frame?.layout.groups.announcement ?? undefined,
    basePath: "",
  };
  const fallback = withPageBackground(document, context.theme);
  const chosen = page ? resolvePageDocument(context.theme, page, fallback) : document;
  return <TemplateRenderer document={adapt && chosen !== fallback ? adapt(chosen) : chosen} mode="public" context={context} />;
}
