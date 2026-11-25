import { ROUTES } from "@/config/app";

/**
 * What the plan decides on the screens, in one place: which feature a screen needs and how to read the plan's answer.
 * Display only - the API's FeatureGuard refuses the calls whatever the screens show. The keys are the API's feature catalog.
 */
export type FeatureKey =
  | "discount_codes"
  | "abandoned_cart_recovery"
  | "marketing_campaigns"
  | "advanced_reports"
  | "google_analytics"
  | "meta_pixel"
  | "multiple_staff"
  | "shipping_integrations"
  | "online_payments";

/** Menu entries that exist only for one feature: hidden from the sidebar and the Ctrl+K palette when the plan lacks it. */
export const NAV_FEATURE: Record<string, FeatureKey> = {
  [ROUTES.discounts]: "discount_codes",
  [ROUTES.campaigns]: "marketing_campaigns",
  [ROUTES.abandonedCarts]: "abandoned_cart_recovery",
  [ROUTES.analytics]: "advanced_reports",
};

/** The feature each integration provider needs (the API's PROVIDER_FEATURE). */
export const PROVIDER_FEATURE: Record<string, FeatureKey> = { ga4: "google_analytics", meta_pixel: "meta_pixel" };

/** Names for the "not included" screen, in case the plan's own answer cannot be read. */
export const FEATURE_LABEL: Record<FeatureKey, string> = {
  discount_codes: "Discount codes and coupons",
  abandoned_cart_recovery: "Abandoned cart recovery",
  marketing_campaigns: "Marketing campaigns",
  advanced_reports: "Advanced reports",
  google_analytics: "Google Analytics",
  meta_pixel: "Meta Pixel",
  multiple_staff: "Multiple team members",
  shipping_integrations: "Shipping carrier integrations",
  online_payments: "Online payments",
};

type PlanAnswer = { entitled: boolean; features: { key: string; enabled: boolean }[] };

/**
 * `enabled`: the plan includes it. `inactive`: the subscription is not active, so nothing paid is on. `missing`: the plan lacks it.
 * `unknown`: the plan could not be read - treated as NOT allowed, so a failed lookup never opens a screen.
 */
export type FeatureAccess = "enabled" | "inactive" | "missing" | "unknown";

export function featureAccess(plan: PlanAnswer | null | undefined, key: FeatureKey): FeatureAccess {
  if (!plan) return "unknown";
  if (plan.features.find((f) => f.key === key)?.enabled === true) return "enabled";
  return plan.entitled ? "missing" : "inactive";
}

/** hrefs whose feature the plan does not give (or could not be read): the sidebar and the palette leave them out. */
export const hiddenFeatureHrefs = (plan: PlanAnswer | null | undefined): string[] =>
  Object.entries(NAV_FEATURE).filter(([, key]) => featureAccess(plan, key) !== "enabled").map(([href]) => href);
