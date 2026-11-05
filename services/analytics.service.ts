import "server-only";
import { sql } from "drizzle-orm";
import { REVENUE_ORDER_STATUSES } from "@/lib/db/schema/enums";
import { rowsOf } from "@/lib/db/user-context";
import { withTenantDb } from "@/lib/tenant/context";
import { listInventory, type InventoryRow } from "./inventory.service";

export const RANGES = [7, 30, 90] as const;
export type RangeDays = (typeof RANGES)[number];

export type SeriesPoint = { day: string; salesMinor: number; orders: number };
export type BestSeller = { name: string; units: number; salesMinor: number };
export type RecentOrder = { id: string; orderNumber: number; status: string; totalMinor: number; placedAt: Date; customerName: string | null };

export type Analytics = {
  range: RangeDays;
  /** False until the store has at least one order of any status: the UI then shows an empty state. */
  hasOrders: boolean;
  totalSalesMinor: number;
  previousSalesMinor: number;
  orders: number;
  customers: number;
  averageOrderMinor: number;
  series: SeriesPoint[];
  bestSellers: BestSeller[];
  recentOrders: RecentOrder[];
  lowStock: InventoryRow[];
};

const revenue = sql.join(REVENUE_ORDER_STATUSES.map((s) => sql`${s}`), sql`, `);

/** YYYY-MM-DD for the last `days` days in `timeZone`, oldest first (used to zero-fill days without orders). */
function lastDays(days: number, timeZone: string): string[] {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) out.push(fmt.format(new Date(Date.now() - i * 86_400_000)));
  return out;
}

function safeTimeZone(tz: string): string {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

/** Everything comes from the tenant's real orders; with none, totals are zero and `hasOrders` is false. */
export async function getAnalytics(range: RangeDays, timezone: string): Promise<Analytics> {
  const tz = safeTimeZone(timezone);
  const [data, out, low] = await Promise.all([
    withTenantDb({}, async (tx, ctx) => {
      const t = ctx.tenantId;
      // Independent read-only queries: issued together so they pipeline on the transaction's connection (one network
      // round trip instead of four). The pooler is remote, so each sequential round trip is visible to the user.
      const [sRes, seriesRes, bestRes, recentRes] = await Promise.all([
        tx.execute(sql`
          select
            exists (select 1 from public.orders where tenant_id = ${t}) as has_orders,
            coalesce(sum(total_minor) filter (where status in (${revenue}) and placed_at >= now() - make_interval(days => ${range})), 0)::float8 as sales,
            coalesce(sum(total_minor) filter (where status in (${revenue}) and placed_at >= now() - make_interval(days => ${range * 2}) and placed_at < now() - make_interval(days => ${range})), 0)::float8 as previous_sales,
            count(*) filter (where status <> 'cancelled' and placed_at >= now() - make_interval(days => ${range}))::int as orders,
            count(*) filter (where status in (${revenue}) and placed_at >= now() - make_interval(days => ${range}))::int as paid_orders,
            (select count(*)::int from public.customers where tenant_id = ${t}) as customers
          from public.orders where tenant_id = ${t}`),
        tx.execute(sql`
          select to_char((placed_at at time zone ${tz})::date, 'YYYY-MM-DD') as day,
                 coalesce(sum(total_minor) filter (where status in (${revenue})), 0)::float8 as sales,
                 count(*) filter (where status <> 'cancelled')::int as orders
          from public.orders
          where tenant_id = ${t} and placed_at >= now() - make_interval(days => ${range + 1})
          group by 1`),
        tx.execute(sql`
          select i.name, sum(i.quantity)::int as units, sum(i.total_minor)::float8 as sales
          from public.order_items i join public.orders o on o.id = i.order_id
          where i.tenant_id = ${t} and o.status in (${revenue}) and o.placed_at >= now() - make_interval(days => ${range})
          group by coalesce(i.product_id::text, i.name), i.name
          order by units desc, sales desc limit 5`),
        tx.execute(sql`
          select o.id, o.order_number, o.status, o.total_minor::float8 as total, o.placed_at, c.full_name
          from public.orders o left join public.customers c on c.id = o.customer_id
          where o.tenant_id = ${t} order by o.placed_at desc limit 8`),
      ]);
      const [s] = rowsOf<Record<string, number | boolean>>(sRes);
      const series = rowsOf<{ day: string; sales: number; orders: number }>(seriesRes);
      const best = rowsOf<{ name: string; units: number; sales: number }>(bestRes);
      const recent = rowsOf<Record<string, unknown>>(recentRes);
      return { s, series, best, recent };
    }),
    listInventory({ q: "", stock: "out", page: 1 }),
    listInventory({ q: "", stock: "low", page: 1 }),
  ]);

  const byDay = new Map(data.series.map((r) => [r.day, r]));
  const sales = Number(data.s.sales);
  const paidOrders = Number(data.s.paid_orders);
  return {
    range,
    hasOrders: Boolean(data.s.has_orders),
    totalSalesMinor: sales,
    previousSalesMinor: Number(data.s.previous_sales),
    orders: Number(data.s.orders),
    customers: Number(data.s.customers),
    averageOrderMinor: paidOrders > 0 ? Math.round(sales / paidOrders) : 0,
    series: lastDays(range, tz).map((day) => ({ day, salesMinor: Number(byDay.get(day)?.sales ?? 0), orders: Number(byDay.get(day)?.orders ?? 0) })),
    bestSellers: data.best.map((b) => ({ name: b.name, units: Number(b.units), salesMinor: Number(b.sales) })),
    recentOrders: data.recent.map((r) => ({
      id: r.id as string,
      orderNumber: Number(r.order_number),
      status: r.status as string,
      totalMinor: Number(r.total),
      placedAt: new Date(r.placed_at as string),
      customerName: (r.full_name as string | null) ?? null,
    })),
    lowStock: [...out.items, ...low.items].slice(0, 8),
  };
}
