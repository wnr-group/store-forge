import { describe, expect, it } from "vitest";
import { AUDIT_ACTIONS, LEGACY_AUDIT_ACTION_LABELS } from "@/lib/admin/audit";
import { resolveSeriesRange } from "@/lib/admin/series";
import { formatBytes } from "@/lib/utils/bytes";
import { INACTIVE_DAY_OPTIONS, usageQuerySchema } from "@/lib/validations/admin-list";
import { addPlatformAdminSchema, platformSettingsSchema, setPlatformAdminRoleSchema } from "@/lib/validations/admin-platform";

const id = "3f2b1c9e-8a4d-4c1e-9f6a-2b7d5e8c1a40";

describe("platform admin schemas", () => {
  const ok = { fullName: "Pat Admin", email: "  Pat@Example.TEST ", password: "initial-pass-1", role: "admin" };

  it("accepts a name, e-mail, password and a level, and normalises the e-mail", () => {
    expect(addPlatformAdminSchema.parse(ok)).toEqual({ fullName: "Pat Admin", email: "pat@example.test", password: "initial-pass-1", role: "admin" });
    expect(addPlatformAdminSchema.parse({ ...ok, role: "super_admin" }).role).toBe("super_admin");
  });

  it("rejects unknown levels, weak passwords and bad e-mails", () => {
    for (const bad of [{ role: "owner" }, { role: "root" }, { role: undefined }, { password: "short1" }, { password: "nodigitshere" }, { email: "nope" }, { fullName: "A" }]) {
      expect(addPlatformAdminSchema.safeParse({ ...ok, ...bad }).success, JSON.stringify(bad)).toBe(false);
    }
  });

  it("changing a level needs a user id and one of the two levels", () => {
    expect(setPlatformAdminRoleSchema.safeParse({ userId: id, role: "super_admin" }).success).toBe(true);
    for (const bad of [{ userId: "x", role: "admin" }, { userId: id, role: "owner" }, { role: "admin" }]) expect(setPlatformAdminRoleSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
  });
});

describe("platform settings schema", () => {
  const ok = { platformName: " Acme ", supportEmail: "", defaultCurrency: "usd", defaultTimezone: "Asia/Kolkata", defaultStoreStatus: "active" };

  it("normalises the values", () => {
    expect(platformSettingsSchema.parse(ok)).toEqual({ platformName: "Acme", supportEmail: null, defaultCurrency: "USD", defaultTimezone: "Asia/Kolkata", defaultStoreStatus: "active" });
  });

  it("rejects bad names, e-mails, currencies, timezones and store statuses", () => {
    for (const bad of [{ platformName: "A" }, { platformName: "x".repeat(61) }, { supportEmail: "nope" }, { defaultCurrency: "US" }, { defaultTimezone: "Mars/Olympus" }, { defaultStoreStatus: "suspended" }, { defaultStoreStatus: "" }]) {
      expect(platformSettingsSchema.safeParse({ ...ok, ...bad }).success, JSON.stringify(bad)).toBe(false);
    }
  });
});

describe("usage query (from the URL)", () => {
  it("has defaults, accepts the offered windows and falls back on anything else", () => {
    expect(usageQuerySchema.parse({})).toMatchObject({ inactive: 30, from: "", to: "", page: 1, pageSize: 20 });
    for (const d of INACTIVE_DAY_OPTIONS) expect(usageQuerySchema.parse({ inactive: String(d) }).inactive).toBe(d);
    for (const bad of ["7", "0", "abc", "-30", "3650"]) expect(usageQuerySchema.parse({ inactive: bad }).inactive, bad).toBe(30);
    expect(usageQuerySchema.parse({ from: "2026-01-01", to: "nope" })).toMatchObject({ from: "2026-01-01", to: "" });
  });
});

describe("chart date range", () => {
  const now = new Date("2026-11-09T15:30:00Z");

  it("defaults to the last 90 days ending today, grouped by week", () => {
    expect(resolveSeriesRange("", "", now)).toEqual({ from: "2026-08-12", to: "2026-11-09", bucket: "week" });
  });

  it("chooses day, week or month so the chart stays readable", () => {
    expect(resolveSeriesRange("2026-11-01", "2026-11-09", now).bucket).toBe("day");
    expect(resolveSeriesRange("2026-09-09", "2026-11-09", now).bucket).toBe("day"); // 62 days
    expect(resolveSeriesRange("2026-09-08", "2026-11-09", now).bucket).toBe("week"); // 63 days
    expect(resolveSeriesRange("2025-12-01", "2026-11-09", now).bucket).toBe("week");
    expect(resolveSeriesRange("2024-01-01", "2026-11-09", now).bucket).toBe("month");
  });

  it("swaps backwards dates and limits the range to about three years", () => {
    expect(resolveSeriesRange("2026-11-09", "2026-11-01", now)).toMatchObject({ from: "2026-11-01", to: "2026-11-09" });
    const long = resolveSeriesRange("2010-01-01", "2026-11-09", now);
    expect(long.to).toBe("2026-11-09");
    expect(long.from).toBe("2023-11-10");
  });

  it("uses a single date as both ends of a one-day range", () => {
    expect(resolveSeriesRange("2026-11-05", "2026-11-05", now)).toEqual({ from: "2026-11-05", to: "2026-11-05", bucket: "day" });
  });
});

describe("byte sizes", () => {
  it("reads naturally", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(formatBytes(250 * 1024 * 1024)).toBe("250 MB");
    expect(formatBytes(3 * 1024 ** 3)).toBe("3.0 GB");
    expect(formatBytes(-1)).toBe("—");
    expect(formatBytes(Number.NaN)).toBe("—");
  });
});

describe("audit actions", () => {
  it("keeps readable labels for removed actions whose old entries remain, and never offers them as filters", () => {
    for (const legacy of ["support_note.created", "support_note.updated", "store.status_changed"]) {
      expect(LEGACY_AUDIT_ACTION_LABELS[legacy], legacy).toMatch(/feature removed/);
      expect(AUDIT_ACTIONS as readonly string[]).not.toContain(legacy);
    }
  });

  it("has a level-change action, and every action looks like entity.verb", () => {
    expect(AUDIT_ACTIONS).toContain("platform_admin.role_changed");
    for (const a of AUDIT_ACTIONS) expect(a, a).toMatch(/^[a-z_]+\.[a-z_]+$/);
  });
});
