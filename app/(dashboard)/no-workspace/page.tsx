import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { buttonVariants } from "@/components/ui/button";
import { APP_NAME, ROUTES } from "@/config/app";
import { requireUser } from "@/lib/auth/session";
import { isPlatformAdmin } from "@/lib/auth/platform";
import { getActiveTenant } from "@/lib/tenant/context";
import { getRequestStoreSlug } from "@/lib/tenant/request";
import { getPublicBranding } from "@/services/platform-settings.service";

export const metadata: Metadata = { title: "No workspace" };

/** Signed in, but not a member of any active company. Accounts are provisioned; nobody can self-onboard. */
export default async function NoWorkspacePage() {
  const user = await requireUser();
  if (await isPlatformAdmin()) redirect(ROUTES.admin);
  if (await getActiveTenant()) redirect(ROUTES.dashboard);

  // On <store>.<root>/ a signed-in session for another account lands here too (cookies are per host).
  const storeSlug = await getRequestStoreSlug();
  const brand = await getPublicBranding();
  const description = storeSlug
    ? `You are signed in as ${user.email ?? "this account"}, which is not a member of ${storeSlug}. Sign out, then sign in with an account that belongs to this store.`
    : `Your account is not linked to an active company. It may have been deactivated or the company suspended. Please contact your ${APP_NAME} administrator or company owner${brand.supportEmail ? ` (${brand.supportEmail})` : ""}.`;

  return (
    <AuthShell
      icon={<Building2 className="size-5" aria-hidden />}
      title="No workspace available"
      description={description}
    >
      <SignOutButton className={buttonVariants({ variant: "outline", className: "w-full" })}>Sign out</SignOutButton>
    </AuthShell>
  );
}
