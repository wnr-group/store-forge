import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, BarChart3, Boxes, ShoppingBag, TrendingUp } from "lucide-react";
import { StockState } from "@/components/inventory/inventory-table";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge, type Tone } from "@/components/shared/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { ROUTES } from "@/config/app";
import { formatDateTime } from "@/lib/format-date";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { RANGES, type Analytics } from "@/services/analytics.service";
import { SalesChart } from "./sales-chart-lazy";

const TONES: Record<string, Tone> = {
  confirmed: "active",
  processing: "active",
  ready_to_ship: "active",
  shipped: "active",
  out_for_delivery: "active",
  delivered: "active",
  pending_payment: "warning",
  cancelled: "draft",
  failed: "danger",
  returned: "danger",
};

function Stat({ label, value, hint, delta }: { label: string; value: string; hint?: string; delta?: number | null }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="mt-1 flex min-h-4 items-center gap-1 text-xs text-muted-foreground">
        {delta != null ? (
          <span className={cn("inline-flex items-center gap-0.5 font-medium", delta >= 0 ? "text-success-text" : "text-destructive")}>
            {delta >= 0 ? <ArrowUpRight className="size-3" aria-hidden /> : <ArrowDownRight className="size-3" aria-hidden />}
            {Math.abs(delta).toFixed(0)}%
            <span className="sr-only">{delta >= 0 ? " increase" : " decrease"}</span>
          </span>
        ) : null}
        {hint}
      </p>
    </div>
  );
}

export function RangeTabs({ range, basePath }: { range: number; basePath: string }) {
  return (
    <nav aria-label="Date range" className="inline-flex rounded-lg border bg-card p-0.5">
      {RANGES.map((r) => (
        <Link
          key={r}
          href={r === 30 ? basePath : `${basePath}?range=${r}`}
          aria-current={r === range ? "true" : undefined}
          className={cn("rounded-md px-3 py-1 text-xs font-medium transition-colors", r === range ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          {r} days
        </Link>
      ))}
    </nav>
  );
}

type Props = { data: Analytics; currency: string; /** The store's timezone, for the order times. */ timezone: string; detailed?: boolean };

/** Everything here is computed from the store's real orders; with none, the empty state is shown instead of charts. */
export function AnalyticsView({ data, currency, timezone, detailed = false }: Props) {
  const delta = data.previousSalesMinor > 0 ? ((data.totalSalesMinor - data.previousSalesMinor) / data.previousSalesMinor) * 100 : null;
  const window = `last ${data.range} days`;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total sales" value={formatMoney(data.totalSalesMinor, currency)} hint={delta != null ? `vs previous ${data.range} days` : window} delta={delta} />
        <Stat label="Orders" value={String(data.orders)} hint={window} />
        <Stat label="Customers" value={String(data.customers)} hint="all time" />
        <Stat label="Average order value" value={formatMoney(data.averageOrderMinor, currency)} hint={window} />
      </div>

      {!data.hasOrders ? (
        <EmptyState
          icon={TrendingUp}
          title="No sales yet"
          description="Sales, revenue trends and best sellers will appear here as soon as your store receives its first order. Nothing is estimated or sampled in the meantime."
          action={
            <Link href={ROUTES.products} className={buttonVariants({ variant: "outline" })}>
              <ShoppingBag aria-hidden /> Review your products
            </Link>
          }
        />
      ) : (
        <>
          <SectionCard title="Sales over time" description={`Revenue from paid and fulfilled orders, ${window}.`}>
            <SalesChart data={data.series} currency={currency} metric="sales" height={detailed ? 300 : 260} />
          </SectionCard>
          {detailed ? (
            <SectionCard title="Order volume" description={`Orders placed per day (excluding cancelled), ${window}.`}>
              <SalesChart data={data.series} currency={currency} metric="orders" height={220} />
            </SectionCard>
          ) : null}
        </>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Best-selling products" description={window}>
          {data.bestSellers.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No sales in this period.</p>
          ) : (
            <ol className="divide-y">
              {data.bestSellers.map((b, i) => (
                <li key={`${b.name}-${i}`} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted font-mono text-xs tabular-nums">{i + 1}</span>
                    <span className="truncate font-medium">{b.name}</span>
                  </span>
                  <span className="shrink-0 text-right tabular-nums">
                    {b.units} sold
                    <span className="block text-xs text-muted-foreground">{formatMoney(b.salesMinor, currency)}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </SectionCard>

        <SectionCard title="Recent orders">
          {data.recentOrders.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No orders yet.</p>
          ) : (
            <ul className="divide-y">
              {data.recentOrders.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="font-mono text-[13px] font-medium tabular-nums">#{o.orderNumber}</span>
                    <span className="ml-2 text-muted-foreground">{o.customerName ?? "Guest"}</span>
                    <span className="block text-xs text-muted-foreground">{formatDateTime(o.placedAt, timezone)}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="tabular-nums">{formatMoney(o.totalMinor, currency)}</span>
                    <StatusBadge tone={TONES[o.status] ?? "neutral"}><span className="capitalize">{o.status.replaceAll("_", " ")}</span></StatusBadge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Low-stock products" description="Out of stock or at or below their alert level.">
        {data.lowStock.length === 0 ? (
          <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Boxes className="size-4" aria-hidden /> Everything tracked is well stocked.
          </p>
        ) : (
          <>
            <ul className="divide-y">
              {data.lowStock.map((r) => (
                <li key={`${r.productId}:${r.variantId ?? ""}`} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <Link href={`${ROUTES.products}/${r.productId}`} className="min-w-0 truncate font-medium hover:underline">
                    {r.productName}
                    {r.variantTitle ? <span className="font-normal text-muted-foreground"> · {r.variantTitle}</span> : null}
                  </Link>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="tabular-nums text-muted-foreground">{r.quantity} left</span>
                    <StockState row={r} />
                  </span>
                </li>
              ))}
            </ul>
            <Link href={`${ROUTES.inventory}?stock=low`} className="inline-flex items-center gap-1 text-xs font-medium text-link underline-offset-2 hover:underline">
              <BarChart3 className="size-3" aria-hidden /> Manage inventory
            </Link>
          </>
        )}
      </SectionCard>
    </div>
  );
}
