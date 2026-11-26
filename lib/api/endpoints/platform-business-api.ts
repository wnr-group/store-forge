import "server-only";
import { apiRequest, type ApiQuery, type PageMeta } from "@/lib/api/client";

/**
 * The commercial side of the Platform Admin API: dashboard, subscription plans, subscriptions, entitlements and limits,
 * billing (invoices, payments, refunds, settings) and monitoring. Platform endpoints never send an organization id; the API
 * checks the role (and the database checks it again) on every call.
 */

export type Paged<T> = { items: T[]; meta: PageMeta };
const paged = <T>(r: { data: T[]; meta?: PageMeta }): Paged<T> => ({
  items: r.data,
  meta: r.meta ?? { page: 1, limit: r.data.length, total: r.data.length, totalPages: 1 },
});

export type CurrencyAmountApi = { currency: string; amountMinor: number };

// Dashboard ------------------------------------------------------------------------------------------------------------------
export type BillingSummaryApi = {
  from: string;
  to: string;
  mrr: CurrencyAmountApi[];
  successfulPayments: number;
  collected: CurrencyAmountApi[];
  failedPayments: number;
  pendingPayments: number;
  refunded: CurrencyAmountApi[];
  paymentsNeedingRefund: number;
  overdueInvoices: number;
  overdue: CurrencyAmountApi[];
  openInvoices: number;
};
export type AuditEntryApi = {
  id: string;
  adminEmail: string;
  action: string;
  entityType: string;
  organizationId: string | null;
  organizationName: string | null;
  description: string;
  createdAt: string;
};
export type GrowthPointApi = { date: string; count: number };
export type DashboardApi = {
  from: string;
  to: string;
  tenants: { total: number; active: number; suspended: number; users: number };
  subscriptions: { active: number; trialing: number; pastDue: number; expired: number; canceled: number };
  growth: { bucket: "day" | "week" | "month"; newSubscriptions: GrowthPointApi[]; newOrganizations: GrowthPointApi[] };
  billing: BillingSummaryApi | null;
  recentActivity: AuditEntryApi[] | null;
  health: { api: "up"; database: "up" | "down" };
};
export const getDashboardApi = async (query: ApiQuery) => (await apiRequest<DashboardApi>("/platform/dashboard", { query })).data;

// Plans ----------------------------------------------------------------------------------------------------------------------
export type LimitValueApi = { soft: number | null; hard: number | null };
export type PlanApi = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: "active" | "inactive";
  currency: string;
  monthlyPrice: string;
  monthlyPriceMinor: number;
  yearlyPrice: string;
  yearlyPriceMinor: number;
  trialDays: number;
  isDefault: boolean;
  isUnrestricted: boolean;
  sortOrder: number;
  features: Record<string, boolean>;
  limits: Record<string, LimitValueApi>;
  subscriberCount: number;
  createdAt: string;
  updatedAt: string;
};
export type PlanCatalogApi = {
  features: { key: string; label: string; description: string; group: string }[];
  limits: { key: string; label: string; description: string; unit: "count" | "bytes"; enforced: boolean }[];
};
export type PlanInputApi = {
  code?: string;
  name?: string;
  description?: string | null;
  currency?: string;
  monthlyPrice?: string;
  yearlyPrice?: string;
  trialDays?: number;
  isDefault?: boolean;
  isUnrestricted?: boolean;
  sortOrder?: number;
  features?: Record<string, boolean>;
  limits?: Record<string, { soft?: number | null; hard?: number | null } | null>;
};
export const getPlanCatalogApi = async () => (await apiRequest<PlanCatalogApi>("/platform/plan-catalog")).data;
export const listPlansApi = async (query: ApiQuery) => paged(await apiRequest<PlanApi[]>("/platform/plans", { query }));
export const getPlanApi = async (id: string) => (await apiRequest<PlanApi>(`/platform/plans/${id}`)).data;
export const createPlanApi = async (input: PlanInputApi) => (await apiRequest<PlanApi>("/platform/plans", { method: "POST", json: input })).data;
export const updatePlanApi = async (id: string, input: PlanInputApi) =>
  (await apiRequest<PlanApi>(`/platform/plans/${id}`, { method: "PATCH", json: input })).data;
export const setPlanStatusApi = async (id: string, status: "active" | "inactive") =>
  (await apiRequest<PlanApi>(`/platform/plans/${id}/status`, { method: "PATCH", json: { status } })).data;

// Subscriptions --------------------------------------------------------------------------------------------------------------
export type SubscriptionApi = {
  id: string;
  tenantId: string;
  plan: { id: string; code: string; name: string; status: string; currency: string; monthlyPriceMinor: number; yearlyPriceMinor: number; isUnrestricted: boolean };
  status: "trialing" | "active" | "past_due" | "canceled" | "expired";
  billingInterval: "monthly" | "yearly";
  trialEndsAt: string | null;
  currentPeriodStart: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
};
export const getSubscriptionApi = async (tenantId: string) => (await apiRequest<SubscriptionApi>(`/platform/organizations/${tenantId}/subscription`)).data;
export const assignPlanApi = async (tenantId: string, input: { planId: string; billingInterval?: "monthly" | "yearly"; startTrial?: boolean }) =>
  (await apiRequest<SubscriptionApi>(`/platform/organizations/${tenantId}/subscription`, { method: "PUT", json: input })).data;

// Entitlements and limits ----------------------------------------------------------------------------------------------------
export type EntitlementSourceApi = "plan" | "unrestricted" | "override";
export type LimitStateApi = {
  key: string;
  label: string;
  unit: "count" | "bytes";
  enforced: boolean;
  used: number | null;
  soft: number | null;
  hard: number | null;
  percent: number | null;
  level: "ok" | "warning" | "reached" | "unknown";
  source: EntitlementSourceApi;
};
export type TenantEntitlementsApi = {
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
  featureOverrides: { key: string; enabled: boolean; note: string | null; updatedAt: string }[];
  limitOverrides: { key: string; soft: number | null; hard: number | null; note: string | null; updatedAt: string }[];
};
export const getTenantEntitlementsApi = async (tenantId: string) =>
  (await apiRequest<TenantEntitlementsApi>(`/platform/organizations/${tenantId}/entitlements`)).data;
export const setFeatureOverrideApi = async (tenantId: string, key: string, input: { enabled: boolean | null; note?: string | null }) =>
  (await apiRequest<TenantEntitlementsApi>(`/platform/organizations/${tenantId}/entitlements/features/${key}`, { method: "PUT", json: input })).data;
export const setLimitOverrideApi = async (tenantId: string, key: string, input: { clear?: boolean; soft?: number | null; hard?: number | null; note?: string | null }) =>
  (await apiRequest<TenantEntitlementsApi>(`/platform/organizations/${tenantId}/entitlements/limits/${key}`, { method: "PUT", json: input })).data;

export type LimitUsageRowApi = {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended";
  planCode: string;
  planName: string;
  subscriptionStatus: string;
  isUnrestricted: boolean;
  worstLevel: "ok" | "warning" | "reached";
  limits: { key: string; used: number; soft: number | null; hard: number | null; percent: number | null; level: "ok" | "warning" | "reached" }[];
};
export const listLimitUsageApi = async (query: ApiQuery) => paged(await apiRequest<LimitUsageRowApi[]>("/platform/limit-usage", { query }));

// Billing --------------------------------------------------------------------------------------------------------------------
export type InvoiceApi = {
  id: string;
  number: string;
  tenantId: string;
  tenantName: string;
  planCode: string;
  planName: string;
  billingInterval: "monthly" | "yearly";
  description: string;
  periodStart: string;
  periodEnd: string;
  currency: string;
  subtotalMinor: number;
  taxRateBps: number;
  taxMinor: number;
  totalMinor: number;
  status: "open" | "paid" | "void";
  overdue: boolean;
  issuedAt: string;
  dueAt: string;
  paidAt: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  seller: { legalName: string; address: string | null; gstin: string | null; taxLabel: string };
};
export type BillingPaymentApi = {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  tenantId: string;
  tenantName: string;
  provider: "razorpay" | "manual";
  status: "pending" | "succeeded" | "failed" | "refunded" | "partially_refunded";
  amountMinor: number;
  currency: string;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  method: string | null;
  reference: string | null;
  note: string | null;
  failureCode: string | null;
  failureDescription: string | null;
  refundRequired: boolean;
  refundedMinor: number;
  capturedAt: string | null;
  createdAt: string;
};
export type BillingRefundApi = {
  id: string;
  paymentId: string;
  amountMinor: number;
  currency: string;
  status: "pending" | "processed" | "failed";
  reason: string | null;
  razorpayRefundId: string | null;
  failureReason: string | null;
  createdAt: string;
  processedAt: string | null;
};
export type InvoiceDetailApi = InvoiceApi & { payments: BillingPaymentApi[]; refunds: BillingRefundApi[] };
export type PaymentDetailApi = BillingPaymentApi & { refunds: BillingRefundApi[] };
export type BillingSettingsApi = {
  legalName: string;
  address: string | null;
  gstin: string | null;
  taxLabel: string;
  taxRateBps: number;
  dueDays: number;
  graceDays: number;
  renewalNoticeDays: number;
  updatedAt: string;
  paymentsConfigured: boolean;
};
export type TenantBillingApi = {
  planName: string | null;
  subscriptionStatus: string | null;
  billingInterval: string | null;
  renewsAt: string | null;
  overdue: boolean;
  overdueAmountMinor: number;
  openInvoices: number;
  recentInvoices: InvoiceApi[];
  recentPayments: BillingPaymentApi[];
};
export const getBillingSummaryApi = async (query: ApiQuery = {}) => (await apiRequest<BillingSummaryApi>("/platform/billing/summary", { query })).data;
export const getBillingSettingsApi = async () => (await apiRequest<BillingSettingsApi>("/platform/billing/settings")).data;
export const updateBillingSettingsApi = async (input: Partial<Omit<BillingSettingsApi, "updatedAt" | "paymentsConfigured">>) =>
  (await apiRequest<BillingSettingsApi>("/platform/billing/settings", { method: "PUT", json: input })).data;
export const listInvoicesApi = async (query: ApiQuery) => paged(await apiRequest<InvoiceApi[]>("/platform/billing/invoices", { query }));
export const getInvoiceApi = async (id: string) => (await apiRequest<InvoiceDetailApi>(`/platform/billing/invoices/${id}`)).data;
export const voidInvoiceApi = async (id: string, reason: string) =>
  (await apiRequest<InvoiceDetailApi>(`/platform/billing/invoices/${id}/void`, { method: "POST", json: { reason } })).data;
export const recordManualPaymentApi = async (id: string, input: { reference: string; method: string; note?: string | null }) =>
  (await apiRequest<InvoiceDetailApi>(`/platform/billing/invoices/${id}/payments`, { method: "POST", json: input })).data;
export const issueInvoiceApi = async (tenantId: string, period: "current" | "next") =>
  (await apiRequest<InvoiceDetailApi>(`/platform/organizations/${tenantId}/billing/invoices`, { method: "POST", json: { period } })).data;
export const getTenantBillingApi = async (tenantId: string) => (await apiRequest<TenantBillingApi>(`/platform/organizations/${tenantId}/billing`)).data;
export const listPaymentsApi = async (query: ApiQuery) => paged(await apiRequest<BillingPaymentApi[]>("/platform/billing/payments", { query }));
export const getPaymentApi = async (id: string) => (await apiRequest<PaymentDetailApi>(`/platform/billing/payments/${id}`)).data;
export const refundPaymentApi = async (id: string, input: { requestId: string; reason: string; amount?: string }) =>
  (await apiRequest<PaymentDetailApi>(`/platform/billing/payments/${id}/refund`, { method: "POST", json: input })).data;
export const runBillingApi = async () =>
  (await apiRequest<{ invoicesIssued: number; markedPastDue: number; expired: number }>("/platform/billing/run", { method: "POST" })).data;

// Monitoring -----------------------------------------------------------------------------------------------------------------
export type MonitoringApi = {
  generatedAt: string;
  api: { status: "up"; instanceUptimeSeconds: number; nodeVersion: string; environment: string };
  database: { status: "up" | "down"; latencyMs: number | null };
  services: { key: string; label: string; status: "up" | "down" | "not_configured" | "not_checked"; latencyMs: number | null; detail: string | null }[];
  errors: {
    available: boolean;
    reason: string | null;
    last15Minutes: number;
    last24Hours: number;
    byHour: { hour: string; count: number }[];
    topIssues: { method: string; route: string; errorName: string; message: string; count: number; lastSeen: string }[];
  };
  jobs: {
    job: string;
    label: string;
    expectedEveryMinutes: number;
    health: "ok" | "late" | "failing" | "never_run";
    lastRun: { status: "ok" | "failed"; startedAt: string; durationMs: number; summary: Record<string, unknown> | null; error: string | null } | null;
    lastSuccessAt: string | null;
    runsLast24Hours: number;
    failuresLast24Hours: number;
  }[];
  alerts: { id: string; severity: "critical" | "warning" | "info"; title: string; detail: string }[];
  unavailableMetrics: { key: string; label: string; reason: string }[];
};
export type ErrorEventApi = { id: string; occurredAt: string; method: string; route: string; status: number; errorName: string; message: string; source: string | null; requestId: string | null };
export type JobRunApi = { id: string; job: string; status: "ok" | "failed"; startedAt: string; finishedAt: string; durationMs: number; summary: Record<string, unknown> | null; error: string | null };
export const getMonitoringApi = async () => (await apiRequest<MonitoringApi>("/platform/monitoring/overview")).data;
export const listErrorEventsApi = async (query: ApiQuery) => paged(await apiRequest<ErrorEventApi[]>("/platform/monitoring/errors", { query }));
export const listJobRunsApi = async (query: ApiQuery) => paged(await apiRequest<JobRunApi[]>("/platform/monitoring/jobs", { query }));

// Audit extras ---------------------------------------------------------------------------------------------------------------
export const getAuditFiltersApi = async () => (await apiRequest<{ actions: string[]; entityTypes: string[] }>("/platform/audit-logs/filters")).data;
