import { describe, expect, it } from "vitest";
import { ADMIN_NAV_ITEMS } from "@/components/dashboard/nav-config";
import { ADMIN_NAV_PERMISSION, PLATFORM_LEVELS, PLATFORM_LEVEL_DESCRIPTIONS, PLATFORM_LEVEL_LABELS, PLATFORM_PERMISSIONS, hiddenAdminHrefs } from "@/lib/platform/roles";
import { PLATFORM_ADMIN_ROLES } from "@/lib/domain/enums";

/** What the API reports for each role (`GET /platform/me`); the menu is derived from it, never from the role name. */
const PERMISSIONS = {
  super_admin: [...PLATFORM_PERMISSIONS],
  admin: PLATFORM_PERMISSIONS.filter((p) => !["admins:manage", "settings:manage", "billing:manage"].includes(p)),
  billing_admin: ["tenants:read", "plans:read", "subscriptions:read", "usage:read", "billing:read", "billing:manage", "settings:read"],
  support_admin: ["tenants:read", "subscriptions:read", "usage:read", "settings:read"],
} as const;

describe("platform roles", () => {
  it("names every role the API has, once, with a label and a description", () => {
    expect([...PLATFORM_LEVELS].sort()).toEqual([...PLATFORM_ADMIN_ROLES].sort());
    for (const level of PLATFORM_LEVELS) {
      expect(PLATFORM_LEVEL_LABELS[level]).toBeTruthy();
      expect(PLATFORM_LEVEL_DESCRIPTIONS[level].length).toBeGreaterThan(20);
    }
  });

  it("only ever asks about menu entries that exist", () => {
    const hrefs = new Set(ADMIN_NAV_ITEMS.map((i) => i.href));
    for (const href of Object.keys(ADMIN_NAV_PERMISSION)) expect(hrefs.has(href), href).toBe(true);
  });

  it("shows a super admin the whole menu", () => {
    expect(hiddenAdminHrefs(PERMISSIONS.super_admin)).toEqual([]);
  });

  it("hides what a Platform Admin cannot open, and nothing else", () => {
    expect(hiddenAdminHrefs(PERMISSIONS.admin)).toEqual([]); // reads billing, audit and monitoring; only their changes are withheld
  });

  it("shows a Billing Admin tenants, plans, usage and billing, and not the audit log, monitoring or administrators", () => {
    const hidden = hiddenAdminHrefs(PERMISSIONS.billing_admin);
    expect(hidden).toEqual(expect.arrayContaining(["/admin/activity", "/admin/monitoring", "/admin/team"]));
    for (const open of ["/admin/billing", "/admin/organizations", "/admin/plans", "/admin/usage", "/admin/limits", "/admin/settings"]) expect(hidden).not.toContain(open);
  });

  it("shows Support the tenant, usage and settings screens, and nothing commercial or administrative", () => {
    const hidden = hiddenAdminHrefs(PERMISSIONS.support_admin);
    for (const closed of ["/admin/billing", "/admin/plans", "/admin/entitlements", "/admin/team", "/admin/activity", "/admin/monitoring"]) expect(hidden, closed).toContain(closed);
    for (const open of ["/admin/organizations", "/admin/usage", "/admin/limits", "/admin/settings"]) expect(hidden).not.toContain(open);
  });

  it("hides every guarded entry from a person with no permissions at all", () => {
    expect(hiddenAdminHrefs([]).sort()).toEqual(Object.keys(ADMIN_NAV_PERMISSION).sort());
  });

  it("lists the sections of the brief in the menu", () => {
    const labels = ADMIN_NAV_ITEMS.map((i) => i.label);
    for (const wanted of ["Overview", "Organizations", "Subscription Plans", "Usage & Limits", "Feature Entitlements", "Billing & Invoices", "Platform Administrators", "Audit Logs", "System Monitoring"])
      expect(labels).toContain(wanted);
  });
});

describe("where platform staff land after sign-in", () => {
  it("sends every platform role with no workspace to the admin area, and nobody else", async () => {
    const { defaultHomePath, identityFromLogin } = await import("@/lib/auth/home");
    for (const level of PLATFORM_LEVELS) {
      const id = identityFromLogin({ platformAdminLevel: level, memberships: [] });
      expect(defaultHomePath(id), level).toBe("/admin");
    }
    expect(defaultHomePath(identityFromLogin({ platformAdminLevel: null, memberships: [] }))).toBe("/dashboard");
    expect(defaultHomePath(identityFromLogin({ platformAdminLevel: "billing_admin", memberships: [{}] }))).toBe("/dashboard");
  });
});
