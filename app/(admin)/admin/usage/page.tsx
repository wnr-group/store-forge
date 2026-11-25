import type { Metadata } from "next";
import { requirePlatformPagePermission } from "@/lib/auth/platform";
import Link from "next/link";
import { Building2, HardDrive, MoonStar, PauseCircle, SearchX } from "lucide-react";
import { NewOrgsChart } from "@/components/admin/new-orgs-chart-lazy";
import { EmptyState } from "@/components/shared/empty-state";
import { ListFilters } from "@/components/shared/list-filters";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROUTES } from "@/config/app";
import { resolveSeriesRange } from "@/lib/admin/series";
import { formatBytes } from "@/lib/utils/bytes";
import { ADMIN_PAGE_SIZES, INACTIVE_DAY_OPTIONS, usageQuerySchema } from "@/lib/validations/admin-list";
import { getNewOrganizationsSeries, getUsageSummary, listInactiveOrganizations, listOrganizationUsage } from "@/services/platform-usage.service";

export const metadata: Metadata = { title: "Usage & Analytics" };

const day = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
const NOT_AVAILABLE = <span className="text-muted-foreground" title="This could not be measured">Not available</span>;
const NO_ACTIVITY = <span className="text-muted-foreground">No activity yet</span>;
const count = new Intl.NumberFormat("en-IN");

const SORTS = [
  { value: "created:desc", label: "Newest first" },
  { value: "created:asc", label: "Oldest first" },
  { value: "name:asc", label: "Name A to Z" },
  { value: "name:desc", label: "Name Z to A" },
];

function Stat({ label, value, icon: Icon, hint }: { label: string; value: React.ReactNode; icon: typeof Building2; hint?: string }) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
          {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        <Icon className="size-5 text-muted-foreground" aria-hidden />
      </CardContent>
    </Card>
  );
}

export default async function UsagePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePlatformPagePermission("usage:read");
  const raw = await searchParams;
  const query = usageQuerySchema.parse(Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
  const range = resolveSeriesRange(query.from, query.to);
  const [summary, series, inactive, usage] = await Promise.all([
    getUsageSummary(query.inactive),
    getNewOrganizationsSeries(query.from, query.to),
    listInactiveOrganizations(query.inactive, 10),
    listOrganizationUsage(query),
  ]);
  const filtered = Boolean(query.q) || query.status !== "all";
  const params = { q: query.q, status: query.status, sort: query.sort, dir: query.dir, from: query.from, to: query.to, inactive: String(query.inactive), pageSize: String(usage.pageSize) };

  return (
    <>
      <PageHeader title="Usage & Analytics" description="How organizations are using the platform. These are counts and totals only: no customer, order or product details are shown." />

      <ListFilters
        filters={[
          {
            key: "inactive",
            label: "Inactivity window",
            defaultValue: "30",
            options: INACTIVE_DAY_OPTIONS.map((d) => ({ value: String(d), label: `No activity in ${d} days` })),
          },
        ]}
        dateFilters={[
          { key: "from", label: "From" },
          { key: "to", label: "To" },
        ]}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Organizations" value={count.format(summary.totalOrganizations)} icon={Building2} />
        <Stat label="Active" value={count.format(summary.active)} icon={Building2} hint="Not suspended" />
        <Stat label="Suspended" value={count.format(summary.suspended)} icon={PauseCircle} />
        <Stat label={`No activity in ${query.inactive} days`} value={count.format(summary.inactive)} icon={MoonStar} hint="Created earlier, nothing changed since" />
        <Stat
          label="Platform storage"
          value={summary.storageTotalBytes === null ? <span className="text-base font-medium text-muted-foreground">Not available</span> : formatBytes(summary.storageTotalBytes)}
          icon={HardDrive}
          hint="Product images and store logos"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <SectionCard
          title="New organizations"
          description={`${series.total} created from ${day.format(new Date(`${range.from}T00:00:00Z`))} to ${day.format(new Date(`${range.to}T00:00:00Z`))}, per ${series.bucket}.`}
        >
          <NewOrgsChart points={series.points} bucket={series.bucket} />
        </SectionCard>

        <SectionCard title="Active and suspended" description="Share of organizations by status.">
          {summary.totalOrganizations === 0 ? (
            <p className="text-sm text-muted-foreground">No organizations yet.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={`${summary.active} active and ${summary.suspended} suspended organizations`}>
                <div className="bg-success" style={{ width: `${(summary.active / summary.totalOrganizations) * 100}%` }} />
                <div className="bg-warning" style={{ width: `${(summary.suspended / summary.totalOrganizations) * 100}%` }} />
              </div>
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between"><dt className="flex items-center gap-2"><span className="size-2 rounded-full bg-success" aria-hidden />Active</dt><dd className="tabular-nums">{count.format(summary.active)}</dd></div>
                <div className="flex justify-between"><dt className="flex items-center gap-2"><span className="size-2 rounded-full bg-warning" aria-hidden />Suspended</dt><dd className="tabular-nums">{count.format(summary.suspended)}</dd></div>
              </dl>
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard
        className="mt-6"
        title={`No recent activity (${query.inactive} days)`}
        description="Organizations created before the window whose products, customers, orders or stock have not changed since. Never-active ones come first."
      >
        {inactive.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Every organization older than {query.inactive} days has had recent activity.</p>
        ) : (
          <>
            <ul className="divide-y">
              {inactive.rows.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <Link href={`${ROUTES.adminCompanies}/${o.id}`} className="font-medium hover:underline">{o.name}</Link>
                  <span className="flex items-center gap-3 text-muted-foreground">
                    {o.status === "suspended" ? <StatusBadge tone="warning">Suspended</StatusBadge> : null}
                    <span>{o.lastActivity ? `Last activity ${day.format(o.lastActivity)}` : NO_ACTIVITY}</span>
                  </span>
                </li>
              ))}
            </ul>
            {inactive.total > inactive.rows.length ? <p className="text-xs text-muted-foreground">Showing {inactive.rows.length} of {count.format(inactive.total)}.</p> : null}
          </>
        )}
      </SectionCard>

      <h2 className="mt-8 mb-3 text-sm font-semibold">Usage by organization</h2>
      <ListFilters
        searchPlaceholder="Search by name or address"
        filters={[{ key: "status", label: "Status", options: [{ value: "all", label: "All statuses" }, { value: "active", label: "Active" }, { value: "suspended", label: "Suspended" }] }]}
        sortOptions={SORTS}
      />
      {usage.total === 0 ? (
        <EmptyState icon={SearchX} title={filtered ? "No organizations match" : "No organizations yet"} description={filtered ? "Try a different search or clear the filters." : "Usage appears here once organizations exist."} />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Organization</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Products</TableHead>
                  <TableHead className="text-right">Customers</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Storage</TableHead>
                  <TableHead className="hidden lg:table-cell">Last activity</TableHead>
                  <TableHead className="hidden xl:table-cell">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usage.rows.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell><Link href={`${ROUTES.adminCompanies}/${o.id}`} className="font-medium hover:underline">{o.name}</Link></TableCell>
                    <TableCell><StatusBadge tone={o.status === "active" ? "active" : "warning"}>{o.status === "active" ? "Active" : "Suspended"}</StatusBadge></TableCell>
                    <TableCell className="text-right tabular-nums">{count.format(o.products)}</TableCell>
                    <TableCell className="text-right tabular-nums">{count.format(o.customers)}</TableCell>
                    <TableCell className="text-right tabular-nums">{count.format(o.orders)}</TableCell>
                    <TableCell className="text-right tabular-nums">{o.storageBytes === null ? NOT_AVAILABLE : formatBytes(o.storageBytes)}</TableCell>
                    <TableCell className="hidden lg:table-cell">{o.lastActivity ? day.format(o.lastActivity) : NO_ACTIVITY}</TableCell>
                    <TableCell className="hidden xl:table-cell">{day.format(o.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination page={usage.page} pageSize={usage.pageSize} total={usage.total} basePath={ROUTES.adminUsage} params={params} pageSizeOptions={ADMIN_PAGE_SIZES} />
        </>
      )}
    </>
  );
}
