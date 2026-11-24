import "server-only";
import { apiRequest, type ApiQuery } from "@/lib/api/client";
import type { BillingPaymentApi, InvoiceApi, InvoiceDetailApi, LimitStateApi, EntitlementSourceApi, Paged, TenantBillingApi } from "@/lib/api/endpoints/platform-business-api";

/**
 * `/billing/*` and `/entitlements` of the StoreForge API: what the signed-in organization owes StoreForge for its plan, and what its
 * plan includes. The organization id is ALWAYS passed (the API refuses these routes without it). Invoice and payment shapes are the
 * same as the Platform Admin's. Nothing here decides an amount or marks anything paid: the API does, after checking with Razorpay.
 */
export type MyEntitlementsApi = {
  planCode: string;
  planName: string;
  isUnrestricted: boolean;
  subscriptionStatus: string;
  entitled: boolean;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  features: { key: string; label: string; group: string; enabled: boolean; source: EntitlementSourceApi }[];
  limits: LimitStateApi[];
  attention: LimitStateApi[];
};

export type PaymentIntentApi = { orderId: string; keyId: string; amountMinor: number; currency: string; invoiceNumber: string };
export type PaymentVerifiedApi = { result: string; invoiceStatus: "open" | "paid" | "void" };

export const getMyEntitlementsApi = async (organizationId: string, storage = false) =>
  (await apiRequest<MyEntitlementsApi>("/entitlements", { organizationId, query: storage ? { storage: "true" } : undefined })).data;

export const getMyBillingApi = async (organizationId: string) => (await apiRequest<TenantBillingApi>("/billing/overview", { organizationId })).data;

export const listMyInvoicesApi = async (organizationId: string, query: ApiQuery = {}): Promise<Paged<InvoiceApi>> => {
  const r = await apiRequest<InvoiceApi[]>("/billing/invoices", { organizationId, query });
  return { items: r.data, meta: r.meta ?? { page: 1, limit: r.data.length, total: r.data.length, totalPages: 1 } };
};

export const getMyInvoiceApi = async (organizationId: string, id: string) =>
  (await apiRequest<InvoiceDetailApi>(`/billing/invoices/${id}`, { organizationId })).data;

/** Creates a Razorpay order on StoreForge's own account for the full invoice amount. */
export const startInvoicePaymentApi = async (organizationId: string, id: string) =>
  (await apiRequest<PaymentIntentApi>(`/billing/invoices/${id}/pay`, { method: "POST", organizationId })).data;

/** Hands Razorpay's three values to the API, which checks the signature and asks Razorpay itself before it marks anything paid. */
export const verifyInvoicePaymentApi = async (organizationId: string, input: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }) =>
  (await apiRequest<PaymentVerifiedApi>("/billing/payments/verify", { method: "POST", json: input, organizationId })).data;

export type { BillingPaymentApi };
