"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { createBrowserStore } from "@/components/storefront/browser-store";
import { consentKey, parseConsent, type Consent } from "@/lib/tracking/consent";
import { GA4_MEASUREMENT_ID, META_PIXEL_ID, toGa4, toMeta, type TrackEvent } from "@/lib/tracking/events";
import { loadFbq, stopFbq, type FbqDocument, type FbqWindow } from "@/lib/tracking/fbq";
import { loadGtag, stopGtag, type GtagDocument, type GtagWindow } from "@/lib/tracking/gtag";

/** What the API says this store may load (`GET /public/stores/:slug/tracking`). Public identifiers only. */
export type TrackingConfig = { providers: { provider: string; config: Record<string, string> }[]; consentRequired: boolean };

export type Tracker = {
  /** Sends the event if tracking is on, agreed to and loaded. Returns whether it was sent; never throws. */
  track: (event: TrackEvent) => boolean;
  /** The shopper's answer, null until they give one. */
  consent: Consent;
  setConsent: (answer: "granted" | "denied") => void;
  /** The store has tracking switched on at all (so the question is worth asking). */
  available: boolean;
  /** Which services are switched on, so the question can name them. */
  services: ("ga4" | "meta_pixel")[];
};

const OFF: Tracker = { track: () => false, consent: null, setConsent: () => {}, available: false, services: [] };
const TrackingContext = createContext<Tracker>(OFF);

/** Outside a store (theme editor and preview, dashboard) this is a tracker that does nothing. */
export const useTracker = (): Tracker => useContext(TrackingContext);

const gtagWindow = () => window as unknown as GtagWindow;
const gtagDocument = () => document as unknown as GtagDocument;
const fbqWindow = () => window as unknown as FbqWindow;
const fbqDocument = () => document as unknown as FbqDocument;

/** An id that is different for every event that has no order behind it. */
const newEventId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);

/**
 * Loads the analytics this store switched on (Google Analytics 4 and/or Meta Pixel), each only when ALL of these hold: the store owner
 * switched it on and it validated, the shopper agreed, and the ID has the exact shape of that service's ID. Nothing is queued before consent: an event that happens before
 * the shopper agrees is simply not sent. A tag that fails to load is ignored; it can never break a page, the bag or checkout.
 */
export function TrackingProvider({ slug, config, children }: { slug: string; config: TrackingConfig | null; children: React.ReactNode }) {
  const measurementId = useMemo(() => {
    const id = config?.providers.find((p) => p.provider === "ga4")?.config.measurementId;
    return id && GA4_MEASUREMENT_ID.test(id) ? id : null;
  }, [config]);
  const pixelId = useMemo(() => {
    const id = config?.providers.find((p) => p.provider === "meta_pixel")?.config.pixelId;
    return id && META_PIXEL_ID.test(id) ? id : null;
  }, [config]);
  const services = useMemo<Tracker["services"]>(() => [...(measurementId ? (["ga4"] as const) : []), ...(pixelId ? (["meta_pixel"] as const) : [])], [measurementId, pixelId]);
  const available = services.length > 0;

  const store = useMemo(() => createBrowserStore(consentKey(slug), true), [slug]);
  const raw = useSyncExternalStore(store.subscribe, store.read, () => null);
  const consent = parseConsent(raw);
  // The shopper's answer decides what happens to each tag. Agreeing loads it (a blocked or failing tag is ignored: it must never break
  // the page, the bag or checkout); taking the agreement back opts out and clears the cookies the services set.
  useEffect(() => {
    try {
      if (measurementId) {
        if (consent === "granted") loadGtag(gtagWindow(), gtagDocument(), measurementId);
        else if (consent === "denied") stopGtag(gtagWindow(), gtagDocument(), measurementId);
      }
      if (pixelId) {
        if (consent === "granted") loadFbq(fbqWindow(), fbqDocument(), pixelId);
        else if (consent === "denied") stopFbq(fbqWindow(), fbqDocument());
      }
    } catch {
      // Nothing to do: the store simply is not measured.
    }
  }, [measurementId, pixelId, consent]);

  const track = useCallback(
    (event: TrackEvent): boolean => {
      if (consent !== "granted") return false;
      let sent = false;
      // Each service is independent: one that fails never stops the other, and neither can disturb the page.
      if (measurementId) {
        try {
          // Components below run their effects before this provider does, so the tag is made ready here too (it is idempotent).
          loadGtag(gtagWindow(), gtagDocument(), measurementId);
          const { name, params } = toGa4(event);
          gtagWindow().gtag?.("event", name, params);
          sent = true;
        } catch {
          // Not sent to Google.
        }
      }
      if (pixelId) {
        try {
          loadFbq(fbqWindow(), fbqDocument(), pixelId);
          const { name, params, eventId } = toMeta(event, newEventId);
          fbqWindow().fbq?.("track", name, params, { eventID: eventId });
          sent = true;
        } catch {
          // Not sent to Meta.
        }
      }
      return sent;
    },
    [measurementId, pixelId, consent],
  );

  // Every page the shopper opens (the first one too), once they have agreed.
  const pathname = usePathname();
  useEffect(() => {
    track({ type: "page_view", path: pathname, title: document.title });
  }, [pathname, track]);

  const setConsent = useCallback(
    (answer: "granted" | "denied") => {
      store.write(answer);
    },
    [store],
  );

  const value = useMemo<Tracker>(() => ({ track, consent, setConsent, available, services }), [track, consent, setConsent, available, services]);
  return <TrackingContext.Provider value={value}>{children}</TrackingContext.Provider>;
}
