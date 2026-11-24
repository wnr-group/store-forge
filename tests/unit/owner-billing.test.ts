import { describe, expect, it } from "vitest";
import { hiddenFeatureHrefs, hiddenNavHrefs, OWNER_NAV_ITEMS, NAV_ITEMS } from "@/components/dashboard/nav-config";
import { ROUTES } from "@/config/app";
import { can, canManageBilling, type Actor } from "@/lib/auth/permissions";
import { bytesText } from "@/lib/billing/format";
import { invoiceIdSchema, myInvoiceListSchema, verifyPaymentSchema } from "@/lib/validations/billing";

const owner: Actor = { role: "owner", permissions: {} };
const staff: Actor = { role: "admin", permissions: { orders: "write", products: "write", settings: "write" } };

describe("owner billing access", () => {
  it("is for the Owner only, however much access a member has", () => {
    expect(canManageBilling(owner)).toBe(true);
    expect(canManageBilling(staff)).toBe(false);
    expect(can(staff, "billing:manage")).toBe(false);
  });
  it("lists Plan & billing in the Owner's menu and not in anyone else's", () => {
    expect(OWNER_NAV_ITEMS.some((i) => i.href === ROUTES.billing)).toBe(true);
    expect(NAV_ITEMS.some((i) => i.href === ROUTES.billing)).toBe(false);
  });
});

describe("menu follows the plan", () => {
  it("hides only the screens whose feature is switched off", () => {
    expect(hiddenFeatureHrefs({ discount_codes: false, marketing_campaigns: true, abandoned_cart_recovery: true, advanced_reports: false }).sort()).toEqual([ROUTES.analytics, ROUTES.discounts].sort());
  });
  it("hides nothing when the plan is unknown or a feature is not mentioned", () => {
    expect(hiddenFeatureHrefs({})).toEqual([]);
    expect(hiddenFeatureHrefs({ multiple_staff: false })).toEqual([]);
  });
  it("keeps the permission-based hiding separate", () => {
    expect(hiddenNavHrefs(owner)).toEqual([]);
  });
});

describe("billing input", () => {
  it("needs a real invoice id", () => {
    expect(invoiceIdSchema.safeParse("0b9c6d1e-5f7a-4c1f-9b36-2f0d3c4e5a6b").success).toBe(true);
    for (const bad of ["", "x", "../etc", 5, null]) expect(invoiceIdSchema.safeParse(bad).success).toBe(false);
  });
  it("needs all three Razorpay values and no amount", () => {
    const ok = { razorpayOrderId: "order_1", razorpayPaymentId: "pay_1", razorpaySignature: "abc" };
    expect(verifyPaymentSchema.safeParse(ok).success).toBe(true);
    for (const k of Object.keys(ok)) expect(verifyPaymentSchema.safeParse({ ...ok, [k]: "" }).success, k).toBe(false);
    expect(Object.keys(verifyPaymentSchema.parse({ ...ok, amount: 1 }))).not.toContain("amount");
  });
  it("falls back to safe list defaults", () => {
    expect(myInvoiceListSchema.parse({ status: "bogus", page: "-3" })).toEqual({ status: "all", page: 1 });
    expect(myInvoiceListSchema.parse({ status: "overdue", page: "2" })).toEqual({ status: "overdue", page: 2 });
  });
  it("prints storage in readable units", () => {
    expect(bytesText(512)).toBe("512 B");
    expect(bytesText(1024)).toBe("1 KB");
    expect(bytesText(1536)).toBe("1.5 KB");
    expect(bytesText(5 * 1024 ** 3)).toBe("5 GB");
  });
});
