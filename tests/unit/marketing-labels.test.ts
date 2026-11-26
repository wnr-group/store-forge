import { describe, expect, it } from "vitest";
import { CAMPAIGN_PHASE, CART_STATUS, DISCOUNT_STATUS, campaignActions, changeLabel, discountValueLabel, usageLabel } from "../../lib/marketing/labels";

describe("how a discount is worded", () => {
  it("shows a percentage, a capped percentage and a fixed amount", () => {
    expect(discountValueLabel({ kind: "percentage", value: 1000, maxDiscountMinor: null }, "INR")).toBe("10% off");
    expect(discountValueLabel({ kind: "percentage", value: 1250, maxDiscountMinor: null }, "INR")).toBe("12.5% off");
    expect(discountValueLabel({ kind: "percentage", value: 1000, maxDiscountMinor: 25000 }, "INR")).toMatch(/^10% off up to .*250/);
    expect(discountValueLabel({ kind: "fixed", value: 25000, maxDiscountMinor: null }, "INR")).toMatch(/250.* off$/);
  });

  it("shows use against the limit", () => {
    expect(usageLabel(3, 100)).toBe("3 of 100");
    expect(usageLabel(3, null)).toBe("3");
  });
});

describe("statuses are always words, never colour alone", () => {
  it("every status has its own label", () => {
    for (const table of [DISCOUNT_STATUS, CAMPAIGN_PHASE, CART_STATUS]) {
      const labels = Object.values(table).map((s) => s.label);
      expect(new Set(labels).size).toBe(labels.length);
      for (const l of labels) expect(l.length).toBeGreaterThan(2);
    }
  });
});

describe("what a campaign can do next", () => {
  it("offers only the moves the API allows", () => {
    expect(campaignActions("draft").map((a) => a.to)).toEqual(["active"]);
    expect(campaignActions("active").map((a) => a.to)).toEqual(["paused", "completed"]);
    expect(campaignActions("paused").map((a) => a.to)).toEqual(["active", "completed"]);
    expect(campaignActions("completed")).toEqual([]);
  });

  it("marks the final move as destructive so it asks first", () => {
    for (const status of ["active", "paused"] as const) expect(campaignActions(status).find((a) => a.to === "completed")?.destructive).toBe(true);
  });
});

describe("change since the last period", () => {
  it("says up, down, no change, or that there is nothing to compare", () => {
    expect(changeLabel(12.5)).toEqual({ text: "+12.5%", tone: "up" });
    expect(changeLabel(-3)).toEqual({ text: "-3%", tone: "down" });
    expect(changeLabel(0)).toEqual({ text: "No change", tone: "flat" });
    expect(changeLabel(null).tone).toBe("none");
    expect(changeLabel(undefined).tone).toBe("none");
  });
});
