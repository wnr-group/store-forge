import { z } from "zod";

/** Query strings of the commerce list pages. Anything unexpected falls back to "no filter" instead of failing the page. */
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
export const flatten = (raw: Record<string, string | string[] | undefined>) => Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, first(v)]));

const page = z.coerce.number().int().min(1).max(100_000).catch(1).default(1);
const q = z.string().trim().max(100).catch("").default("");
const pick = <T extends readonly [string, ...string[]]>(values: T) => z.enum(values).optional().catch(undefined);
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
