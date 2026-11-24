"use client";

import { useState } from "react";
import { useTracker } from "./tracking-provider";

/**
 * Asks the shopper once whether the store may measure how it is used, and lets them change their mind later. It appears only
 * for a store that has analytics switched on, and the store works the same whatever the answer. Plain and neutral so it sits
 * on any theme.
 */
export function ConsentBanner() {
  const { available, consent, setConsent } = useTracker();
  const [reopened, setReopened] = useState(false);
  if (!available) return null;

  if (consent !== null && !reopened) {
    return (
      <button
        type="button"
        onClick={() => setReopened(true)}
        className="fixed bottom-3 left-3 z-40 rounded border border-border bg-background/95 px-2.5 py-1 text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        Cookie settings
      </button>
    );
  }

  const answer = (a: "granted" | "denied") => {
    setConsent(a);
    setReopened(false);
  };
  return (
    <section aria-label="Cookie consent" className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl rounded-md border border-border bg-background p-4 text-[13px] text-foreground shadow-md sm:left-auto sm:right-3 sm:mx-0">
      <p className="font-medium">Help us improve this store</p>
      <p className="mt-1 text-muted-foreground">
        We would like to use Google Analytics to see which pages and products are popular. It sets cookies in your browser and sends anonymous usage data to Google. The store works the same if you say no.
        {consent ? ` Your current choice: ${consent === "granted" ? "analytics on" : "analytics off"}.` : ""}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => answer("granted")} className="rounded bg-foreground px-3 py-1.5 text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2">
          Allow analytics
        </button>
        <button type="button" onClick={() => answer("denied")} className="rounded border border-border px-3 py-1.5 hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2">
          No thanks
        </button>
      </div>
    </section>
  );
}
