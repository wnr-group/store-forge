import "server-only";
import { apiRequest } from "@/lib/api/client";
import type { InventoryRowApi } from "./inventory-api";

/** `GET /analytics` (also the dashboard overview). Money is in minor units; the API computes every figure. */
export type AnalyticsApi = {
  range: number;
  hasOrders: boolean;
  totalSalesMinor: number;
  previousSalesMinor: number;
  orders: number;
  customers: number;
  averageOrderMinor: number;
  series: { day: string; salesMinor: number; orders: number }[];
  bestSellers: { name: string; units: number; salesMinor: number }[];
  recentOrders: { id: string; orderNumber: number; status: string; totalMinor: number; placedAt: string; customerName: string | null }[];
  lowStock: InventoryRowApi[];
  currency: string;
  timezone: string;
};

export const getAnalyticsApi = async (organizationId: string, range: number) =>
  (await apiRequest<AnalyticsApi>("/analytics", { organizationId, query: { range } })).data;
