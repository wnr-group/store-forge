import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";
import { ROUTES } from "@/config/app";
import { planChoiceFrom, planQuery } from "@/lib/onboarding/path";
import { getPublicBranding } from "@/services/platform-settings.service";
import { getPublicPlans } from "@/services/public-plans.service";

export const metadata: Metadata = { title: "Create your account" };

/**
 * Self-service sign-up: a visitor who picked a plan on the pricing page (or none) creates their own account. Signed-in visitors never
 * see this page (the proxy sends them on to the onboarding), and an account here has no organization and no role until a plan is paid.
 */
export default async function SignupPage({ searchParams }: { searchParams: Promise<{ plan?: string; interval?: string }> }) {
  const { plan, interval } = await searchParams;
  const [plans, brand] = await Promise.all([getPublicPlans(), getPublicBranding()]);
  const requested = planChoiceFrom(plan, interval);
  // Only a plan that is really published is carried forward; anything else is dropped and the plan is chosen after sign-up.
  const choice = requested && plans.some((p) => p.code === requested.planCode) ? requested : null;
  const selected = choice ? plans.find((p) => p.code === choice.planCode) : undefined;
  const loginHref = `${ROUTES.login}?next=${encodeURIComponent(`${ROUTES.onboarding}${planQuery(choice)}`)}`;

  return (
    <AuthShell
      eyebrow="GET STARTED"
      headline="Launch your online store in minutes."
      title="Create your account"
      description={
        selected
          ? `You chose the ${selected.name} plan. Create your account, then complete payment to set up your store.`
          : "Create your account, choose a plan and set up your store."
      }
      footer={
        <>
          Already have an account?{" "}
          <Link href={loginHref} className="font-semibold text-lp-primary underline-offset-4 hover:underline">
            Log in
          </Link>
          {brand.supportEmail ? <span className="mt-1 block">Need help? Contact {brand.supportEmail}.</span> : null}
        </>
      }
    >
      <SignupForm plan={choice} />
    </AuthShell>
  );
}
