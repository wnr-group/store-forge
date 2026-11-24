import { ConsentBanner } from "@/components/storefront/tracking/consent-banner";
import { TrackingProvider } from "@/components/storefront/tracking/tracking-provider";
import { getTrackingConfig } from "@/services/integrations.service";

/**
 * Wraps every page of a store with its analytics settings. The settings come from the StoreForge API for THIS store only (cached
 * under the store's own tag, so a change in the dashboard shows on the next page) and describe what MAY be loaded: nothing is
 * loaded until the shopper agrees, and a store without analytics gets no banner and loads nothing. If the settings cannot be
 * read the store simply has no tracking; the page is not affected.
 */
export default async function StorefrontLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const config = slug && slug === slug.toLowerCase() ? await getTrackingConfig(slug) : null;
  return (
    <TrackingProvider slug={slug} config={config}>
      {children}
      <ConsentBanner />
    </TrackingProvider>
  );
}
