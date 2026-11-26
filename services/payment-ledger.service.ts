import "server-only";
import {
  createRefundApi,
  getCodSettingsApi,
  getTransactionApi,
  listRefundsApi,
  listTransactionsApi,
  saveCodSettingsApi,
  syncRefundApi,
  type RefundApi,
  type TransactionApi,
  type TransactionListApiQuery,
} from "@/lib/api/endpoints/payments-ledger-api";
import { AppError } from "@/lib/errors";
import { withTenant } from "@/lib/tenant/with-tenant";
import type { Paged } from "./order.service";

/** COD settings, the payment transaction ledger and refunds for the ACTIVE tenant. Owner only (`payments:manage`), here and in the API. */
export const LEDGER_PAGE_SIZE = 20;

export const getCodSettings = () => withTenant("payments:manage", getCodSettingsApi);
export const saveCodSettings = (input: Parameters<typeof saveCodSettingsApi>[1]) => withTenant("payments:manage", (org) => saveCodSettingsApi(org, input));

export async function listTransactions(q: Omit<TransactionListApiQuery, "limit">): Promise<Paged<TransactionApi>> {
  return withTenant("payments:manage", async (org) => {
    const { items, meta } = await listTransactionsApi(org, { ...q, limit: LEDGER_PAGE_SIZE });
    return { items, total: meta.total, page: meta.page, pageSize: LEDGER_PAGE_SIZE };
  });
}

export async function getTransaction(id: string) {
  return withTenant("payments:manage", async (org) => {
    try {
      return await getTransactionApi(org, id);
    } catch (error) {
      if (error instanceof AppError && error.code === "NOT_FOUND") return null;
      throw error;
    }
  });
}

export const refundTransaction = (transactionId: string, input: { amountMinor?: number; reason: string }, idempotencyKey: string) =>
  withTenant("payments:manage", (org) => createRefundApi(org, transactionId, input, idempotencyKey));

export async function listRefunds(q: { page: number; search?: string; status?: string }): Promise<Paged<RefundApi>> {
  return withTenant("payments:manage", async (org) => {
    const { items, meta } = await listRefundsApi(org, { ...q, limit: LEDGER_PAGE_SIZE });
    return { items, total: meta.total, page: meta.page, pageSize: LEDGER_PAGE_SIZE };
  });
}

export const syncRefund = (id: string) => withTenant("payments:manage", (org) => syncRefundApi(org, id));
