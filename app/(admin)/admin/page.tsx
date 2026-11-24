import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Building2, CheckCircle2, CircleDollarSign, Clock, PauseCircle, PlusCircle, Receipt, Users, XCircle } from "lucide-react";
import { NewOrgsChart } from "@/components/admin/new-orgs-chart-lazy";
import { StatCard } from "@/components/admin/stat-card";
import { ListFilters } from "@/components/shared/list-filters";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { ROUTES } from "@/config/app";
import { shortDate, dateTime, moneyList } from "@/lib/admin/format";
import { getPlatformAccess } from "@/lib/auth/platform";
import { dashboardQuerySchema } from "@/lib/validations/admin-commercial";
import { getDashboard } from "@/services/platform-commercial.service";

export const metadata: Metadata = { title: "Platform overview" };

const ACTION_LABEL = (action: string) => action.replace(/[._]/g, " ");

export default async function AdminOverviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const query = dashboardQuerySchema.parse(Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
  const [d, access] = await Promise.all([getDashboard({ from: query.from, to: query.to }), getPlatformAccess()]);
  const canCreate = access?.permissions.includes("tenants:manage") ?? false;
  const toPoints = (rows: { date: string; count: number }[]) => rows.map((p) => ({ start: p.date, created: p.count }));
  const range = `${shortDate(d.from)} to ${shortDate(d.to)}`;

  return (
    <>
      <PageHeader
        title="Platform overview"
        description={`Everything below is counted from live records. Dates and growth cover ${range}.`}
        actions={
          canCreate ? (
            <Link href={ROUTES.adminNewCompany} className={buttonVariants()}>
              <PlusCircle aria-hidden /> Create tenant
            </Link>
          ) : null
        }
      />
      <ListFilters dateFilters={[{ key: "from", label: "From" }, { key: "to", label: "To" }]} />

      {d.health.database === "down" ? (
        <p role="alert" className="mb-4 flex items-center gap-2 rounded-lg border border-error/30 bg-error/10 p-3 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" aria-hidden /> The database is not answering, so some numbers below may be missing. See System Monitoring.
        </p>
      ) : null}

      <div className="space-y-6">
        <section aria-label="Tenants" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Tenants" value={d.tenants.total} icon={Building2} />
          <StatCard label="Active tenants" value={d.tenants.active} icon={CheckCircle2} />
          <StatCard label="Suspended tenants" value={d.tenants.suspended} icon={PauseCircle} tone={d.tenants.suspended > 0 ? "warning" : undefined} />
          <StatCard label="Registered users" value={d.tenants.users} hint="People with an account in any tenant" icon={Users} />
        </section>

        <section aria-label="Subscriptions" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Active subscriptions" value={d.subscriptions.active} icon={CheckCircle2} />
          <StatCard label="In a trial" value={d.subscriptions.trialing} icon={Clock} />
          <StatCard label="Past due" value={d.subscriptions.pastDue} hint="Unpaid, still inside the grace period" icon={AlertTriangle} tone={d.subscriptions.pastDue > 0 ? "warning" : undefined} />
          <StatCard label="Expired" value={d.subscriptions.expired} hint={d.subscriptions.canceled > 0 ? `${d.subscriptions.canceled} canceled` : "Includes trials that ended"} icon={XCircle} tone={d.subscriptions.expired > 0 ? "danger" : undefined} />
        </section>

        {d.billing ? (
          <section aria-label="Revenue and payments" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Monthly recurring revenue" value={moneyList(d.billing.mrr)} hint="From paid, active subscriptions" icon={CircleDollarSign} />
            <StatCard label="Collected in range" value={moneyList(d.billing.collected)} hint={`${d.billing.successfulPayments} successful payment${d.billing.successfulPayments === 1 ? "" : "s"}`} icon={Receipt} />
            <StatCard label="Failed payments" value={d.billing.failedPayments} hint={`${d.billing.pendingPayments} pending`} icon={XCircle} tone={d.billing.failedPayments > 0 ? "warning" : undefined} />
            <StatCard label="Overdue invoices" value={d.billing.overdueInvoices} hint={d.billing.overdueInvoices > 0 ? moneyList(d.billing.overdue) : "Nothing overdue"} icon={AlertTriangle} tone={d.billing.overdueInvoices > 0 ? "danger" : undefined} />
          </section>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard title="New subscriptions" description={`Subscriptions started per ${d.growth.bucket}, ${range}.`}>
            <NewOrgsChart points={toPoints(d.growth.newSubscriptions)} bucket={d.growth.bucket} noun="subscription" />
          </SectionCard>
          <SectionCard title="New tenants" description={`Tenants created per ${d.growth.bucket}, ${range}.`}>
            <NewOrgsChart points={toPoints(d.growth.newOrganizations)} bucket={d.growth.bucket} noun="tenant" />
          </SectionCard>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <SectionCard
            title="Recent activity"
            className="lg:col-span-2"
            aside={d.recentActivity ? <Link href={ROUTES.adminActivity} className="text-sm text-muted-foreground hover:text-foreground hover:underline">All activity</Link> : undefined}
          >
            {d.recentActivity === null ? (
              <p className="text-sm text-muted-foreground">Your role cannot read the audit log.</p>
            ) : d.recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing has been recorded yet.</p>
            ) : (
              <ul className="divide-y">
                {d.recentActivity.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="font-medium capitalize">{ACTION_LABEL(e.action)}</span>
                      <span className="text-muted-foreground"> · {e.description}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{e.adminEmail} · {dateTime(e.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Platform health" aside={<Link href={ROUTES.adminMonitoring} className="text-sm text-muted-foreground hover:text-foreground hover:underline">Details</Link>}>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center justify-between">
                <span>API</span>
                <StatusBadge tone="active">Up</StatusBadge>
              </li>
              <li className="flex items-center justify-between">
                <span>Database</span>
                <StatusBadge tone={d.health.database === "up" ? "active" : "danger"}>{d.health.database === "up" ? "Up" : "Down"}</StatusBadge>
              </li>
            </ul>
            <p className="text-xs text-muted-foreground">Measured when this page loaded. System Monitoring shows errors, jobs and alerts.</p>
          </SectionCard>
        </div>
      </div>
    </>
  );
}
