import { TenantSwitcher } from "@/components/dashboard/tenant-switcher";
import { UserMenu } from "@/components/dashboard/user-menu";
import { Logo } from "@/components/shared/logo";
import { ROUTES } from "@/config/app";
import { canViewDashboard } from "@/lib/auth/permissions";
import { requireWorkspace } from "@/lib/tenant/context";
import { AppError } from "@/lib/errors";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Server-side gate for every dashboard page: validated user, DB-verified
  // active tenant (else -> /onboarding), then a role check.
  const { user, active, tenants } = await requireWorkspace();
  if (!canViewDashboard(active.role)) throw new AppError("FORBIDDEN", "You do not have access to this workspace.");

  const name = (user.user_metadata?.full_name as string | undefined) ?? "";

  return (
    <div className="min-h-dvh bg-muted/30">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-3">
            <Logo href={ROUTES.dashboard} className="hidden sm:inline-flex" />
            <TenantSwitcher
              activeTenantId={active.tenant.id}
              tenants={tenants.map((t) => ({ id: t.tenant.id, name: t.tenant.name, role: t.role }))}
            />
          </div>
          <UserMenu name={name} email={user.email ?? ""} />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
