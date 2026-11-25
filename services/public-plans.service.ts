import { unstable_cache } from "next/cache";
import "server-only";
import { cache } from "react";
import { getPublicPlansApi, type PublicPlanApi } from "@/lib/api/endpoints/platform-api";

export type PublicPlan = PublicPlanApi;

export const PUBLIC_PLANS_TAG = "public-plans";

/** Cached across requests so the landing page costs no call per visit; the plan actions in the admin area expire the tag, so a plan an admin publishes shows up straight away. Throws on failure so an empty list is never cached. */
const fetchPublicPlans = unstable_cache(async (): Promise<PublicPlan[]> => getPublicPlansApi(), ["public-plans"], {
  tags: [PUBLIC_PLANS_TAG],
  revalidate: 300,
});

/**
 * The subscription plans to show on the public landing page (the ones a Platform Admin has published). Needs no session. If
 * the API cannot be reached the list is empty, so the landing page simply leaves the plans section out instead of failing.
 */
export const getPublicPlans = cache(async (): Promise<PublicPlan[]> => {
  try {
    return await fetchPublicPlans();
  } catch (error) {
    console.error("[public-plans] plans unavailable, hiding the plans section", error instanceof Error ? error.message : error);
    return [];
  }
});
