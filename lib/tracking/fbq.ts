import { META_PIXEL_ID } from "./events";

type Fbq = {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[];
  push: Fbq;
  loaded: boolean;
  version: string;
};

/** The few things Meta's script puts on `window`, plus the flags this file keeps so it can be called again and again. */
export type FbqWindow = { fbq?: Fbq; _fbq?: unknown; [key: string]: unknown };

/** The part of `document` this needs, so it can be tested without a browser. */
export type FbqDocument = {
  querySelector: (selector: string) => unknown;
  createElement: (tag: "script") => { async: boolean; src: string; dataset: Record<string, string>; onerror: (() => void) | null };
  head: { appendChild: (node: unknown) => unknown };
  cookie: string;
};

export const FBQ_SCRIPT = "https://connect.facebook.net/en_US/fbevents.js";

/**
 * Loads Meta's own Pixel script for `pixelId`. Called only after the shopper has agreed to analytics. Meta's "automatic
 * configuration" (which watches clicks and page markup and reports more than the store asked for) is switched off, and no page view
 * is sent by the script itself: the store sends the standard events it means to, with event ids. Safe to call again and again.
 * Throws for anything that is not a Pixel ID, so a bad value can never reach the script.
 */
export function loadFbq(win: FbqWindow, doc: FbqDocument, pixelId: string, onError?: () => void): void {
  if (!META_PIXEL_ID.test(pixelId)) throw new Error("not a Pixel ID");
  if (!win.fbq) {
    // The queue Meta's script expects before it has loaded: it replays `arguments` objects in order.
    const fbq = Object.assign(
      function () {
        const self = win.fbq as Fbq;
        // eslint-disable-next-line prefer-rest-params
        if (self.callMethod) self.callMethod(...Array.from(arguments));
        // eslint-disable-next-line prefer-rest-params
        else self.queue.push(arguments);
      },
      { loaded: true, version: "2.0", queue: [] as unknown[] },
    ) as unknown as Fbq;
    fbq.push = fbq;
    win.fbq = fbq;
    if (!win._fbq) win._fbq = fbq;
  }
  if (!doc.querySelector("script[data-sf-fbq]")) {
    const script = doc.createElement("script");
    script.async = true;
    script.dataset.sfFbq = "1";
    script.src = FBQ_SCRIPT;
    script.onerror = () => onError?.();
    doc.head.appendChild(script);
  }
  const fbq = win.fbq;
  if (!win[`sf-fbq-init-${pixelId}`]) {
    fbq("set", "autoConfig", false, pixelId);
    fbq("init", pixelId);
    win[`sf-fbq-init-${pixelId}`] = true;
  }
  // Back after the shopper had taken their agreement back.
  if (win["sf-fbq-revoked"]) {
    fbq("consent", "grant");
    win["sf-fbq-revoked"] = false;
  }
}

/** Meta's documented way to stop: revoke consent, and remove the cookies it set. */
export function stopFbq(win: FbqWindow, doc: FbqDocument): void {
  win.fbq?.("consent", "revoke");
  win["sf-fbq-revoked"] = true;
  for (const name of ["_fbp", "_fbc"]) doc.cookie = `${name}=; Max-Age=0; path=/`;
}
