import type { Metadata } from "next";
import { StatTile } from "@/components/analytics/stat-tile";
import { AnalyticsTabs } from "@/components/analytics/analytics-tabs";
import { ReportControls } from "@/components/analytics/report-controls";
import { SalesChart } from "@/components/analytics/sales-chart-lazy";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/money";
import { requireWorkspaceCan } from "@/lib/tenant/context";
import { flatten, reportRangeQuerySchema } from "@/lib/validations/commerce-lists";
import { getSalesReport } from "@/services/marketing.service";

export const metadata: Metadata = { title: "Sales and revenue" };

const PERIOD_LABEL = { day: "Day", week: "Week starting", month: "Month" } as const;
const periodText = (iso: string, interval: "day" | "week" | "month") => {
  const d = new Date(`${iso}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-IN", interval === "month" ? { month: "short", year: "numeric", timeZone: "UTC" } : { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(d);
};

export default async function SalesReportPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = reportRangeQuerySchema.parse(flatten(await searchParams));
  const { active } = await requireWorkspaceCan("marketing:view");
  const r = await getSalesReport(query);
  const currency = r.currency;
  const money = (m: number) => formatMoney(m, currency);
  const t = r.totals;
  const c = r.previous.changePercent;
  const points = r.series.map((p) => ({ day: p.period, salesMinor: p.totalSalesMinor, orders: p.orders }));

  return (
    <>
      <PageHeader title="Analytics" description={`Sales and revenue in ${currency}, by ${r.interval} in ${r.timeZone}. ${r.from} to ${r.to}.`} />
      <AnalyticsTabs actor={active} />
      <div className="grid gap-6">
        <ReportControls from={r.from} to={r.to} interval={query.interval} />

        <section aria-label="Totals" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Total sales" value={money(t.totalSalesMinor)} change={c.totalSalesMinor} hint="What customers were charged" />
          <StatTile label="Orders" value={String(t.orders)} change={c.orders} />
          <StatTile label="Average order value" value={money(t.averageOrderValueMinor)} change={c.averageOrderValueMinor} />
          <StatTile label="Net revenue" value={money(t.netRevenueMinor)} change={c.netRevenueMinor} hint="Total sales less refunds" />
          <StatTile label="Gross sales" value={money(t.grossSalesMinor)} change={c.grossSalesMinor} hint="Items before discounts" />
          <StatTile label="Discounts" value={money(t.discountsMinor)} change={c.discountsMinor} good="neither" />
          <StatTile label="Refunds" value={money(t.refundsMinor)} change={c.refundsMinor} good="down" />
          <StatTile label="Net sales" value={money(t.netSalesMinor)} change={c.netSalesMinor} hint="Gross sales less discounts and refunds" />
        </section>

        {t.orders === 0 ? (
          <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">No orders in this period. Choose other dates, or come back once you have sold something.</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard title="Sales over time" description="What customers were charged, per period.">
              <SalesChart data={points} currency={currency} metric="sales" />
            </SectionCard>
            <SectionCard title="Orders over time" description="Orders that count as sales, per period.">
              <SalesChart data={points} currency={currency} metric="orders" />
            </SectionCard>
          </div>
        )}

        <SectionCard title="Revenue report" description={`One row per ${r.interval}. The total row is the sum of the rows above it.`}>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>{PERIOD_LABEL[r.interval]}</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Gross sales</TableHead>
                  <TableHead className="text-right">Discounts</TableHead>
                  <TableHead className="text-right">Refunds</TableHead>
                  <TableHead className="text-right">Net sales</TableHead>
                  <TableHead className="text-right">Total sales</TableHead>
                  <TableHead className="text-right">Net revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.series.map((p) => (
                  <TableRow key={p.period} className={p.orders === 0 ? "text-muted-foreground" : undefined}>
                    <TableCell>{periodText(p.period, r.interval)}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.orders}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(p.grossSalesMinor)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(p.discountsMinor)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(p.refundsMinor)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(p.netSalesMinor)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(p.totalSalesMinor)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(p.netRevenueMinor)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right tabular-nums">{t.orders}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(t.grossSalesMinor)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(t.discountsMinor)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(t.refundsMinor)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(t.netSalesMinor)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(t.totalSalesMinor)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(t.netRevenueMinor)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">
            Delivery and cash-on-delivery charges: {money(t.shippingAndFeesMinor)}. GST on these orders: {money(t.taxMinor)}.
          </p>
        </SectionCard>

        <SectionCard title="How these figures are worked out">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
            <li>Only orders that count as sales are included: confirmed through delivered. Cancelled, failed, returned and unpaid orders are left out.</li>
            <li>
              <strong className="font-medium text-foreground">Gross sales</strong> are the items before discounts. <strong className="font-medium text-foreground">Net sales</strong> are gross sales less discounts less refunds.
            </li>
            <li>
              <strong className="font-medium text-foreground">Total sales</strong> are what customers were charged: net of discounts, with delivery and GST. <strong className="font-medium text-foreground">Net revenue</strong> is total sales less refunds.
            </li>
            <li>A refund counts in the period its order was placed, so one order is never counted twice. Cash-on-delivery returns are not refunds here.</li>
            <li>Days are your store&apos;s days ({r.timeZone}). “Change” compares with the period just before, of the same length ({r.previous.from} to {r.previous.to}).</li>
          </ul>
        </SectionCard>
      </div>
    </>
  );
}
