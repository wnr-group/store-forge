import Link from "next/link";
import { ExternalLink, Settings } from "lucide-react";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { AppShell } from "@/components/dashboard/app-shell";
import { Breadcrumbs } from "@/components/dashboard/breadcrumbs";
import { CommandSearch } from "@/components/dashboard/command-search";
import { Notifications, NotificationsFallback } from "@/components/dashboard/notifications";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import { TenantSwitcher } from "@/components/dashboard/tenant-switcher";
import { buttonVariants } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { UserMenu } from "@/components/dashboard/user-menu";
import { ROUTES, SIDEBAR_COOKIE } from "@/config/app";
import { canViewDashboard, ROLE_LABELS } from "@/lib/auth/permissions";
import { hiddenNavHrefs } from "@/components/dashboard/nav-config";
import { AppError } from "@/lib/errors";
import { storefrontHost, storefrontUrl } from "@/lib/tenant/host";
import { requireWorkspace } from "@/lib/tenant/context";
import { getRequestStoreSlug } from "@/lib/tenant/request";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Server-side gate for every dashboard page: validated user, DB-verified
  // active tenant (else -> /onboarding), then a role check.
  const { user, active, store, tenants } = await requireWorkspace();
  if (!canViewDashboard(active)) throw new AppError("FORBIDDEN", "You do not have access to this workspace.");

  const onStoreHost = Boolean(await getRequestStoreSlug());
  const name = (user.user_metadata?.full_name as string | undefined) ?? "";
  const email = user.email ?? "";
  const switcherProps = {
    activeTenantId: active.tenant.id,
    storeName: store?.name,
    tenants: tenants.filter((t) => !onStoreHost || t.tenant.id === active.tenant.id).map((t) => ({ id: t.tenant.id, name: t.tenant.name, role: t.role })),
  };
  const role = ROLE_LABELS[active.role];
  const storeUrl = store ? storefrontUrl(store.slug, process.env.NEXT_PUBLIC_ROOT_DOMAIN) : null;
  const accountLink = (
    <DropdownMenuItem render={<Link href={ROUTES.settings} />}>
      <Settings aria-hidden /> Account settings
    </DropdownMenuItem>
  );
  const collapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "1";

  return (
    <AppShell
      navKey={active.role === "owner" ? "owner" : "merchant"}
      hiddenNav={hiddenNavHrefs(active)}
      homeHref={ROUTES.dashboard}
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
            {storeUrl && store ? (
              <a
                href={storeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "outline", size: "sm" })}
                title={`Open ${storefrontHost(store.slug, process.env.NEXT_PUBLIC_ROOT_DOMAIN)}`}
              >
                <ExternalLink aria-hidden /> <span className="hidden sm:inline">View store</span>
                <span className="sr-only sm:hidden">View store</span>
              </a>
            ) : null}
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
