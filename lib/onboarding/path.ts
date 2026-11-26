import { ROUTES } from "@/config/app";
import { checkoutSchema } from "@/lib/validations/onboarding";

/** The plan a visitor picked on the pricing page, as it travels through sign-up, sign-in and onboarding in the address bar. */
export type PlanChoice = { planCode: string; billingInterval: "monthly" | "yearly" };

/** Reads `?plan=&interval=` into a plan choice, or null when it is missing or not shaped like one (the API still decides whether the plan exists). */
export function planChoiceFrom(plan: string | undefined, interval: string | undefined): PlanChoice | null {
  const parsed = checkoutSchema.safeParse({ planCode: plan, billingInterval: interval === "yearly" ? "yearly" : "monthly" });
  return parsed.success ? parsed.data : null;
}

/** Query string that carries a plan choice (empty when there is none). */
export function planQuery(choice: PlanChoice | null): string {
  return choice ? `?plan=${encodeURIComponent(choice.planCode)}&interval=${choice.billingInterval}` : "";
}

/** Where to continue the onboarding, keeping the plan the visitor picked. */
export const onboardingPath = (choice: PlanChoice | null) => `${ROUTES.onboarding}${planQuery(choice)}`;
