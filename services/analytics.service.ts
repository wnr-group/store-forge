import "server-only";
import { getAnalyticsApi } from "@/lib/api/endpoints/analytics-api";
import { requireActiveTenant } from "@/lib/tenant/context";
import type { InventoryRow } from "./inventory.service";

/**
 * Dashboard and analytics, served by the StoreForge API (`GET /analytics`). Every figure (sales, previous period, orders,
 * customers, average order, zero-filled daily series in the store's timezone, best sellers, recent orders, low stock) is
 * computed by the API from the organization's real orders. Money is in minor units.
 */
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

/** The API reads the store's own timezone and currency, so only the range is needed. */
export async function getAnalytics(range: RangeDays): Promise<Analytics> {
  const { tenant } = await requireActiveTenant();
  const data = await getAnalyticsApi(tenant.id, range);
  return { ...data, range, recentOrders: data.recentOrders.map((o) => ({ ...o, placedAt: new Date(o.placedAt) })) };
}
