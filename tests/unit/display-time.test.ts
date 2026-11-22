import { describe, expect, it } from "vitest";
import { isKnownTimeZone, utcIsoToZonedLocal, zonedLocalToUtcIso } from "@/lib/themes/editor/display-time";
import { parseInstant } from "@/lib/templates/display-rules";

describe("store time zone converter", () => {
  it("converts a wall time to a UTC instant for zones with and without daylight saving", () => {
    expect(zonedLocalToUtcIso("2026-06-15T09:00", "UTC")).toBe("2026-06-15T09:00:00Z");
    expect(zonedLocalToUtcIso("2026-06-15T09:00", "Asia/Kolkata")).toBe("2026-06-15T03:30:00Z");
    expect(zonedLocalToUtcIso("2026-01-15T09:00", "America/New_York")).toBe("2026-01-15T14:00:00Z");
    expect(zonedLocalToUtcIso("2026-07-15T09:00", "America/New_York")).toBe("2026-07-15T13:00:00Z");
    expect(zonedLocalToUtcIso("2026-12-31T23:59", "Pacific/Auckland")).toBe("2026-12-31T10:59:00Z");
  });

  it("produces instants the display rules schema accepts", () => {
    expect(parseInstant(zonedLocalToUtcIso("2026-06-15T09:00", "Asia/Kolkata"))).not.toBeNull();
  });

  it("round-trips back to the same wall time", () => {
    for (const [local, zone] of [["2026-06-15T09:00", "Asia/Kolkata"], ["2026-11-02T00:00", "America/New_York"], ["2026-03-29T12:15", "Europe/London"]] as const) {
      const iso = zonedLocalToUtcIso(local, zone)!;
      expect(utcIsoToZonedLocal(iso, zone)).toBe(local);
    }
  });

  it("rejects a wall time that the clock skips, and picks the first of a repeated one", () => {
    expect(zonedLocalToUtcIso("2026-03-08T02:30", "America/New_York")).toBeNull();
    // 1:30 happens twice on 1 November 2026 in New York; the earlier one is still daylight time (UTC-4).
    expect(zonedLocalToUtcIso("2026-11-01T01:30", "America/New_York")).toBe("2026-11-01T05:30:00Z");
  });

  it("rejects unreadable input and unknown zones instead of guessing", () => {
    expect(zonedLocalToUtcIso("", "UTC")).toBeNull();
    expect(zonedLocalToUtcIso("2026-02-31T10:00", "UTC")).toBeNull();
    expect(zonedLocalToUtcIso("2026-06-15T25:00", "UTC")).toBeNull();
    expect(zonedLocalToUtcIso("2026-06-15T09:00", "Not/AZone")).toBeNull();
    expect(utcIsoToZonedLocal("garbage", "UTC")).toBeNull();
    expect(utcIsoToZonedLocal("2026-06-15T09:00:00Z", "Not/AZone")).toBeNull();
    expect(isKnownTimeZone("Asia/Kolkata")).toBe(true);
    expect(isKnownTimeZone("Nope")).toBe(false);
  });
});
