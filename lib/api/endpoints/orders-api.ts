import "server-only";
import { apiRequest, type PageMeta } from "@/lib/api/client";
import type { OrderTaxApi } from "@/lib/api/endpoints/checkout-api";

/** `/orders` of the StoreForge API (the merchant's side). Dates arrive as ISO strings; money is in minor units. */
export type OrderSummaryApi = {
  id: string;
  orderNumber: number;
  status: string;
  paymentStatus: string;
  paymentMethod: "razorpay" | "cod" | null;
  fulfillmentStatus: string;
  customerName: string | null;
  customerEmail: string | null;
  currency: string;
  totalMinor: number;
  placedAt: string;
};

export type OrderAddressApi = { fullName: string; phone: string; line1: string; line2: string | null; city: string; state: string; postalCode: string; country: string };

export type OrderDetailApi = OrderSummaryApi & {
  subtotalMinor: number;
  discountMinor: number;
  shippingMinor: number;
  codFeeMinor: number;
  taxMinor: number;
  taxInclusive: boolean;
  customerPhone: string | null;
  cancelReason: string | null;
  shippingMethodName: string | null;
  shippingZoneName: string | null;
  shippingCarrierCode: string | null;
  shippingServiceCode: string | null;
  shippingDays: { min: number; max: number } | null;
  shippingWeightGrams: number;
  tax: OrderTaxApi;
  items: { id?: string; name: string; sku: string | null; quantity: number; unitPriceMinor: number; totalMinor: number }[];
  shippingAddress: OrderAddressApi | null;
  billingAddress: OrderAddressApi | null;
  history: { fromStatus: string | null; toStatus: string; actorType: string; note: string | null; createdAt: string }[];
  nextStatuses: string[];
};

export type OrderListApiQuery = { page: number; limit: number; search?: string; status?: string; paymentStatus?: string; paymentMethod?: string };

export async function listOrdersApi(organizationId: string, query: OrderListApiQuery): Promise<{ items: OrderSummaryApi[]; meta: PageMeta }> {
  const { data, meta } = await apiRequest<OrderSummaryApi[]>("/orders", { organizationId, query });
  return { items: data, meta: meta ?? { page: query.page, limit: query.limit, total: data.length, totalPages: 1 } };
}

export const getOrderApi = async (organizationId: string, id: string) => (await apiRequest<OrderDetailApi>(`/orders/${id}`, { organizationId })).data;

export const updateOrderStatusApi = async (organizationId: string, id: string, input: { status: string; note?: string }) =>
  (await apiRequest<OrderDetailApi>(`/orders/${id}/status`, { method: "POST", json: input, organizationId })).data;

export const cancelOrderApi = async (organizationId: string, id: string, input: { reason: string }) =>
  (await apiRequest<OrderDetailApi>(`/orders/${id}/cancel`, { method: "POST", json: input, organizationId })).data;

export const collectCodApi = async (organizationId: string, id: string) =>
  (await apiRequest<OrderDetailApi>(`/orders/${id}/cod/collect`, { method: "POST", organizationId })).data;
