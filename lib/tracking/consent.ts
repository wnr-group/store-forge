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
