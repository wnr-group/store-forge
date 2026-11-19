import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime } from "@/lib/format-date";

// 19:00 UTC on 5 Nov is already 00:30 on 6 Nov in India (UTC+05:30), and still 5 Nov in New York (UTC-05:00).
const lateEvening = new Date("2026-11-05T19:00:00Z");

describe("formatDate", () => {
  it("shows the store's calendar day, not the server's", () => {
    expect(formatDate(lateEvening, "UTC")).toBe("5 Nov 2026");
    expect(formatDate(lateEvening, "Asia/Kolkata")).toBe("6 Nov 2026");
    expect(formatDate(lateEvening, "America/New_York")).toBe("5 Nov 2026");
  });

  it("moves across the IST/UTC day boundary exactly at 18:30 UTC", () => {
    expect(formatDate(new Date("2026-11-05T18:29:59Z"), "Asia/Kolkata")).toBe("5 Nov 2026");
    expect(formatDate(new Date("2026-11-05T18:30:00Z"), "Asia/Kolkata")).toBe("6 Nov 2026");
  });

  it("keeps the existing en-IN output format", () => {
    const legacy = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
    expect(formatDate(lateEvening, "UTC")).toBe(legacy.format(lateEvening));
    expect(formatDate(new Date("2026-01-09T00:00:00Z"), "UTC")).toBe("9 Jan 2026");
  });

  it("falls back to UTC for an unknown timezone instead of throwing", () => {
    expect(() => formatDate(lateEvening, "Mars/Olympus_Mons")).not.toThrow();
    expect(formatDate(lateEvening, "Mars/Olympus_Mons")).toBe(formatDate(lateEvening, "UTC"));
    expect(formatDate(lateEvening, "")).toBe(formatDate(lateEvening, "UTC"));
  });
});

describe("formatDateTime", () => {
  it("shows the store's local time and day", () => {
    expect(formatDateTime(lateEvening, "UTC")).toMatch(/^5 Nov, 7:00 pm$/);
    expect(formatDateTime(lateEvening, "Asia/Kolkata")).toMatch(/^6 Nov, 12:30 am$/);
  });

  it("keeps the existing en-IN output format (no year, 12-hour clock)", () => {
    const legacy = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
    expect(formatDateTime(lateEvening, "Asia/Kolkata")).toBe(legacy.format(lateEvening));
  });

  it("falls back to UTC for an unknown timezone instead of throwing", () => {
    expect(formatDateTime(lateEvening, "Not/AZone")).toBe(formatDateTime(lateEvening, "UTC"));
  });
});

describe("invalid dates", () => {
  it("throw RangeError exactly like the Intl formatters they replaced (no caller passes an invalid Date)", () => {
    expect(() => formatDate(new Date(NaN), "UTC")).toThrow(RangeError);
    expect(() => formatDateTime(new Date(NaN), "UTC")).toThrow(RangeError);
  });
});
