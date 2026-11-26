import { GA4_MEASUREMENT_ID } from "./events";

/** The few things Google's tag puts on `window`, plus the per-ID opt-out switch it documents (`ga-disable-<ID>`). */
export type GtagWindow = { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void; [key: string]: unknown };

/** The part of `document` this needs, so it can be tested without a browser. */
export type GtagDocument = {
  querySelector: (selector: string) => unknown;
  createElement: (tag: "script") => { async: boolean; src: string; dataset: Record<string, string>; onerror: (() => void) | null };
  head: { appendChild: (node: unknown) => unknown };
  cookie: string;
};

export const GTAG_HOST = "https://www.googletagmanager.com/gtag/js";

/**
 * Loads Google's own tag for `measurementId`. Called only after the shopper has agreed to analytics. Ad storage and ad
 * personalization stay denied, Google's signals features stay off, and the tag does not send page views by itself (the store sends
 * one per page it shows). Safe to call again and again: the script is added once and the tag configured once. Throws for anything that is not a Measurement ID, so a bad
 * value can never become part of a script address.
 */
export function loadGtag(win: GtagWindow, doc: GtagDocument, measurementId: string, onError?: () => void): void {
  if (!GA4_MEASUREMENT_ID.test(measurementId)) throw new Error("not a Measurement ID");
  win.dataLayer = win.dataLayer ?? [];
  if (!win.gtag) {
    const layer = win.dataLayer;
    // gtag.js reads the `arguments` object itself, not an array: this must be a plain function, not an arrow function.
    win.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      layer.push(arguments);
    };
    win.gtag("consent", "default", { analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
    win.gtag("js", new Date());
  }
  win[`ga-disable-${measurementId}`] = false;
  if (!doc.querySelector(`script[data-sf-gtag="${measurementId}"]`)) {
    const script = doc.createElement("script");
    script.async = true;
    script.dataset.sfGtag = measurementId;
    script.src = `${GTAG_HOST}?id=${encodeURIComponent(measurementId)}`;
    script.onerror = () => onError?.();
    doc.head.appendChild(script);
  }
  // Configured once per page load, however many events ask for the tag.
  if (!win[`sf-gtag-configured-${measurementId}`]) {
    win.gtag("config", measurementId, { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false });
    win[`sf-gtag-configured-${measurementId}`] = true;
  }
}

/** Google's documented opt-out, plus removing the cookies it set, for a shopper who takes their agreement back. */
export function stopGtag(win: GtagWindow, doc: GtagDocument, measurementId: string): void {
  win[`ga-disable-${measurementId}`] = true;
  const suffix = measurementId.replace("G-", "");
  for (const name of ["_ga", `_ga_${suffix}`]) doc.cookie = `${name}=; Max-Age=0; path=/`;
}
