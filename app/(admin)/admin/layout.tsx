import { getPublicBranding } from "@/services/platform-settings.service";
import Link from "next/link";
import { KeyRound, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/dashboard/app-shell";
import { Breadcrumbs } from "@/components/dashboard/breadcrumbs";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import { UserMenu } from "@/components/dashboard/user-menu";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ROUTES, SIDEBAR_COOKIE } from "@/config/app";
import { getPlatformAccess, requirePlatformAdminPage } from "@/lib/auth/platform";
import { hiddenAdminHrefs, PLATFORM_LEVEL_LABELS } from "@/lib/platform/roles";
import { cookies } from "next/headers";

/**
 * Server-side gate for the whole Platform Admin area: validated session AND is_platform_admin()
 * in the database. Tenant roles (even Owner) never pass this check. Each admin action and service
 * repeats it, so this layout is a UX gate, not the only protection.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePlatformAdminPage();
  const access = await getPlatformAccess();
  const roleLabel = access ? PLATFORM_LEVEL_LABELS[access.level] : "Platform staff";
  const name = (user.user_metadata?.full_name as string | undefined) ?? "";
  const email = user.email ?? "";
  const collapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "1";
  const accountLink = (
    <DropdownMenuItem render={<Link href={ROUTES.adminAccount} />}>
      <KeyRound aria-hidden /> Change password
    </DropdownMenuItem>
  );
  const badge = (compact: boolean) => (
    <div className="flex h-10 items-center justify-center gap-2 rounded-lg border border-sidebar-border bg-card px-2.5 text-sm font-medium text-sidebar-accent-foreground">
      <ShieldCheck className="size-4 shrink-0" aria-hidden />
      {compact ? <span className="sr-only">{roleLabel}</span> : <span className="flex-1 truncate">{roleLabel}</span>}
    </div>
  );

  return (
    <AppShell
      navKey="admin"
      homeHref={ROUTES.admin}
      defaultCollapsed={collapsed}
      hiddenNav={hiddenAdminHrefs(access?.permissions ?? [])}
      brandName={(await getPublicBranding()).platformName}
      switcher={{ full: badge(false), compact: badge(true) }}
      footer={{
        full: <UserMenu name={name} email={email} role={roleLabel}>{accountLink}</UserMenu>,
        compact: <UserMenu name={name} email={email} role={roleLabel} compact>{accountLink}</UserMenu>,
      }}
      header={
        <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
          <Breadcrumbs base={ROUTES.admin} rootLabel="Overview" />
          <ThemeToggle />
        </div>
      }
    >
      {children}
    </AppShell>
  );
}
