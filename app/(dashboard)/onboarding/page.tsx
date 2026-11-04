import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Rocket } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { ROUTES } from "@/config/app";
import { requireUser } from "@/lib/auth/session";
import { getUserTenants } from "@/lib/tenant/context";

export const metadata: Metadata = { title: "Set up your store" };

export default async function OnboardingPage() {
  await requireUser();
  // Already onboarded: nothing to do here (also covers retries / back button).
  if ((await getUserTenants()).length > 0) redirect(ROUTES.dashboard);

  return (
    <AuthShell
      icon={<Rocket className="size-5" aria-hidden />}
      title="Set up your store"
      description="Tell us about your business. You can change these details later."
    >
      <OnboardingForm />
    </AuthShell>
  );
}
