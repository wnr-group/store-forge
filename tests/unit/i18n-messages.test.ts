import { describe, expect, it } from "vitest";
import { MESSAGES, formatCurrency, formatDateTime, isMessageKey, isValidTimeZone, t, tLocale } from "../../lib/i18n/messages";

describe("message catalogue", () => {
  it("uses stable dotted keys and non-empty English text", () => {
    for (const [key, text] of Object.entries(MESSAGES)) {
      expect(key, key).toMatch(/^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9]+)+$/);
      expect(text.length, key).toBeGreaterThan(0);
    }
  });

  it("t fills placeholders and keeps unknown ones visible", () => {
    expect(t("common.count.items", { count: 3 })).toBe("3 items");
    expect(t("common.count.items", { count: 0 })).toBe("0 items");
    expect(t("common.count.items")).toBe("{count} items");
    expect(t("common.count.items", { other: 1 })).toBe("{count} items");
    expect(t("common.count.items", { count: undefined })).toBe("{count} items");
  });

  it("falls back to the key for an unknown key and to English for any locale", () => {
    expect(t("no.such.key")).toBe("no.such.key");
    expect(isMessageKey("common.save")).toBe(true);
    expect(isMessageKey("toString")).toBe(false);
    expect(tLocale("fr-FR", "common.save")).toBe("Save");
  });

  it("does not interpret prototype names or re-expand replacement values", () => {
    expect(t("common.count.items", { count: "{count}" })).toBe("{count} items");
    expect(t("__proto__")).toBe("__proto__");
  });

  it("covers the keys other layers reference", () => {
    for (const key of ["readiness.component.unavailable", "manifest.error.invalid", "display.schedule.label"]) expect(isMessageKey(key)).toBe(true);
  });
});

describe("locale-aware formatting", () => {
  const instant = "2026-03-01T23:30:00Z";

  it("formats the same instant differently by IANA time zone", () => {
    expect(formatDateTime(instant, { timeZone: "UTC", locale: "en-US", style: "date" })).toBe("Mar 1, 2026");
    expect(formatDateTime(instant, { timeZone: "Asia/Kolkata", locale: "en-US", style: "date" })).toBe("Mar 2, 2026");
    expect(formatDateTime(instant, { timeZone: "Asia/Kolkata", locale: "en-US", style: "time" })).toMatch(/5:00\sAM/);
    expect(formatDateTime(instant, { timeZone: "America/New_York", locale: "en-US", style: "time" })).toMatch(/6:30\sPM/);
  });

  it("accepts Date and epoch input and defaults to date and time", () => {
    const out = formatDateTime(new Date(instant), { timeZone: "UTC", locale: "en-US" });
    expect(out).toContain("2026");
    expect(out).toMatch(/11:30\sPM/);
    expect(formatDateTime(Date.parse(instant), { timeZone: "UTC", locale: "en-US", style: "date" })).toBe("Mar 1, 2026");
  });

  it("rejects an invalid zone or instant", () => {
    expect(() => formatDateTime(instant, { timeZone: "Mars/Base" })).toThrow(RangeError);
    expect(() => formatDateTime(instant, { timeZone: "" })).toThrow(RangeError);
    expect(() => formatDateTime("nope", { timeZone: "UTC" })).toThrow(RangeError);
    expect(isValidTimeZone("Europe/London")).toBe(true);
    expect(isValidTimeZone("Nope/Zone")).toBe(false);
    expect(isValidTimeZone(5)).toBe(false);
  });

  it("falls back to English for a malformed locale", () => {
    expect(formatDateTime(instant, { timeZone: "UTC", locale: "not a locale!!", style: "date" })).toBe("Mar 1, 2026");
  });

  it("formats currency by locale", () => {
    expect(formatCurrency(1234.5, "USD", { locale: "en-US" })).toBe("$1,234.50");
    expect(formatCurrency(1234.5, "EUR", { locale: "de-DE" })).toMatch(/1\.234,50\s€/);
    expect(formatCurrency(5, "USD")).toBe("$5.00");
    expect(() => formatCurrency(Number.NaN, "USD")).toThrow(RangeError);
    expect(() => formatCurrency(1, "XX")).toThrow(RangeError);
  });
});
