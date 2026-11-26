import type { Metadata } from "next";
import { Package, SearchX } from "lucide-react";
import { AnalyticsTabs } from "@/components/analytics/analytics-tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { ListFilters } from "@/components/shared/list-filters";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROUTES } from "@/config/app";
import { formatMoney } from "@/lib/money";
import { requireWorkspaceCan } from "@/lib/tenant/context";
import { flatten, productReportQuerySchema } from "@/lib/validations/commerce-lists";
import { getProductReport } from "@/services/marketing.service";

export const metadata: Metadata = { title: "Product performance" };

export default async function ProductReportPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = flatten(await searchParams);
  const query = productReportQuerySchema.parse(raw);
  const { active, store } = await requireWorkspaceCan("marketing:view");
  const currency = store?.currency ?? "INR";
  const result = await getProductReport(query);
  const filtered = !!query.q || !!query.from || !!query.to;
  const nothing = result.total === 0 && !filtered;

  return (
    <>
      <PageHeader title="Analytics" description="Which products sell, and which do not. Counts orders that count as sales, by the days you choose in your store time zone." />
      <AnalyticsTabs actor={active} />
      {nothing ? (
        <EmptyState icon={Package} title="No products yet" description="Add products and make your first sales to see how they perform." />
      ) : (
        <div className="grid gap-3">
          <ListFilters
            searchPlaceholder="Search products"
            dateFilters={[
              { key: "from", label: "From" },
              { key: "to", label: "To" },
            ]}
            sortOptions={[
              { value: "units:desc", label: "Best sellers (units)" },
              { value: "units:asc", label: "Worst sellers (units)" },
              { value: "revenue:desc", label: "Most revenue" },
              { value: "revenue:asc", label: "Least revenue" },
              { value: "orders:desc", label: "In the most orders" },
            ]}
          />
          <p className="text-xs text-muted-foreground">Without dates this shows the last 30 days. “Worst sellers” include active products nobody bought.</p>
          {result.items.length === 0 ? (
            <EmptyState icon={SearchX} title="No products match" description="Try a different name." />
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Units sold</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">In orders</TableHead>
                      <TableHead className="hidden text-right md:table-cell">Conversion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.items.map((p) => (
                      <TableRow key={p.productId}>
                        <TableCell>
                          <span className="font-medium">{p.name}</span>
                          {p.status !== "active" ? (
                            <span className="ml-2">
                              <StatusBadge tone="draft">{p.status === "draft" ? "Draft" : "Archived"}</StatusBadge>
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{p.unitsSold}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(p.revenueMinor, currency)}</TableCell>
                        <TableCell className="text-right tabular-nums">{p.orders}</TableCell>
                        <TableCell className="hidden text-right text-muted-foreground md:table-cell" title="Product views are not recorded in your store, so a conversion rate cannot be worked out.">
                          {p.conversionRatePercent === null ? "Not tracked" : `${p.conversionRatePercent}%`}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-muted-foreground">Revenue is the value of the items before order-level discounts, all variants of a product added together. Refunds are not split by product. Conversion needs product views, which your store does not record, so it is shown as not tracked rather than guessed.</p>
              <Pagination page={result.page} pageSize={result.pageSize} total={result.total} basePath={ROUTES.analyticsProducts} params={{ q: query.q, from: query.from, to: query.to, sort: raw.sort, dir: raw.dir }} />
            </>
          )}
        </div>
      )}
    </>
  );
}
