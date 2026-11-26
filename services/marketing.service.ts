import "server-only";
import {
  createCampaignApi,
  createDiscountApi,
  deleteAbandonedCartApi,
  deleteCampaignApi,
  deleteDiscountApi,
  getAbandonedCartApi,
  getAbandonedCartSettingsApi,
  getAbandonedCartSummaryApi,
  getCampaignApi,
  getCustomerHistoryApi,
  getCustomerSummaryApi,
  getDiscountApi,
  getProductReportApi,
  getSalesReportApi,
  getTopCustomersApi,
  listAbandonedCartsApi,
  listCampaignsApi,
  listDiscountsApi,
  saveAbandonedCartSettingsApi,
  setCampaignStatusApi,
  setDiscountActiveApi,
  updateCampaignApi,
  updateDiscountApi,
  type CampaignInput,
  type CampaignStatusApi,
  type DiscountInput,
} from "@/lib/api/endpoints/marketing-api";
import { PAGE_SIZE } from "@/lib/validations/catalog";
import type { AbandonedCartListQuery, CampaignListQuery, DiscountListQuery, ProductReportQuery, ReportRangeQuery, TopCustomerQuery } from "@/lib/validations/commerce-lists";
import { withTenant } from "@/lib/tenant/with-tenant";

/**
 * Discount codes, campaigns, abandoned carts and the sales, product and customer reports of the ACTIVE tenant. Looking needs
 * `marketing:view` (order data), changing needs `marketing:manage`, the abandonment settings need `store:manage`, and the customer
 * reports need `customers:view`; the API checks each again. Every figure is computed by the API from the real orders.
 */
type Paged<T> = { items: T[]; total: number; page: number; pageSize: number };
const paged = <T>(r: { items: T[]; meta: { total: number; page: number } }): Paged<T> => ({ items: r.items, total: r.meta.total, page: r.meta.page, pageSize: PAGE_SIZE });

const DISCOUNT_SORT = { created: "createdAt", code: "code", uses: "redemptions" } as const;
const CAMPAIGN_SORT = { created: "createdAt", name: "name", start: "startsAt" } as const;
const CART_SORT = { recent: "lastActivityAt", value: "cartValue" } as const;

export const listDiscounts = (q: DiscountListQuery) =>
  withTenant("marketing:view", async (o) => paged(await listDiscountsApi(o, { page: q.page, limit: PAGE_SIZE, search: q.q, status: q.status, sortBy: DISCOUNT_SORT[q.sort], sortOrder: q.dir })));
export const getDiscount = (id: string) => withTenant("marketing:view", (o) => getDiscountApi(o, id));
export const createDiscount = (input: DiscountInput) => withTenant("marketing:manage", (o) => createDiscountApi(o, input));
export const updateDiscount = (id: string, input: Omit<DiscountInput, "code">) => withTenant("marketing:manage", (o) => updateDiscountApi(o, id, input));
export const setDiscountActive = (id: string, isActive: boolean) => withTenant("marketing:manage", (o) => setDiscountActiveApi(o, id, isActive));
export const deleteDiscount = (id: string) => withTenant("marketing:manage", (o) => deleteDiscountApi(o, id));

export const listCampaigns = (q: CampaignListQuery) =>
  withTenant("marketing:view", async (o) => paged(await listCampaignsApi(o, { page: q.page, limit: PAGE_SIZE, search: q.q, status: q.status, sortBy: CAMPAIGN_SORT[q.sort], sortOrder: q.dir })));
export const getCampaign = (id: string) => withTenant("marketing:view", (o) => getCampaignApi(o, id));
export const createCampaign = (input: CampaignInput) => withTenant("marketing:manage", (o) => createCampaignApi(o, input));
export const updateCampaign = (id: string, input: CampaignInput) => withTenant("marketing:manage", (o) => updateCampaignApi(o, id, input));
export const setCampaignStatus = (id: string, status: CampaignStatusApi) => withTenant("marketing:manage", (o) => setCampaignStatusApi(o, id, status));
export const deleteCampaign = (id: string) => withTenant("marketing:manage", (o) => deleteCampaignApi(o, id));
/** Every code, for choosing the codes of a campaign. */
export const listAllDiscountCodes = () => withTenant("marketing:view", async (o) => (await listDiscountsApi(o, { page: 1, limit: 100 })).items.map((d) => ({ id: d.id, code: d.code, campaignId: d.campaignId })));

export const listAbandonedCarts = (q: AbandonedCartListQuery) =>
  withTenant("marketing:view", async (o) => paged(await listAbandonedCartsApi(o, { page: q.page, limit: PAGE_SIZE, search: q.q, status: q.status, from: q.from, to: q.to, sortBy: CART_SORT[q.sort], sortOrder: q.dir })));
export const getAbandonedCart = (id: string) => withTenant("marketing:view", (o) => getAbandonedCartApi(o, id));
export const getAbandonedCartSummary = (range: { from?: string; to?: string }) => withTenant("marketing:view", (o) => getAbandonedCartSummaryApi(o, range));
export const getAbandonedCartSettings = () => withTenant("marketing:view", getAbandonedCartSettingsApi);
export const saveAbandonedCartSettings = (input: { abandonmentThresholdMinutes: number; recoveryLinkDays: number }) => withTenant("store:manage", (o) => saveAbandonedCartSettingsApi(o, input));
export const deleteAbandonedCart = (id: string) => withTenant("marketing:manage", (o) => deleteAbandonedCartApi(o, id));

export const getSalesReport = (q: ReportRangeQuery) => withTenant("marketing:view", (o) => getSalesReportApi(o, { from: q.from, to: q.to, interval: q.interval }));
export const getProductReport = (q: ProductReportQuery) =>
  withTenant("marketing:view", async (o) => paged(await getProductReportApi(o, { page: q.page, limit: PAGE_SIZE, from: q.from, to: q.to, search: q.q, sortBy: q.sort, sortOrder: q.dir })));
export const getCustomerSummary = (range: { from?: string; to?: string }) => withTenant("customers:view", (o) => getCustomerSummaryApi(o, range));
export const getTopCustomers = (q: TopCustomerQuery) =>
  withTenant("customers:view", async (o) => paged(await getTopCustomersApi(o, { page: q.page, limit: PAGE_SIZE, from: q.from, to: q.to, search: q.q, sortBy: q.sort })));
export const getCustomerHistory = (id: string, page: number) => withTenant("customers:view", (o) => getCustomerHistoryApi(o, id, { page, limit: PAGE_SIZE }));
