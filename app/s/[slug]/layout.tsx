import type { Metadata } from "next";
import { ConsentBanner } from "@/components/storefront/tracking/consent-banner";
import { TrackingProvider } from "@/components/storefront/tracking/tracking-provider";
import { faviconMetadata } from "@/lib/storefront/seo";
import { getTrackingConfig } from "@/services/integrations.service";
import { getStorefrontFavicon } from "@/services/storefront.service";

type LayoutParams = { params: Promise<{ slug: string }> };

/**
 * The store's own tab icon on every page of its storefront: the favicon of its published theme (Studio > Brand). A store without
 * one adds nothing here, so the platform icons declared by the root layout stay. The slug selects the one theme and the API returns
 * only that store's published data; the favicon's folder was checked against the store's own tenant when the theme was saved
 * (this page cannot re-check it: the public response has no tenant id).
 */
export async function generateMetadata({ params }: LayoutParams): Promise<Metadata> {
  const { slug } = await params;
  if (!slug || slug !== slug.toLowerCase()) return {};
  return faviconMetadata(await getStorefrontFavicon(slug));
}

/**
 * Wraps every page of a store with its analytics settings. The settings come from the StoreForge API for THIS store only (cached
 * under the store's own tag, so a change in the dashboard shows on the next page) and describe what MAY be loaded: nothing is
 * loaded until the shopper agrees, and a store without analytics gets no banner and loads nothing. If the settings cannot be
 * read the store simply has no tracking; the page is not affected.
 */
export default async function StorefrontLayout({ children, params }: LayoutParams & { children: React.ReactNode }) {
  const { slug } = await params;
  const config = slug && slug === slug.toLowerCase() ? await getTrackingConfig(slug) : null;
  return (
    <TrackingProvider slug={slug} config={config}>
      {children}
      <ConsentBanner />
    </TrackingProvider>
  );
}
