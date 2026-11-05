import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { logoutAction } from "@/app/(auth)/actions";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/config/app";
import { requireUser } from "@/lib/auth/session";
import { isPlatformAdmin } from "@/lib/auth/platform";
import { getActiveTenant } from "@/lib/tenant/context";

export const metadata: Metadata = { title: "No workspace" };

/** Signed in, but not a member of any active company. Accounts are provisioned; nobody can self-onboard. */
export default async function NoWorkspacePage() {
  await requireUser();
  if (await isPlatformAdmin()) redirect(ROUTES.admin);
  if (await getActiveTenant()) redirect(ROUTES.dashboard);

  return (
    <AuthShell
      icon={<Building2 className="size-5" aria-hidden />}
      title="No workspace available"
      description="Your account is not linked to an active company. It may have been deactivated or the company suspended. Please contact your StoreForge administrator or company owner."
    >
      <form action={logoutAction}>
        <Button type="submit" variant="outline" className="w-full">Sign out</Button>
      </form>
    </AuthShell>
  );
}
