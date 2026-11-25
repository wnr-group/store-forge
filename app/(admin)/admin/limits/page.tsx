import type { Metadata } from "next";
import Link from "next/link";
import { Gauge, SearchX } from "lucide-react";
import { UsageBar } from "@/components/admin/usage-bar";
import { EmptyState } from "@/components/shared/empty-state";
import { ListFilters } from "@/components/shared/list-filters";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROUTES } from "@/config/app";
import { requirePlatformPagePermission } from "@/lib/auth/platform";
import { limitsQuerySchema } from "@/lib/validations/admin-commercial";
import { ADMIN_PAGE_SIZES } from "@/lib/validations/admin-list";
import { listLimitUsage } from "@/services/platform-commercial.service";

export const metadata: Metadata = { title: "Usage & limits" };

const LABEL: Record<string, string> = { products: "Products", staff_accounts: "Staff accounts", orders_per_month: "Orders this month" };
const FILTERS = [
  { value: "attention", label: "Needs attention" },
  { value: "reached", label: "Limit reached" },
  { value: "warning", label: "Close to a limit" },
  { value: "every", label: "Every organization" },
];

export default async function LimitsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePlatformPagePermission("usage:read");
  const raw = await searchParams;
  const query = limitsQuerySchema.parse(Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
  const { items, meta } = await listLimitUsage({ search: query.q, filter: query.filter === "every" ? "all" : query.filter, page: query.page, limit: query.pageSize });
  const quiet = query.filter === "attention" && !query.q;

  return (
    <>
      <PageHeader
        title="Usage & limits"
        description="How much of its plan each organization uses. Warnings start at a plan's warning level or at 80% of a hard limit; at the hard limit, adding more is refused. Storage is measured on each organization's own page."
      />
      <ListFilters searchPlaceholder="Search by organization name" filters={[{ key: "filter", label: "Show", options: FILTERS, defaultValue: "attention" }]} />
      {meta.total === 0 ? (
        quiet ? (
          <EmptyState icon={Gauge} title="Nothing needs attention" description="No organization is close to, or at, a limit of its plan." />
        ) : (
          <EmptyState icon={SearchX} title="No organizations match" description="Try a different search or filter." />
        )
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Organization</TableHead>
                  <TableHead>Plan</TableHead>
                  {Object.values(LABEL).map((l) => (
                    <TableHead key={l}>{l}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <Link href={`${ROUTES.adminCompanies}/${t.id}`} className="font-medium hover:underline">{t.name}</Link>
                      {t.status === "suspended" ? <StatusBadge tone="warning" className="ml-2">Suspended</StatusBadge> : null}
                    </TableCell>
                    <TableCell>
                      <span className="block">{t.planName}</span>
                      <span className="block text-xs text-muted-foreground">{t.subscriptionStatus.replace("_", " ")}{t.isUnrestricted ? " · unrestricted" : ""}</span>
                    </TableCell>
                    {["products", "staff_accounts", "orders_per_month"].map((key) => {
                      const l = t.limits.find((x) => x.key === key);
                      return (
                        <TableCell key={key}>
                          {l ? <UsageBar used={l.used} hard={l.hard} percent={l.percent} level={l.level} /> : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination page={meta.page} pageSize={meta.limit} total={meta.total} basePath={ROUTES.adminLimits} params={{ q: query.q, filter: query.filter, pageSize: String(meta.limit) }} pageSizeOptions={ADMIN_PAGE_SIZES} />
        </>
      )}
    </>
  );
}
