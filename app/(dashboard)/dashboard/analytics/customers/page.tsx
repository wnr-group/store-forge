import type { Metadata } from "next";
import Link from "next/link";
import { SearchX, Users } from "lucide-react";
import { AnalyticsTabs } from "@/components/analytics/analytics-tabs";
import { StatTile } from "@/components/analytics/stat-tile";
import { EmptyState } from "@/components/shared/empty-state";
import { ListFilters } from "@/components/shared/list-filters";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { SectionCard } from "@/components/shared/section-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROUTES } from "@/config/app";
import { formatDate } from "@/lib/format-date";
import { formatMoney } from "@/lib/money";
import { requireWorkspaceCan } from "@/lib/tenant/context";
import { flatten, topCustomerQuerySchema } from "@/lib/validations/commerce-lists";
import { getCustomerSummary, getTopCustomers } from "@/services/marketing.service";

export const metadata: Metadata = { title: "Customer analytics" };

export default async function CustomerReportPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = flatten(await searchParams);
  const query = topCustomerQuerySchema.parse(raw);
  const { active, store } = await requireWorkspaceCan("customers:view");
  const currency = store?.currency ?? "INR";
  const timeZone = store?.timezone ?? "Asia/Kolkata";
  const [summary, top] = await Promise.all([getCustomerSummary({ from: query.from, to: query.to }), getTopCustomers(query)]);
  const money = (m: number) => formatMoney(m, currency);

  return (
    <>
      <PageHeader title="Analytics" description={`Who buys from you, and how often. ${summary.from} to ${summary.to}, by days in ${timeZone}.`} />
      <AnalyticsTabs actor={active} />
      <div className="grid gap-6">
        <section aria-label="Customers" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Customers" value={String(summary.totalCustomers)} hint="On file today" />
          <StatTile label="New customers" value={String(summary.newCustomers)} hint="Added in this period" />
          <StatTile label="Buyers" value={String(summary.buyers)} hint={`${summary.firstTimeBuyers} first-time, ${summary.returningCustomers} returning`} />
          <StatTile label="Repeat purchase rate" value={`${summary.repeatPurchaseRatePercent}%`} hint="Of everyone who ever bought, those who bought more than once" />
          <StatTile label="Returning customers" value={String(summary.returningCustomers)} hint="Bought in this period, and before it" />
          <StatTile label="Orders per buyer" value={String(summary.averageOrdersPerBuyer)} hint="In this period" />
          <StatTile label="Average spend per buyer" value={money(summary.averageSpendPerBuyerMinor)} hint="In this period" />
          <StatTile label="Average order value" value={money(summary.averageOrderValueMinor)} hint="In this period" />
        </section>

        <SectionCard title="Top customers" description="By what they were charged on orders that count as sales in this period. Open one to see their purchase history.">
          <div className="grid gap-3">
            <ListFilters
              searchPlaceholder="Search name or email"
              dateFilters={[
                { key: "from", label: "From" },
                { key: "to", label: "To" },
              ]}
              sortOptions={[
                { value: "revenue:desc", label: "Highest revenue" },
                { value: "orders:desc", label: "Most orders" },
              ]}
            />
            {top.items.length === 0 ? (
              <EmptyState icon={query.q ? SearchX : Users} title={query.q ? "No customers match" : "No purchases in this period"} description={query.q ? "Try a different name or email." : "Choose other dates, or come back once customers have bought something."} />
            ) : (
              <>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableHead>Customer</TableHead>
                        <TableHead className="text-right">Orders</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="hidden md:table-cell">Last order</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {top.items.map((c) => (
                        <TableRow key={c.customerId}>
                          <TableCell>
                            <Link href={`${ROUTES.analyticsCustomers}/${c.customerId}`} className="font-medium hover:text-primary hover:underline">
                              {c.fullName}
                            </Link>
                            <span className="block text-xs text-muted-foreground">{c.email}</span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{c.orders}</TableCell>
                          <TableCell className="text-right tabular-nums">{money(c.revenueMinor)}</TableCell>
                          <TableCell className="hidden text-muted-foreground md:table-cell">{formatDate(new Date(c.lastOrderAt), timeZone)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <Pagination page={top.page} pageSize={top.pageSize} total={top.total} basePath={ROUTES.analyticsCustomers} params={{ q: query.q, from: query.from, to: query.to, sort: raw.sort }} />
              </>
            )}
          </div>
        </SectionCard>
        <p className="text-xs text-muted-foreground">Built from your customer and order records. Orders placed without a customer record are not included. “Returning” means the customer had already bought before this period began.</p>
      </div>
    </>
  );
}
