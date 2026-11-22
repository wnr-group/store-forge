import { TemplateRenderer } from "@/components/storefront/engine/renderer";
import type { CollectionProductSummary, RenderContext } from "@/components/storefront/engine/types";
import { withPageBackground } from "@/lib/storefront/documents";
import { resolvePageDocument, type PageKey } from "@/lib/storefront/pages";
import { pruneInactiveNodes, serverClock } from "@/lib/templates/display-prune";
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
  // The server clock, taken once per render. Scheduled sections and blocks that are not active now are removed here, on the
  // server, so they never reach the HTML or the client payload; the renderer judges the same instant for what is left.
  const now = serverClock();
  const active = (doc: Record<string, unknown> | null | undefined) => (doc ? pruneInactiveNodes(doc as Parameters<typeof pruneInactiveNodes>[0], now) : doc);
  const context: RenderContext = {
    store,
    collections: frame?.collections ?? [],
    collectionProducts: frame?.collectionProducts,
    resource,
    theme: frame?.layout.theme ?? undefined,
    groupHeader: active(frame?.layout.groups.header) ?? undefined,
    groupFooter: active(frame?.layout.groups.footer) ?? undefined,
    groupAnnouncement: active(frame?.layout.groups.announcement) ?? undefined,
    basePath: "",
    serverNow: now,
  };
  const fallback = withPageBackground(document, context.theme);
  const chosen = page ? resolvePageDocument(context.theme, page, fallback) : document;
  return <TemplateRenderer document={pruneInactiveNodes(adapt && chosen !== fallback ? adapt(chosen) : chosen, now)} mode="public" context={context} />;
}
