import { z } from "zod";

/** Query strings of the commerce list pages. Anything unexpected falls back to "no filter" instead of failing the page. */
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
export const flatten = (raw: Record<string, string | string[] | undefined>) => Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, first(v)]));

const page = z.coerce.number().int().min(1).max(100_000).catch(1).default(1);
const q = z.string().trim().max(100).catch("").default("");
const pick = <const T extends readonly [string, ...string[]]>(values: T) => z.enum(values).optional().catch(undefined);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined);

export const orderListQuerySchema = z.object({
  q,
  page,
  status: pick(["pending_payment", "confirmed", "processing", "ready_to_ship", "shipped", "out_for_delivery", "delivered", "cancelled", "failed", "returned"]),
  payment: pick(["unpaid", "pending_collection", "paid", "collected", "failed", "partially_refunded", "refunded"]),
  method: pick(["razorpay", "cod"]),
});

export const transactionListQuerySchema = z.object({
  q,
  page,
  status: pick(["created", "authorized", "captured", "failed", "cancelled", "pending_collection", "collected"]),
  provider: pick(["razorpay", "cod"]),
  refund: pick(["none", "pending", "partial", "full"]),
  from: day,
  to: day,
});

export const refundListQuerySchema = z.object({ q, page, status: pick(["pending", "processing", "processed", "failed"]) });

export const shipmentListQuerySchema = z.object({
  q,
  page,
  status: pick(["creating", "created", "picked_up", "in_transit", "out_for_delivery", "undelivered", "returning", "delivered", "returned", "cancelled", "failed"]),
  carrier: pick(["shiprocket", "delhivery", "bluedart"]),
});

export const taxReportQuerySchema = z.object({ from: day, to: day });

// --- Marketing and reports -----------------------------------------------------------------------------------------------------

export const discountListQuerySchema = z.object({
  q,
  page,
  status: pick(["active", "disabled", "scheduled", "expired", "exhausted", "campaign_inactive"]),
  sort: z.enum(["created", "code", "uses"]).catch("created").default("created"),
  dir: z.enum(["asc", "desc"]).catch("desc").default("desc"),
});
export type DiscountListQuery = z.output<typeof discountListQuerySchema>;

export const campaignListQuerySchema = z.object({
  q,
  page,
  status: pick(["draft", "active", "paused", "completed"]),
  sort: z.enum(["created", "name", "start"]).catch("created").default("created"),
  dir: z.enum(["asc", "desc"]).catch("desc").default("desc"),
});
export type CampaignListQuery = z.output<typeof campaignListQuerySchema>;

export const abandonedCartListQuerySchema = z.object({
  q,
  page,
  status: pick(["abandoned", "active", "recovered", "expired"]),
  from: day,
  to: day,
  sort: z.enum(["recent", "value"]).catch("recent").default("recent"),
  dir: z.enum(["asc", "desc"]).catch("desc").default("desc"),
});
export type AbandonedCartListQuery = z.output<typeof abandonedCartListQuerySchema>;

/** Date range (and bucket size) of the report pages. */
export const reportRangeQuerySchema = z.object({ from: day, to: day, interval: z.enum(["day", "week", "month"]).catch("day").default("day") });
export type ReportRangeQuery = z.output<typeof reportRangeQuerySchema>;

export const productReportQuerySchema = z.object({
  q,
  page,
  from: day,
  to: day,
  sort: z.enum(["units", "revenue", "orders"]).catch("units").default("units"),
  dir: z.enum(["asc", "desc"]).catch("desc").default("desc"),
});
export type ProductReportQuery = z.output<typeof productReportQuerySchema>;

export const topCustomerQuerySchema = z.object({ q, page, from: day, to: day, sort: z.enum(["revenue", "orders"]).catch("revenue").default("revenue") });
export type TopCustomerQuery = z.output<typeof topCustomerQuerySchema>;
