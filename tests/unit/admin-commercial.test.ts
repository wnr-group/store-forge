import { describe, expect, it } from "vitest";
import { everyText, moneyList, plural, uptimeText } from "@/lib/admin/format";
import {
  assignPlanSchema,
  billingSettingsSchema,
  bpsToPercent,
  featureOverrideSchema,
  invoiceListQuerySchema,
  limitOverrideSchema,
  limitsQuerySchema,
  manualPaymentSchema,
  paymentListQuerySchema,
  percentToBps,
  planFormSchema,
  refundSchema,
  voidInvoiceSchema,
} from "@/lib/validations/admin-commercial";

const plan = { code: "starter", name: "Starter", description: "", currency: "inr", monthlyPrice: "499", yearlyPrice: "4990", trialDays: "14", sortOrder: "0", isDefault: false, isUnrestricted: false, features: { discount_codes: true }, limits: { products: { soft: "80", hard: "100" } } };

describe("plan form", () => {
  it("accepts a complete plan and turns typed numbers into numbers and empty limits into none", () => {
    const v = planFormSchema.parse({ ...plan, limits: { products: { soft: "80", hard: "100" }, staff_accounts: { soft: "", hard: "3" }, storage_bytes: { soft: "", hard: "" } } });
    expect(v.currency).toBe("INR");
    expect(v.trialDays).toBe(14);
    expect(v.limits.products).toEqual({ soft: 80, hard: 100 });
    expect(v.limits.staff_accounts).toEqual({ soft: null, hard: 3 });
    expect(v.limits.storage_bytes).toEqual({ soft: null, hard: null });
  });

  it("refuses a bad code, name, price, trial and currency, with a message for each", () => {
    const bad = (over: Record<string, unknown>) => planFormSchema.safeParse({ ...plan, ...over });
    for (const code of ["", "A", "no spaces", "-start", "x".repeat(41)]) expect(bad({ code }).success, code).toBe(false);
    expect(bad({ name: "x" }).success).toBe(false);
    for (const monthlyPrice of ["", "-5", "abc", "1,299", "1e3"]) expect(bad({ monthlyPrice }).success, monthlyPrice).toBe(false);
    expect(bad({ trialDays: "400" }).success).toBe(false);
    expect(bad({ trialDays: "1.5" }).success).toBe(false);
    expect(bad({ currency: "RUPEES" }).success).toBe(false);
  });

  it("refuses a warning limit above the hard limit, and a limit that is not a whole number", () => {
    const r = planFormSchema.safeParse({ ...plan, limits: { products: { soft: "200", hard: "100" } } });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["limits", "products", "soft"]);
    expect(planFormSchema.safeParse({ ...plan, limits: { products: { soft: "", hard: "1.5" } } }).success).toBe(false);
    expect(planFormSchema.safeParse({ ...plan, limits: { products: { soft: "", hard: "-1" } } }).success).toBe(false);
  });
});

describe("subscriptions, exceptions and invoices", () => {
  const id = "0b9c6d1e-5f7a-4c1f-9b36-2f0d3c4e5a6b";
  it("needs a real plan id and a billing interval", () => {
    expect(assignPlanSchema.safeParse({ planId: id, billingInterval: "yearly" }).success).toBe(true);
    expect(assignPlanSchema.safeParse({ planId: "x", billingInterval: "yearly" }).success).toBe(false);
    expect(assignPlanSchema.safeParse({ planId: id, billingInterval: "weekly" }).success).toBe(false);
  });
  it("lets a feature exception be on, off or removed", () => {
    for (const enabled of [true, false, null]) expect(featureOverrideSchema.safeParse({ key: "meta_pixel", enabled }).success).toBe(true);
    expect(featureOverrideSchema.safeParse({ key: "meta_pixel", enabled: "yes" }).success).toBe(false);
  });
  it("checks a limit exception unless it is being removed", () => {
    expect(limitOverrideSchema.parse({ key: "products", soft: "", hard: "" })).toMatchObject({ soft: null, hard: null });
    expect(limitOverrideSchema.safeParse({ key: "products", soft: "10", hard: "5" }).success).toBe(false);
    expect(limitOverrideSchema.safeParse({ key: "products", clear: true, soft: "10", hard: "5" }).success).toBe(true);
  });
  it("needs a reason to void, a reference for an offline payment, and a valid refund amount", () => {
    expect(voidInvoiceSchema.safeParse({ reason: "no" }).success).toBe(false);
    expect(voidInvoiceSchema.safeParse({ reason: "Billing mistake" }).success).toBe(true);
    expect(manualPaymentSchema.safeParse({ reference: "x", method: "Bank transfer" }).success).toBe(false);
    expect(manualPaymentSchema.safeParse({ reference: "UTR 12345", method: "Bank transfer" }).success).toBe(true);
    expect(refundSchema.safeParse({ reason: "Goodwill", amount: "" }).success).toBe(true);
    expect(refundSchema.safeParse({ reason: "Goodwill", amount: "100.50" }).success).toBe(true);
    for (const amount of ["-1", "abc", "1,5"]) expect(refundSchema.safeParse({ reason: "Goodwill", amount }).success, amount).toBe(false);
  });
});

describe("billing settings", () => {
  const ok = { legalName: "StoreForge Technologies", address: "", gstin: "19abcde1234f1z5", taxLabel: "GST", taxPercent: "18", dueDays: "7", graceDays: "7", renewalNoticeDays: "7" };
  it("accepts valid settings and upper-cases the GSTIN", () => {
    expect(billingSettingsSchema.parse(ok).gstin).toBe("19ABCDE1234F1Z5");
    expect(billingSettingsSchema.safeParse({ ...ok, gstin: "" }).success).toBe(true);
  });
  it("refuses a short GSTIN, a tax rate that is not a percentage, and days out of range", () => {
    expect(billingSettingsSchema.safeParse({ ...ok, gstin: "SHORT" }).success).toBe(false);
    for (const taxPercent of ["", "abc", "101", "-1", "12.345"]) expect(billingSettingsSchema.safeParse({ ...ok, taxPercent }).success, taxPercent).toBe(false);
    expect(billingSettingsSchema.safeParse({ ...ok, graceDays: "91" }).success).toBe(false);
  });
  it("converts a percentage to basis points without floating point error, and back", () => {
    expect(percentToBps("18")).toBe(1800);
    expect(percentToBps("12.5")).toBe(1250);
    expect(percentToBps("0.07")).toBe(7);
    expect(percentToBps("5.1")).toBe(510);
    expect(bpsToPercent(1800)).toBe("18");
    expect(bpsToPercent(1250)).toBe("12.5");
    expect(bpsToPercent(7)).toBe("0.07");
    for (const p of ["0", "18", "12.5", "9.99", "100"]) expect(bpsToPercent(percentToBps(p))).toBe(p);
  });
});

describe("list addresses", () => {
  it("falls back to safe defaults for anything invalid instead of failing", () => {
    expect(invoiceListQuerySchema.parse({ status: "bogus", page: "-4", pageSize: "13", org: "nope", from: "yesterday" })).toEqual({ q: "", status: "all", org: "", from: "", to: "", page: 1, pageSize: 20 });
    expect(paymentListQuerySchema.parse({ refundRequired: "maybe" }).refundRequired).toBe("");
    expect(paymentListQuerySchema.parse({ refundRequired: "true", status: "failed" })).toMatchObject({ refundRequired: "true", status: "failed" });
  });
  it("defaults the limits list to the tenants that need attention, and can show everyone", () => {
    expect(limitsQuerySchema.parse({}).filter).toBe("attention");
    expect(limitsQuerySchema.parse({ filter: "every" }).filter).toBe("every");
    expect(limitsQuerySchema.parse({ filter: "all" }).filter).toBe("attention"); // "all" is dropped from addresses by the list filter, so it is not a value
  });
});

describe("display helpers", () => {
  it("shows amounts per currency, and nothing as a dash, never as a zero", () => {
    expect(moneyList([])).toBe("—");
    expect(moneyList([{ currency: "INR", amountMinor: 120000 }])).toContain("1,200.00");
    expect(moneyList([{ currency: "INR", amountMinor: 100 }, { currency: "USD", amountMinor: 250 }])).toContain(" + ");
  });
  it("says how often and how long in plain words", () => {
    expect(everyText(5)).toBe("5 minutes");
    expect(everyText(60)).toBe("hour");
    expect(everyText(24 * 60)).toBe("day");
    expect(everyText(120)).toBe("2 hours");
    expect(uptimeText(30)).toBe("30 seconds");
    expect(uptimeText(600)).toBe("10 minutes");
    expect(uptimeText(7200)).toBe("2 hours");
    expect(uptimeText(3 * 86_400)).toBe("3 days");
    expect(plural(1, "tenant")).toBe("1 tenant");
    expect(plural(2, "tenant")).toBe("2 tenants");
  });
});
