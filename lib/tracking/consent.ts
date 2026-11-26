/**
 * The shopper's answer to "may we measure how this store is used?". Kept per store in the browser, so a decision in one store
 * says nothing about another. Nothing is measured until the answer is "granted", and "denied" is the same as no answer for
 * everything except whether the question is asked again.
 */
export type Consent = "granted" | "denied" | null;

const PREFIX = "sf-consent:v1:";

export const consentKey = (storeSlug: string) => `${PREFIX}${storeSlug}`;

/** Reads a stored answer. Anything that is not exactly one of the two answers counts as no answer. */
export function parseConsent(raw: string | null): Consent {
  return raw === "granted" || raw === "denied" ? raw : null;
}

/** What the shopper is asked to agree to, naming exactly the services this store has switched on. */
export function consentCopy(services: readonly ("ga4" | "meta_pixel")[]): string {
  const google = services.includes("ga4");
  const meta = services.includes("meta_pixel");
  if (google && meta)
    return "We would like to use Google Analytics and the Meta Pixel to see which pages and products are popular and to measure our advertising. They set cookies in your browser and send usage data to Google and to Meta.";
  if (meta) return "We would like to use the Meta Pixel to see which products are viewed and bought and to measure our advertising on Facebook and Instagram. It sets cookies in your browser and sends usage data to Meta.";
  return "We would like to use Google Analytics to see which pages and products are popular. It sets cookies in your browser and sends anonymous usage data to Google.";
}
