import "server-only";
import { apiRequest, type PageMeta } from "@/lib/api/client";

/**
 * `/marketing/*` and `/analytics/*` (reports) of the StoreForge API: discount codes, campaigns, abandoned carts and the sales,
 * product and customer reports. Dates arrive as ISO strings and money in minor units; the API computes every figure.
 */
type Page<T> = { items: T[]; meta: PageMeta };

// --- Discount codes ------------------------------------------------------------------------------------------------------------

export type DiscountStatusApi = "active" | "disabled" | "scheduled" | "expired" | "exhausted" | "campaign_inactive";

export type DiscountPerformanceApi = { redemptions: number; discountTotalMinor: number; grossSalesMinor: number; netSalesMinor: number; averageOrderMinor: number };

export type DiscountApi = {
  id: string;
  code: string;
  description: string | null;
  kind: "percentage" | "fixed";
  value: number;
  minSubtotalMinor: number;
  maxDiscountMinor: number | null;
  startsAt: string | null;
  expiresAt: string | null;
  usageLimit: number | null;
  perCustomerLimit: number | null;
  appliesTo: "all" | "products" | "collections";
  isActive: boolean;
  status: DiscountStatusApi;
  campaignId: string | null;
  campaignName: string | null;
  performance: DiscountPerformanceApi;
  createdAt: string;
  updatedAt: string;
};

export type TargetApi = { id: string; name: string };
export type DiscountDetailApi = DiscountApi & { products: TargetApi[]; collections: TargetApi[] };

export type DiscountInput = {
  code?: string;
  description?: string | null;
  kind: "percentage" | "fixed";
  value: number;
  minSubtotalMinor: number;
  maxDiscountMinor: number | null;
  startsAt: string | null;
  expiresAt: string | null;
  usageLimit: number | null;
  perCustomerLimit: number | null;
  appliesTo: "all" | "products" | "collections";
  productIds: string[];
  collectionIds: string[];
  campaignId: string | null;
  isActive: boolean;
};

export type DiscountListQuery = { page: number; limit: number; search?: string; status?: DiscountStatusApi; campaignId?: string; sortBy?: "createdAt" | "code" | "redemptions"; sortOrder?: "asc" | "desc" };

export const listDiscountsApi = async (org: string, query: DiscountListQuery): Promise<Page<DiscountApi>> => {
  const r = await apiRequest<DiscountApi[]>("/marketing/discounts", { organizationId: org, query });
  return { items: r.data, meta: r.meta! };
};
export const getDiscountApi = async (org: string, id: string) => (await apiRequest<DiscountDetailApi>(`/marketing/discounts/${id}`, { organizationId: org })).data;
export const createDiscountApi = async (org: string, input: DiscountInput) => (await apiRequest<DiscountDetailApi>("/marketing/discounts", { method: "POST", json: input, organizationId: org })).data;
export const updateDiscountApi = async (org: string, id: string, input: Omit<DiscountInput, "code">) => (await apiRequest<DiscountDetailApi>(`/marketing/discounts/${id}`, { method: "PATCH", json: input, organizationId: org })).data;
export const setDiscountActiveApi = async (org: string, id: string, isActive: boolean) => (await apiRequest<DiscountDetailApi>(`/marketing/discounts/${id}`, { method: "PATCH", json: { isActive }, organizationId: org })).data;
export const deleteDiscountApi = async (org: string, id: string) => {
  await apiRequest(`/marketing/discounts/${id}`, { method: "DELETE", organizationId: org });
};

// --- Campaigns -----------------------------------------------------------------------------------------------------------------

export type CampaignStatusApi = "draft" | "active" | "paused" | "completed";
export type CampaignPhaseApi = "draft" | "scheduled" | "live" | "paused" | "ended";

export type CampaignApi = {
  id: string;
  name: string;
  description: string | null;
  status: CampaignStatusApi;
  phase: CampaignPhaseApi;
  startsAt: string | null;
  endsAt: string | null;
  performance: DiscountPerformanceApi & { discountCodes: number };
  createdAt: string;
  updatedAt: string;
};
export type CampaignDetailApi = CampaignApi & { products: TargetApi[]; collections: TargetApi[]; discounts: { id: string; code: string; isActive: boolean }[] };

export type CampaignInput = { name: string; description: string | null; startsAt: string | null; endsAt: string | null; productIds: string[]; collectionIds: string[]; discountIds: string[] };

export type CampaignListQuery = { page: number; limit: number; search?: string; status?: CampaignStatusApi; sortBy?: "createdAt" | "name" | "startsAt"; sortOrder?: "asc" | "desc" };

export const listCampaignsApi = async (org: string, query: CampaignListQuery): Promise<Page<CampaignApi>> => {
  const r = await apiRequest<CampaignApi[]>("/marketing/campaigns", { organizationId: org, query });
  return { items: r.data, meta: r.meta! };
};
export const getCampaignApi = async (org: string, id: string) => (await apiRequest<CampaignDetailApi>(`/marketing/campaigns/${id}`, { organizationId: org })).data;
export const createCampaignApi = async (org: string, input: CampaignInput) => (await apiRequest<CampaignDetailApi>("/marketing/campaigns", { method: "POST", json: input, organizationId: org })).data;
export const updateCampaignApi = async (org: string, id: string, input: CampaignInput) => (await apiRequest<CampaignDetailApi>(`/marketing/campaigns/${id}`, { method: "PATCH", json: input, organizationId: org })).data;
export const setCampaignStatusApi = async (org: string, id: string, status: CampaignStatusApi) => (await apiRequest<CampaignDetailApi>(`/marketing/campaigns/${id}/status`, { method: "POST", json: { status }, organizationId: org })).data;
export const deleteCampaignApi = async (org: string, id: string) => {
  await apiRequest(`/marketing/campaigns/${id}`, { method: "DELETE", organizationId: org });
};

// --- Abandoned carts -----------------------------------------------------------------------------------------------------------

export type AbandonedCartStatusApi = "active" | "abandoned" | "recovered" | "expired";

export type AbandonedCartApi = {
  id: string;
  email: string | null;
  customerName: string | null;
  phone: string | null;
  itemCount: number;
  cartValueMinor: number;
  currency: string;
  status: AbandonedCartStatusApi;
  lastActivityAt: string;
  abandonedAt: string | null;
  recoveredAt: string | null;
  recoveredOrderNumber: number | null;
  recoveryClicks: number;
  marketingConsent: boolean;
  canContact: boolean;
};
export type AbandonedCartDetailApi = AbandonedCartApi & { items: { name: string; productSlug?: string; variantId?: string | null; quantity: number; unitPriceMinor: number }[]; recoveryPath: string | null };
export type AbandonedCartSummaryApi = { from: string; to: string; abandonedCount: number; abandonedValueMinor: number; recoveredCount: number; recoveredValueMinor: number; recoveryRatePercent: number; activeCount: number };
export type AbandonedCartSettingsApi = { configured: boolean; abandonmentThresholdMinutes: number; recoveryLinkDays: number; updatedAt: string | null };

export type AbandonedCartListQuery = { page: number; limit: number; search?: string; status?: AbandonedCartStatusApi; from?: string; to?: string; sortBy?: "lastActivityAt" | "cartValue"; sortOrder?: "asc" | "desc" };

export const listAbandonedCartsApi = async (org: string, query: AbandonedCartListQuery): Promise<Page<AbandonedCartApi>> => {
  const r = await apiRequest<AbandonedCartApi[]>("/marketing/abandoned-carts", { organizationId: org, query });
  return { items: r.data, meta: r.meta! };
};
export const getAbandonedCartApi = async (org: string, id: string) => (await apiRequest<AbandonedCartDetailApi>(`/marketing/abandoned-carts/${id}`, { organizationId: org })).data;
export const getAbandonedCartSummaryApi = async (org: string, query: { from?: string; to?: string }) => (await apiRequest<AbandonedCartSummaryApi>("/marketing/abandoned-carts/summary", { organizationId: org, query })).data;
export const getAbandonedCartSettingsApi = async (org: string) => (await apiRequest<AbandonedCartSettingsApi>("/marketing/abandoned-carts/settings", { organizationId: org })).data;
export const saveAbandonedCartSettingsApi = async (org: string, input: { abandonmentThresholdMinutes: number; recoveryLinkDays: number }) =>
  (await apiRequest<AbandonedCartSettingsApi>("/marketing/abandoned-carts/settings", { method: "PUT", json: input, organizationId: org })).data;
export const deleteAbandonedCartApi = async (org: string, id: string) => {
  await apiRequest(`/marketing/abandoned-carts/${id}`, { method: "DELETE", organizationId: org });
};

// --- Reports -------------------------------------------------------------------------------------------------------------------

export type SalesFiguresApi = {
  orders: number;
  grossSalesMinor: number;
  discountsMinor: number;
  refundsMinor: number;
  netSalesMinor: number;
  shippingAndFeesMinor: number;
  taxMinor: number;
  totalSalesMinor: number;
  netRevenueMinor: number;
  averageOrderValueMinor: number;
};
export type SalesPointApi = SalesFiguresApi & { period: string };
export type SalesReportApi = {
  from: string;
  to: string;
  interval: "day" | "week" | "month";
  currency: string;
  timeZone: string;
  totals: SalesFiguresApi;
  previous: { from: string; to: string; figures: SalesFiguresApi; changePercent: Record<string, number | null> };
  series: SalesPointApi[];
};
export type SalesReportQuery = { from?: string; to?: string; interval?: "day" | "week" | "month" };

export const getSalesReportApi = async (org: string, query: SalesReportQuery) => (await apiRequest<SalesReportApi>("/analytics/revenue", { organizationId: org, query })).data;

export type ProductPerformanceApi = { productId: string; name: string; slug: string; status: string; unitsSold: number; revenueMinor: number; orders: number; conversionRatePercent: number | null };
export type ProductReportQuery = { page: number; limit: number; from?: string; to?: string; search?: string; sortBy?: "units" | "revenue" | "orders"; sortOrder?: "asc" | "desc" };

export const getProductReportApi = async (org: string, query: ProductReportQuery): Promise<Page<ProductPerformanceApi>> => {
  const r = await apiRequest<ProductPerformanceApi[]>("/analytics/products", { organizationId: org, query });
  return { items: r.data, meta: r.meta! };
};

export type CustomerSummaryApi = {
  from: string;
  to: string;
  totalCustomers: number;
  newCustomers: number;
  buyers: number;
  firstTimeBuyers: number;
  returningCustomers: number;
  repeatPurchaseRatePercent: number;
  averageOrdersPerBuyer: number;
  averageSpendPerBuyerMinor: number;
  averageOrderValueMinor: number;
};
export const getCustomerSummaryApi = async (org: string, query: { from?: string; to?: string }) => (await apiRequest<CustomerSummaryApi>("/analytics/customers", { organizationId: org, query })).data;

export type TopCustomerApi = { customerId: string; fullName: string; email: string; orders: number; revenueMinor: number; lastOrderAt: string };
export type TopCustomerQuery = { page: number; limit: number; from?: string; to?: string; search?: string; sortBy?: "revenue" | "orders" };
export const getTopCustomersApi = async (org: string, query: TopCustomerQuery): Promise<Page<TopCustomerApi>> => {
  const r = await apiRequest<TopCustomerApi[]>("/analytics/customers/top", { organizationId: org, query });
  return { items: r.data, meta: r.meta! };
};

export type CustomerHistoryApi = {
  customerId: string;
  fullName: string;
  email: string;
  lifetimeOrders: number;
  lifetimeRevenueMinor: number;
  averageOrderValueMinor: number;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  orders: { id: string; orderNumber: number; status: string; paymentStatus: string; itemCount: number; discountMinor: number; totalMinor: number; countsAsSale: boolean; placedAt: string }[];
  page: number;
  limit: number;
  totalOrders: number;
};
export const getCustomerHistoryApi = async (org: string, id: string, query: { page: number; limit: number }) => (await apiRequest<CustomerHistoryApi>(`/analytics/customers/${id}/history`, { organizationId: org, query })).data;
