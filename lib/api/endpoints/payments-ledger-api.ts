import "server-only";
import { apiRequest, type PageMeta } from "@/lib/api/client";

/** `/payments/cod`, `/payments/transactions` and `/payments/refunds` of the StoreForge API (Owner only). */
export type CodSettingsApi = { configured: boolean; enabled: boolean; minOrderMinor: number; maxOrderMinor: number | null; feeMinor: number; updatedAt: string | null };

export type TransactionApi = {
  id: string;
  orderId: string;
  orderNumber: number;
  provider: "razorpay" | "cod";
  status: string;
  amountMinor: number;
  currency: string;
  method: string | null;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  refundedMinor: number;
  refundPendingMinor: number;
  refundStatus: "none" | "pending" | "partial" | "full";
  refundRequired: boolean;
  createdAt: string;
  capturedAt: string | null;
  collectedAt: string | null;
};

export type RefundApi = {
  id: string;
  orderId: string;
  orderNumber: number;
  paymentTransactionId: string;
  amountMinor: number;
  currency: string;
  status: string;
  reason: string | null;
  source: "storeforge" | "razorpay_dashboard";
  razorpayRefundId: string | null;
  failureReason: string | null;
  createdAt: string;
  processedAt: string | null;
};

export type TransactionDetailApi = TransactionApi & {
  attempts: number;
  failureCode: string | null;
  failureDescription: string | null;
  refunds: RefundApi[];
  events: { eventId: string; eventType: string; status: string; note: string | null; receivedAt: string }[];
};

export type TransactionListApiQuery = { page: number; limit: number; search?: string; status?: string; provider?: string; method?: string; refundStatus?: string; from?: string; to?: string };

export const getCodSettingsApi = async (org: string) => (await apiRequest<CodSettingsApi>("/payments/cod", { organizationId: org })).data;
export const saveCodSettingsApi = async (org: string, input: { enabled: boolean; minOrderMinor: number; maxOrderMinor?: number | null; feeMinor: number }) =>
  (await apiRequest<CodSettingsApi>("/payments/cod", { method: "PUT", json: input, organizationId: org })).data;

export async function listTransactionsApi(org: string, query: TransactionListApiQuery): Promise<{ items: TransactionApi[]; meta: PageMeta }> {
  const { data, meta } = await apiRequest<TransactionApi[]>("/payments/transactions", { organizationId: org, query });
  return { items: data, meta: meta ?? { page: query.page, limit: query.limit, total: data.length, totalPages: 1 } };
}
export const getTransactionApi = async (org: string, id: string) => (await apiRequest<TransactionDetailApi>(`/payments/transactions/${id}`, { organizationId: org })).data;

export const createRefundApi = async (org: string, transactionId: string, input: { amountMinor?: number; reason: string }, idempotencyKey: string) =>
  (await apiRequest<RefundApi>(`/payments/transactions/${transactionId}/refunds`, { method: "POST", json: input, organizationId: org, headers: { "idempotency-key": idempotencyKey }, timeoutMs: 45_000 })).data;

export async function listRefundsApi(org: string, query: { page: number; limit: number; search?: string; status?: string }): Promise<{ items: RefundApi[]; meta: PageMeta }> {
  const { data, meta } = await apiRequest<RefundApi[]>("/payments/refunds", { organizationId: org, query });
  return { items: data, meta: meta ?? { page: query.page, limit: query.limit, total: data.length, totalPages: 1 } };
}
export const syncRefundApi = async (org: string, id: string) => (await apiRequest<RefundApi>(`/payments/refunds/${id}/sync`, { method: "POST", organizationId: org, timeoutMs: 30_000 })).data;
