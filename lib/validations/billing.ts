import { z } from "zod";

/** Razorpay Checkout's success values. The server checks all three with Razorpay; this only refuses obvious garbage. */
export const verifyPaymentSchema = z.object({
  razorpayOrderId: z.string().trim().min(1).max(100),
  razorpayPaymentId: z.string().trim().min(1).max(100),
  razorpaySignature: z.string().trim().min(1).max(200),
});

export const invoiceIdSchema = z.uuid();

export const MY_INVOICE_STATUSES = ["all", "open", "paid", "void", "overdue"] as const;
export const myInvoiceListSchema = z.object({
  status: z.enum(MY_INVOICE_STATUSES).catch("all").default("all"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1).default(1),
});
