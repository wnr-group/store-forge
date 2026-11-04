import Link from "next/link";
import { Settings } from "lucide-react";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { AppShell } from "@/components/dashboard/app-shell";
import { Breadcrumbs } from "@/components/dashboard/breadcrumbs";
import { CommandSearch } from "@/components/dashboard/command-search";
import { Notifications, NotificationsFallback } from "@/components/dashboard/notifications";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import { TenantSwitcher } from "@/components/dashboard/tenant-switcher";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { UserMenu } from "@/components/dashboard/user-menu";
import { ROUTES, SIDEBAR_COOKIE } from "@/config/app";
import { canViewDashboard, ROLE_LABELS } from "@/lib/auth/permissions";
import { AppError } from "@/lib/errors";
import { requireWorkspace } from "@/lib/tenant/context";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Server-side gate for every dashboard page: validated user, DB-verified
  // active tenant (else -> /onboarding), then a role check.
  const { user, active, store, tenants } = await requireWorkspace();
  if (!canViewDashboard(active.role)) throw new AppError("FORBIDDEN", "You do not have access to this workspace.");

  const name = (user.user_metadata?.full_name as string | undefined) ?? "";
  const email = user.email ?? "";
  const switcherProps = {
    activeTenantId: active.tenant.id,
    storeName: store?.name,
    tenants: tenants.map((t) => ({ id: t.tenant.id, name: t.tenant.name, role: t.role })),
  };
  const role = ROLE_LABELS[active.role];
  const accountLink = (
    <DropdownMenuItem render={<Link href={ROUTES.settings} />}>
      <Settings aria-hidden /> Account settings
    </DropdownMenuItem>
  );
  const collapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "1";

  return (
    <AppShell
      defaultCollapsed={collapsed}
      switcher={{ full: <TenantSwitcher {...switcherProps} />, compact: <TenantSwitcher {...switcherProps} compact /> }}
      footer={{
        full: <UserMenu name={name} email={email} role={role}>{accountLink}</UserMenu>,
        compact: <UserMenu name={name} email={email} role={role} compact>{accountLink}</UserMenu>,
      }}
      header={
        <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
          <Breadcrumbs />
          <div className="flex items-center gap-2">
            <CommandSearch />
            <ThemeToggle />
            <Suspense fallback={<NotificationsFallback />}>
              <Notifications />
            </Suspense>
          </div>
        </div>
      }
    >
      {children}
    </AppShell>
  );
}
