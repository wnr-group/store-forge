import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import type { PublicPlanApi } from "@/lib/api/endpoints/platform-api";

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
  return renderToStaticMarkup(PricingPlans({ plans }) as React.ReactElement);
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

  it("has no buttons or links, because nothing can be bought here", async () => {
    const html = await render([plan(), plan({ code: "pro", name: "Pro" })]);
    expect(html).not.toMatch(/<(button|a|form|input)[\s>]/);
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
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    plansApi.mockRejectedValue(new AppError("UNKNOWN", "down"));
    const { getPublicPlans } = await import("@/services/public-plans.service");
    await expect(getPublicPlans()).resolves.toEqual([]);
    error.mockRestore();
  });
});
