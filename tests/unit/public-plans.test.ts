import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import type { PublicPlanApi } from "@/lib/api/endpoints/platform-api";
import { hasYearlyOption, limitValue, priceView, savingsPercent } from "@/components/landing/pricing-utils";

/** The landing page lists the plans a Platform Admin has published, as cards with no way to buy. */

vi.mock("next/cache", () => ({ unstable_cache: <T>(fn: T) => fn, revalidatePath: vi.fn(), revalidateTag: vi.fn(), updateTag: vi.fn() }));
const plansApi = vi.fn();
vi.mock("@/lib/api/endpoints/platform-api", () => ({ getPublicPlansApi: () => plansApi() }));

const plan = (over: Partial<PublicPlanApi> = {}): PublicPlanApi => ({
  code: "starter",
  name: "Starter",
  description: "For small stores",
  currency: "INR",
  monthlyPrice: "499.00",
  monthlyPriceMinor: 49900,
  yearlyPrice: "4990.00",
  yearlyPriceMinor: 499000,
  trialDays: 14,
  features: [{ key: "discount_codes", label: "Discount codes and coupons" }],
  limits: [
    { key: "products", label: "Products", unit: "count", value: 100 },
    { key: "staff_accounts", label: "Staff accounts", unit: "count", value: null },
    { key: "storage_bytes", label: "Storage", unit: "bytes", value: 2 * 1024 ** 3 },
  ],
  ...over,
});

const render = async (plans: PublicPlanApi[]) => {
  const { PricingPlans } = await import("@/components/landing/pricing");
  return renderToStaticMarkup(createElement(PricingPlans, { plans }));
};

beforeEach(() => {
  plansApi.mockReset();
});

describe("plans on the landing page", () => {
  it("shows name, description, prices, trial, included features and limits", async () => {
    const html = await render([plan()]);
    expect(html).toContain('id="plans"');
    for (const text of ["Starter", "For small stores", "₹499", "/ month", "or ₹4,990 a year", "14-day free trial", "Discount codes and coupons", "Products", "100", "Unlimited", "2 GB"])
      expect(html, text).toContain(text);
  });

  it("has nothing to buy: no links, forms or inputs, and no buy-style wording", async () => {
    const html = await render([plan(), plan({ code: "pro", name: "Pro" })]);
    expect(html).not.toMatch(/<(a|form|input)[\s>]/);
    expect(html).not.toMatch(/\b(buy|purchase|subscribe|checkout|get started|choose plan|select plan|sign up)\b/i);
  });

  it("only has controls that change what is shown: the billing period and the full feature list", async () => {
    const many = plan({ features: Array.from({ length: 8 }, (_, i) => ({ key: `f${i}`, label: `Feature ${i}` })) });
    const html = await render([many]);
    const labels = [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map((m) => m[1].replace(/<[^>]+>/g, "").trim());
    expect(labels).toEqual(["Monthly", "YearlySave up to 17%", "Show all 8 features"]);
  });

  it("keeps every feature in the page but hides those past the first five until asked", async () => {
    const many = plan({ features: Array.from({ length: 8 }, (_, i) => ({ key: `f${i}`, label: `Feature ${i}` })) });
    const html = await render([many]);
    for (let i = 0; i < 8; i++) expect(html).toContain(`Feature ${i}`);
    expect(html.match(/<li class="[^"]*\bhidden\b/g)).toHaveLength(3);
  });

  it("offers no billing toggle or expand control when there is nothing to switch", async () => {
    const html = await render([plan({ yearlyPriceMinor: 0 })]);
    expect(html).not.toContain("Billing period");
    expect(html).not.toContain("Show all");
  });

  it("shows Free for a free plan, and leaves out the trial and yearly lines when there are none", async () => {
    const html = await render([plan({ monthlyPriceMinor: 0, yearlyPriceMinor: 0, trialDays: 0, features: [] })]);
    expect(html).toContain("Free");
    expect(html).not.toContain("a year");
    expect(html).not.toContain("free trial");
    expect(html).not.toContain("What&#x27;s included");
  });

  it("keeps the decimals of a price that is not a whole amount", async () => {
    expect(await render([plan({ monthlyPriceMinor: 49950 })])).toContain("₹499.50");
  });

  it("renders nothing when no plan is published", async () => {
    expect(await render([])).toBe("");
  });
});

describe("getPublicPlans", () => {
  it("returns the published plans from the API", async () => {
    plansApi.mockResolvedValue([plan()]);
    const { getPublicPlans } = await import("@/services/public-plans.service");
    await expect(getPublicPlans()).resolves.toEqual([plan()]);
  });

  it("returns an empty list, so the section is left out, when the API cannot be reached", async () => {
    const error = vi.spyOn(console, "warn").mockImplementation(() => {});
    plansApi.mockRejectedValue(new AppError("UNKNOWN", "down"));
    const { getPublicPlans } = await import("@/services/public-plans.service");
    await expect(getPublicPlans()).resolves.toEqual([]);
    error.mockRestore();
  });
});

describe("pricing helpers", () => {
  const p = plan();
  it("shows the monthly price by default and the yearly one with its monthly equivalent", () => {
    expect(priceView(p, "monthly")).toEqual({ free: false, amount: "₹499", per: "/ month", note: "or ₹4,990 a year" });
    expect(priceView(p, "yearly")).toEqual({ free: false, amount: "₹4,990", per: "/ year", note: "₹416 a month, billed yearly" });
  });

  it("keeps the monthly price for a plan with no yearly price, and says Free for a free plan", () => {
    expect(priceView(plan({ yearlyPriceMinor: 0 }), "yearly")).toEqual({ free: false, amount: "₹499", per: "/ month", note: "Billed monthly" });
    expect(priceView(plan({ monthlyPriceMinor: 0, yearlyPriceMinor: 0 }), "yearly")).toMatchObject({ free: true, amount: "Free" });
  });

  it("works out the yearly saving in whole percent, and none when a year costs the same or more", () => {
    expect(savingsPercent(p)).toBe(17);
    expect(savingsPercent(plan({ yearlyPriceMinor: 49900 * 12 }))).toBe(0);
    expect(savingsPercent(plan({ yearlyPriceMinor: 0 }))).toBe(0);
    expect(savingsPercent(plan({ monthlyPriceMinor: 0 }))).toBe(0);
  });

  it("offers a yearly choice only when some plan has both prices", () => {
    expect(hasYearlyOption([p])).toBe(true);
    expect(hasYearlyOption([plan({ yearlyPriceMinor: 0 })])).toBe(false);
  });

  it("writes limits in plain figures", () => {
    expect(limitValue({ key: "storage_bytes", label: "Storage", unit: "bytes", value: 10 * 1024 ** 3 })).toBe("10 GB");
    expect(limitValue({ key: "products", label: "Products", unit: "count", value: 1000 })).toBe("1,000");
    expect(limitValue({ key: "products", label: "Products", unit: "count", value: null })).toBe("Unlimited");
  });
});
