import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { PaymentStep } from "@/components/onboarding/payment-step";
import { PlanPicker } from "@/components/onboarding/plan-picker";
import { StoreStep } from "@/components/onboarding/store-step";
import { buttonVariants } from "@/components/ui/button";
import { ROUTES } from "@/config/app";
import { isPlatformAdmin } from "@/lib/auth/platform";
import { requireUser } from "@/lib/auth/session";
import { effectiveInterval } from "@/components/landing/pricing-utils";
import { planChoiceFrom } from "@/lib/onboarding/path";
import { getActiveTenant } from "@/lib/tenant/context";
import { getSignupStatus } from "@/services/onboarding.service";
import { getPublicPlans } from "@/services/public-plans.service";

export const metadata: Metadata = { title: "Set up your store" };

/**
 * Where a signed-in customer without a store finishes signing up: choose a plan, pay for it, then name the store. Which step shows is
 * decided by the API's own record of this person's purchase, never by the address or anything the browser says, so refreshing, coming
 * back later or paying in another tab always lands on the right step.
 */
export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ plan?: string; interval?: string; step?: string }> }) {
  const user = await requireUser();
  // Platform staff can never own a store, and the admin area is their home.
  if (await isPlatformAdmin()) redirect(ROUTES.admin);

  const { plan, interval, step } = await searchParams;
  const [status, plans, active] = await Promise.all([getSignupStatus(), getPublicPlans(), getActiveTenant()]);
  const requested = planChoiceFrom(plan, interval);
  const picked = requested ? plans.find((p) => p.code === requested.planCode) : undefined;

  // Already has a store and is not in the middle of buying another one: nothing to set up.
  if (active && (status.state === "none" || status.state === "provisioned")) redirect(ROUTES.dashboard);

  if (status.state === "store_required") {
    return (
      <AuthShell
        eyebrow="ALMOST THERE"
        headline="Payment received. Now name your store."
        title="Create your store"
        description={`Your ${status.planName ?? "plan"} plan is active. Choose a name for your store, you can change it later.`}
      >
        <StoreStep />
      </AuthShell>
    );
  }

  // A plan chosen in the address wins over an unpaid one left from earlier (choosing again replaces it); otherwise resume the open one.
  const chosenPlan = picked && requested ? { code: picked.code, name: picked.name, interval: effectiveInterval(picked, requested.billingInterval), plan: picked } : null;
  const resume =
    !chosenPlan && step !== "plans" && status.state === "payment_required" && status.planCode && status.billingInterval
      ? plans.find((p) => p.code === status.planCode)
      : undefined;
  const target =
    chosenPlan ??
    (resume && status.billingInterval ? { code: resume.code, name: resume.name, interval: status.billingInterval, plan: resume } : null);

  if (target) {
    return (
      <AuthShell
        eyebrow="ONE LAST STEP"
        headline="Pay securely to activate your plan."
        title="Complete your payment"
        description="You pay StoreForge for your plan. Your store is created right after the payment is confirmed."
        footer={
          <>
            <Link href={`${ROUTES.onboarding}?step=plans`} className="block font-semibold text-lp-primary underline-offset-4 hover:underline">
              Change plan
            </Link>
            <SignOutButton className={buttonVariants({ variant: "ghost", size: "sm" })}>Not you? Sign out</SignOutButton>
          </>
        }
      >
        <PaymentStep
          plan={target.plan}
          interval={target.interval}
          lastFailure={status.state === "payment_required" ? status.lastFailure : null}
          prefill={{ name: user.user_metadata.full_name ?? "", email: user.email ?? "" }}
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="WELCOME"
      headline="Choose the plan that fits your store."
      title="Choose your plan"
      description={plan && !picked ? "That plan is not available any more. Choose one of the plans below." : "Pick a plan to get started. You can change it later."}
    >
      <PlanPicker plans={plans} footer={<SignOutButton className={buttonVariants({ variant: "ghost", size: "sm" })}>Not you? Sign out</SignOutButton>} />
    </AuthShell>
  );
}
