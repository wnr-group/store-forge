import "server-only";
import { requirePlatformPermission, type PlatformPermission } from "@/lib/auth/platform";
import {
  assignPlanApi,
  createPlanApi,
  getAuditFiltersApi,
  getBillingSettingsApi,
  getBillingSummaryApi,
  getDashboardApi,
  getInvoiceApi,
  getMonitoringApi,
  getPaymentApi,
  getPlanApi,
  getPlanCatalogApi,
  getSubscriptionApi,
  getTenantBillingApi,
  getTenantEntitlementsApi,
  issueInvoiceApi,
  listErrorEventsApi,
  listInvoicesApi,
  listJobRunsApi,
  listLimitUsageApi,
  listPaymentsApi,
  listPlansApi,
  recordManualPaymentApi,
  refundPaymentApi,
  runBillingApi,
  setFeatureOverrideApi,
  setLimitOverrideApi,
  setPlanStatusApi,
  updateBillingSettingsApi,
  updatePlanApi,
  voidInvoiceApi,
  type PlanInputApi,
} from "@/lib/api/endpoints/platform-business-api";

/**
 * Commercial operations for the Platform Admin screens (plans, subscriptions, entitlements, billing, monitoring). Each function
 * first checks that the signed-in person's platform role holds the permission it needs, then calls the API, which checks the same
 * permission again and the database a third time. The screens hide what a role cannot use; none of that is the protection.
 */
const need = <T extends unknown[], R>(permission: PlatformPermission, fn: (...args: T) => Promise<R>) =>
  async (...args: T): Promise<R> => {
    await requirePlatformPermission(permission);
    return fn(...args);
  };

// Overview and monitoring
export const getDashboard = need("tenants:read", getDashboardApi);
export const getMonitoring = need("monitoring:read", getMonitoringApi);
export const listErrorEvents = need("monitoring:read", listErrorEventsApi);
export const listJobRuns = need("monitoring:read", listJobRunsApi);
export const getAuditFilters = need("audit:read", getAuditFiltersApi);

// Plans
export const getPlanCatalog = need("plans:read", getPlanCatalogApi);
export const listPlans = need("plans:read", listPlansApi);
export const getPlan = need("plans:read", getPlanApi);
export const createPlan = need("plans:manage", (input: PlanInputApi) => createPlanApi(input));
export const updatePlan = need("plans:manage", (id: string, input: PlanInputApi) => updatePlanApi(id, input));
export const setPlanStatus = need("plans:manage", setPlanStatusApi);

// Subscriptions, entitlements, limits
export const getSubscription = need("subscriptions:read", getSubscriptionApi);
export const assignPlan = need("subscriptions:manage", assignPlanApi);
export const getTenantEntitlements = need("subscriptions:read", getTenantEntitlementsApi);
export const setFeatureOverride = need("entitlements:manage", setFeatureOverrideApi);
export const setLimitOverride = need("entitlements:manage", setLimitOverrideApi);
export const listLimitUsage = need("usage:read", listLimitUsageApi);

// Billing
export const getBillingSummary = need("billing:read", getBillingSummaryApi);
export const getBillingSettings = need("billing:read", getBillingSettingsApi);
export const updateBillingSettings = need("billing:manage", updateBillingSettingsApi);
export const listInvoices = need("billing:read", listInvoicesApi);
export const getInvoice = need("billing:read", getInvoiceApi);
export const voidInvoice = need("billing:manage", voidInvoiceApi);
export const recordManualPayment = need("billing:manage", recordManualPaymentApi);
export const issueInvoice = need("billing:manage", issueInvoiceApi);
export const getTenantBilling = need("billing:read", getTenantBillingApi);
export const listPayments = need("billing:read", listPaymentsApi);
export const getPayment = need("billing:read", getPaymentApi);
export const refundPayment = need("billing:manage", refundPaymentApi);
export const runBilling = need("billing:manage", runBillingApi);
