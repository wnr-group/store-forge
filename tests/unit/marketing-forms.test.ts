import { describe, expect, it } from "vitest";
import {
  bpsToPercentText,
  campaignFormToPayload,
  campaignPayloadSchema,
  discountFormToPayload,
  discountPayloadSchema,
  isoToZonedLocal,
  parseOptionalCount,
  parsePercentToBps,
  zonedLocalToIso,
  type DiscountFormValues,
} from "../../lib/marketing/forms";

const IST = "Asia/Kolkata";
const base: DiscountFormValues = {
  code: " save10 ",
  description: "",
  kind: "percentage",
  value: "10",
  minSubtotal: "",
  maxDiscount: "",
  startsAt: "",
  expiresAt: "",
  usageLimit: "",
  perCustomerLimit: "",
  appliesTo: "all",
  productIds: [],
  collectionIds: [],
  campaignId: "",
  isActive: true,
};
const ctx = { currency: "INR", timeZone: IST, creating: true };

describe("dates in the store's time zone", () => {
  it("turns what the merchant typed into the instant it means", () => {
    expect(zonedLocalToIso("2026-11-24T18:30", IST)).toBe("2026-11-24T13:00:00.000Z");
    expect(zonedLocalToIso("2026-11-24T00:00", IST)).toBe("2026-11-23T18:30:00.000Z");
    expect(zonedLocalToIso("2026-11-24T18:30", "UTC")).toBe("2026-11-24T18:30:00.000Z");
    expect(zonedLocalToIso("2026-07-01T09:00", "America/New_York")).toBe("2026-07-01T13:00:00.000Z");
    expect(zonedLocalToIso("2026-01-01T09:00", "America/New_York")).toBe("2026-01-01T14:00:00.000Z");
  });

  it("round-trips, so editing a code does not move its dates", () => {
    for (const tz of [IST, "UTC", "America/New_York", "Australia/Lord_Howe"])
      for (const local of ["2026-11-24T18:30", "2026-03-08T12:00", "2026-12-31T23:59"]) expect(isoToZonedLocal(zonedLocalToIso(local, tz), tz)).toBe(local);
    expect(isoToZonedLocal(null, IST)).toBe("");
    expect(isoToZonedLocal("garbage", IST)).toBe("");
  });

  it("refuses what is not a real date and time", () => {
    for (const bad of ["", "2026-02-30T10:00", "2026-13-01T10:00", "2026-11-24", "2026-11-24 10:00", "2026-11-24T25:00"]) expect(zonedLocalToIso(bad, IST)).toBeNull();
    expect(zonedLocalToIso("2026-11-24T10:00", "Not/AZone")).toBeNull();
  });
});

describe("percent and counts", () => {
  it("turns percent into basis points with at most two decimals", () => {
    expect(parsePercentToBps("10")).toBe(1000);
    expect(parsePercentToBps("12.5%")).toBe(1250);
    expect(parsePercentToBps("0.01")).toBe(1);
    expect(parsePercentToBps("100")).toBe(10_000);
    for (const bad of ["", "0", "100.01", "101", "-5", "1.234", "ten", "1e2"]) expect(parsePercentToBps(bad)).toBeNull();
    expect(bpsToPercentText(1250)).toBe("12.5");
    expect(bpsToPercentText(1000)).toBe("10");
  });

  it("reads an optional whole number", () => {
    expect(parseOptionalCount("", 100)).toBeNull();
    expect(parseOptionalCount(" 5 ", 100)).toBe(5);
    for (const bad of ["0", "-1", "1.5", "abc", "101", "1000000000000"]) expect(parseOptionalCount(bad, 100)).toBe("invalid");
  });
});

describe("a discount form", () => {
  it("becomes what the API takes: code in capitals, percent in basis points, money in paise, dates as instants", () => {
    const r = discountFormToPayload({ ...base, minSubtotal: "1,500.50", maxDiscount: "250", startsAt: "2026-12-01T00:00", expiresAt: "2026-12-31T23:59", usageLimit: "100", perCustomerLimit: "1", description: "  Winter  " }, ctx);
    expect(r).toEqual({
      ok: true,
      value: {
        code: "SAVE10",
        description: "Winter",
        kind: "percentage",
        value: 1000,
        minSubtotalMinor: 150050,
        maxDiscountMinor: 25000,
        startsAt: "2026-11-30T18:30:00.000Z",
        expiresAt: "2026-12-31T18:29:00.000Z",
        usageLimit: 100,
        perCustomerLimit: 1,
        appliesTo: "all",
        productIds: [],
        collectionIds: [],
        campaignId: null,
        isActive: true,
      },
    });
    expect(discountPayloadSchema.safeParse((r as { value: unknown }).value).success).toBe(true);
  });

  it("takes a fixed amount in rupees, and ignores a maximum that only makes sense for a percentage", () => {
    const r = discountFormToPayload({ ...base, kind: "fixed", value: "250", maxDiscount: "99" }, ctx);
    expect(r).toMatchObject({ ok: true, value: { kind: "fixed", value: 25000, maxDiscountMinor: null } });
  });

  it("names every field that is wrong", () => {
    const r = discountFormToPayload({ ...base, code: "a", value: "150", minSubtotal: "abc", maxDiscount: "-1", startsAt: "2026-12-31T00:00", expiresAt: "2026-12-01T00:00", usageLimit: "0", perCustomerLimit: "x", appliesTo: "products", description: "x".repeat(501) }, ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["code", "description", "expiresAt", "maxDiscount", "minSubtotal", "perCustomerLimit", "productIds", "usageLimit", "value"]);
  });

  it("does not ask for the code again when editing, and keeps only the targets that apply", () => {
    const ok = discountFormToPayload({ ...base, code: "", appliesTo: "collections", collectionIds: ["11111111-1111-4111-8111-111111111111"], productIds: ["22222222-2222-4222-8222-222222222222"] }, { ...ctx, creating: false });
    expect(ok).toMatchObject({ ok: true, value: { appliesTo: "collections", productIds: [], collectionIds: ["11111111-1111-4111-8111-111111111111"] } });
    const none = discountFormToPayload({ ...base, appliesTo: "collections" }, ctx);
    expect(none.ok).toBe(false);
  });

  it("is checked again by the schema the server action uses", () => {
    const bad = { code: "ab", description: null, kind: "percentage", value: 20000, minSubtotalMinor: 0, maxDiscountMinor: null, startsAt: "yesterday", expiresAt: null, usageLimit: 0, perCustomerLimit: null, appliesTo: "all", productIds: ["nope"], collectionIds: [], campaignId: null, isActive: true };
    expect(discountPayloadSchema.safeParse(bad).success).toBe(false);
    expect(discountPayloadSchema.safeParse({ ...bad, code: "OK1", value: 10, startsAt: null, usageLimit: null, productIds: [] }).success).toBe(true);
  });
});

describe("a campaign form", () => {
  const form = { name: " Diwali ", description: "", startsAt: "2026-11-01T00:00", endsAt: "2026-11-15T23:59", productIds: [], collectionIds: [], discountIds: [] };

  it("becomes what the API takes", () => {
    const r = campaignFormToPayload(form, { timeZone: IST });
    expect(r).toMatchObject({ ok: true, value: { name: "Diwali", description: null, startsAt: "2026-10-31T18:30:00.000Z", endsAt: "2026-11-15T18:29:00.000Z" } });
    expect(campaignPayloadSchema.safeParse((r as { value: unknown }).value).success).toBe(true);
  });

  it("refuses an empty name and an end before the start", () => {
    const r = campaignFormToPayload({ ...form, name: " ", endsAt: "2026-10-01T00:00" }, { timeZone: IST });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["endsAt", "name"]);
  });

  it("allows no dates at all", () => {
    expect(campaignFormToPayload({ ...form, startsAt: "", endsAt: "" }, { timeZone: IST })).toMatchObject({ ok: true, value: { startsAt: null, endsAt: null } });
  });
});
