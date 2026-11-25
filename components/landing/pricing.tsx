import { getPublicPlans } from "@/services/public-plans.service";
import { PricingPlans } from "./pricing-plans";

export { PricingPlans };

/** The plans an admin has published. Renders nothing when there are none (or the list cannot be loaded). */
export async function Pricing() {
  return <PricingPlans plans={await getPublicPlans()} />;
}
