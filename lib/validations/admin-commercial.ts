import { z } from "zod";
import { ADMIN_PAGE_SIZES, DEFAULT_ADMIN_PAGE_SIZE } from "@/lib/validations/admin-list";

/** Validation for the plan, billing and entitlement screens. The same schemas run in the browser and in the server actions; the API validates again. */

const money = z
  .string()
  .trim()
  .min(1, "Enter an amount")
  .max(16, "That amount is too large")
  .regex(/^\d+(\.\d+)?$/, "Enter a valid amount, for example 499 or 1499.50");
const wholeNumber = (label: string, max: number) =>
  z.coerce
    .number({ error: `${label} must be a whole number` })
    .int(`${label} must be a whole number`)
    .min(0, `${label} cannot be negative`)
    .max(max, `${label} is too large`);
/** An optional whole number typed in a form: empty means "none". */
const optionalWhole = (label: string) =>
  z
    .union([z.literal(""), z.null(), z.undefined(), z.coerce.number().int(`${label} must be a whole number`).min(0, `${label} cannot be negative`).max(1e12, `${label} is too large`)])
    .transform((v) => (v === "" || v === null || v === undefined ? null : v));

export const planLimitInputSchema = z
  .object({ soft: optionalWhole("The warning limit"), hard: optionalWhole("The hard limit") })
  .refine((v) => v.soft === null || v.hard === null || v.soft <= v.hard, { message: "The warning limit cannot be above the hard limit", path: ["soft"] });

export const planFormSchema = z.object({
  code: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9_-]{1,38}[a-z0-9]$/, "3 to 40 characters: lowercase letters, numbers, - and _"),
  name: z.string().trim().min(2, "Enter a name").max(60, "At most 60 characters"),
  description: z.string().trim().max(500, "At most 500 characters").default(""),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Choose a currency"),
  monthlyPrice: money,
  yearlyPrice: money,
  trialDays: wholeNumber("Trial days", 365),
  sortOrder: wholeNumber("Sort order", 10_000),
  isDefault: z.boolean().default(false),
  isUnrestricted: z.boolean().default(false),
  features: z.record(z.string(), z.boolean()).default({}),
  limits: z.record(z.string(), planLimitInputSchema).default({}),
});
export type PlanFormValues = z.input<typeof planFormSchema>;
export type PlanFormParsed = z.output<typeof planFormSchema>;

export const planUpdateSchema = planFormSchema.omit({ code: true });

export const planStatusSchema = z.enum(["active", "inactive"]);

export const assignPlanSchema = z.object({
  planId: z.uuid("Choose a plan"),
  billingInterval: z.enum(["monthly", "yearly"]),
  startTrial: z.boolean().default(false),
});

export const featureOverrideSchema = z.object({
  key: z.string().min(2).max(50),
  enabled: z.boolean().nullable(),
  note: z.string().trim().max(200, "At most 200 characters").default(""),
});

export const limitOverrideSchema = z
  .object({
    key: z.string().min(2).max(50),
    clear: z.boolean().default(false),
    soft: optionalWhole("The warning limit"),
    hard: optionalWhole("The hard limit"),
    note: z.string().trim().max(200, "At most 200 characters").default(""),
  })
  .refine((v) => v.clear || v.soft === null || v.hard === null || v.soft <= v.hard, { message: "The warning limit cannot be above the hard limit", path: ["soft"] });

export const issueInvoiceSchema = z.object({ period: z.enum(["current", "next"]) });
export const voidInvoiceSchema = z.object({ reason: z.string().trim().min(3, "Give a short reason").max(300, "At most 300 characters") });
export const manualPaymentSchema = z.object({
  reference: z.string().trim().min(2, "Enter the bank or cheque reference").max(120, "At most 120 characters"),
  method: z.string().trim().min(2, "Enter how it was paid").max(40, "At most 40 characters"),
  note: z.string().trim().max(300, "At most 300 characters").default(""),
});
export const refundSchema = z.object({
  reason: z.string().trim().min(3, "Give a short reason").max(300, "At most 300 characters"),
  /** Empty refunds everything that is left. */
  amount: z.string().trim().max(16).regex(/^(\d+(\.\d+)?)?$/, "Enter a valid amount").default(""),
});

export const billingSettingsSchema = z.object({
  legalName: z.string().trim().min(2, "Enter the company name").max(120, "At most 120 characters"),
  address: z.string().trim().max(300, "At most 300 characters").default(""),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^([0-9A-Z]{15})?$/, "A GSTIN has 15 letters and digits")
    .default(""),
  taxLabel: z.string().trim().min(1, "Enter a label").max(20, "At most 20 characters"),
  /** Typed as a percentage (18), stored in basis points (1800). */
  taxPercent: z
    .string()
    .trim()
    .regex(/^\d{1,3}(\.\d{1,2})?$/, "Enter a percentage such as 18 or 12.5")
    .refine((v) => Number(v) <= 100, "At most 100"),
  dueDays: wholeNumber("Due days", 90),
  graceDays: wholeNumber("Grace days", 90),
  renewalNoticeDays: wholeNumber("Renewal notice days", 60),
});
export type BillingSettingsValues = z.input<typeof billingSettingsSchema>;

// URL query strings ---------------------------------------------------------------------------------------------------------
const page = z.coerce.number().int().min(1).max(100_000).catch(1);
const pageSize = z.coerce
  .number()
  .refine((n): n is (typeof ADMIN_PAGE_SIZES)[number] => (ADMIN_PAGE_SIZES as readonly number[]).includes(n))
  .catch(DEFAULT_ADMIN_PAGE_SIZE);
const text = (max: number) => z.string().trim().max(max).catch("").default("");
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).catch("").default("");
const uuidOrEmpty = z.union([z.uuid(), z.literal("")]).catch("").default("");

export const planListQuerySchema = z.object({
  q: text(80),
  status: z.enum(["all", "active", "inactive"]).catch("all").default("all"),
  page: page.default(1),
  pageSize: pageSize.default(DEFAULT_ADMIN_PAGE_SIZE),
});
export const invoiceListQuerySchema = z.object({
  q: text(80),
  status: z.enum(["all", "open", "paid", "void", "overdue"]).catch("all").default("all"),
  org: uuidOrEmpty,
  from: dateOnly,
  to: dateOnly,
  page: page.default(1),
  pageSize: pageSize.default(DEFAULT_ADMIN_PAGE_SIZE),
});
export const paymentListQuerySchema = z.object({
  q: text(80),
  status: z.enum(["all", "pending", "succeeded", "failed", "refunded", "partially_refunded"]).catch("all").default("all"),
  org: uuidOrEmpty,
  from: dateOnly,
  to: dateOnly,
  refundRequired: z.enum(["", "true"]).catch("").default(""),
  page: page.default(1),
  pageSize: pageSize.default(DEFAULT_ADMIN_PAGE_SIZE),
});
export const limitsQuerySchema = z.object({
  q: text(80),
  filter: z.enum(["every", "attention", "warning", "reached"]).catch("attention").default("attention"),
  page: page.default(1),
  pageSize: pageSize.default(DEFAULT_ADMIN_PAGE_SIZE),
});
export const errorsQuerySchema = z.object({ q: text(80), page: page.default(1), pageSize: pageSize.default(DEFAULT_ADMIN_PAGE_SIZE) });
export const jobsQuerySchema = z.object({
  job: z.enum(["all", "expire-reservations", "reconcile-payments", "sync-shipments", "purge-abandoned-carts", "billing"]).catch("all").default("all"),
  status: z.enum(["all", "ok", "failed"]).catch("all").default("all"),
  page: page.default(1),
  pageSize: pageSize.default(DEFAULT_ADMIN_PAGE_SIZE),
});
export const dashboardQuerySchema = z.object({ from: dateOnly, to: dateOnly });

/** Converts a percentage typed in a form to basis points without floating point error ("12.5" -> 1250). */
export function percentToBps(percent: string): number {
  const [whole, frac = ""] = percent.trim().split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0").slice(0, 2));
}
export const bpsToPercent = (bps: number): string => (bps % 100 === 0 ? String(bps / 100) : (bps / 100).toFixed(2).replace(/0$/, ""));
