import "server-only";
import { cancelOrderApi, collectCodApi, getOrderApi, listOrdersApi, updateOrderStatusApi, type OrderDetailApi, type OrderListApiQuery, type OrderSummaryApi } from "@/lib/api/endpoints/orders-api";
import { createShipmentApi, listOrderShipmentsApi, type ShipmentApi } from "@/lib/api/endpoints/shipping-api";
import { AppError } from "@/lib/errors";
import { withTenant } from "@/lib/tenant/with-tenant";

/**
 * Orders for the ACTIVE tenant, served by the StoreForge API (`/orders`). Permissions are checked before any call (the API
 * checks again): viewing needs `orders:view`, changing status / cancelling / collecting cash / booking a shipment needs
 * `orders:manage`. The allowed next statuses come from the API's state machine, never from this app.
 */
export const ORDER_PAGE_SIZE = 20;

export type Paged<T> = { items: T[]; total: number; page: number; pageSize: number };

export async function listOrders(q: Omit<OrderListApiQuery, "limit">): Promise<Paged<OrderSummaryApi>> {
  return withTenant("orders:view", async (org) => {
    const { items, meta } = await listOrdersApi(org, { ...q, limit: ORDER_PAGE_SIZE });
    return { items, total: meta.total, page: meta.page, pageSize: ORDER_PAGE_SIZE };
  });
}

export async function getOrder(id: string): Promise<{ order: OrderDetailApi; shipments: ShipmentApi[] } | null> {
  return withTenant("orders:view", async (org) => {
    try {
      const [order, shipments] = await Promise.all([getOrderApi(org, id), listOrderShipmentsApi(org, id)]);
      return { order, shipments };
    } catch (error) {
      if (error instanceof AppError && error.code === "NOT_FOUND") return null;
      throw error;
    }
  });
}

export const changeOrderStatus = (id: string, input: { status: string; note?: string }) => withTenant("orders:manage", (org) => updateOrderStatusApi(org, id, input));
export const cancelOrder = (id: string, reason: string) => withTenant("orders:manage", (org) => cancelOrderApi(org, id, { reason }));
export const collectCod = (id: string) => withTenant("orders:manage", (org) => collectCodApi(org, id));
export const bookShipment = (orderId: string, input: Parameters<typeof createShipmentApi>[2]) => withTenant("orders:manage", (org) => createShipmentApi(org, orderId, input));
