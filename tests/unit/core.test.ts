import { describe, expect, it } from "vitest";
import { accessLevel, can, canDeleteCatalog, canManageCatalog, canManageCustomers, canManageMembers, canManageStore, canViewCatalog, canViewCustomers, canViewDashboard, canViewOrders, isRole, MEMBER_ROLE, presetOf, ROLE_LABELS, ROLE_PRESET_KEYS, ROLE_PRESETS, roleLabel, summarizePermissions } from "@/lib/auth/permissions";
import { resolveActiveTenant } from "@/lib/tenant/resolve";
import { safeNextPath } from "@/lib/utils/redirect";
import { slugify } from "@/lib/utils/slug";
import { changePasswordSchema, loginSchema, resetPasswordSchema } from "@/lib/validations/auth";
import { createCompanySchema } from "@/lib/validations/company";
import { createMemberSchema, updateMemberSchema } from "@/lib/validations/team";

const member = (permissions: Record<string, string>) => ({ role: "admin" as const, permissions }) as Parameters<typeof can>[0];
const owner = { role: "owner" as const, permissions: {} };
const reader = member({ products: "read", orders: "read", customers: "read", settings: "read" });
const writer = member({ products: "write", orders: "read", customers: "write", settings: "write" });

describe("access", () => {
  it("the owner can do everything; only the owner manages members and deletes stores/tenants", () => {
    for (const p of ["store:manage", "tenant:manage", "members:manage", "store:delete", "tenant:delete", "catalog:manage", "customers:manage", "orders:view"] as const) {
      expect(can(owner, p), p).toBe(true);
    }
    for (const m of [reader, writer]) {
      expect(canManageMembers(m)).toBe(false);
      expect(can(m, "store:delete")).toBe(false);
      expect(can(m, "tenant:delete")).toBe(false);
      expect(canViewDashboard(m)).toBe(true);
    }
  });

  it("read lets a member look but not change; write includes read", () => {
    expect([canViewCatalog(reader), canManageCatalog(reader), canDeleteCatalog(reader)]).toEqual([true, false, false]);
    expect([canViewCatalog(writer), canManageCatalog(writer), canDeleteCatalog(writer)]).toEqual([true, true, true]);
    expect([canViewCustomers(reader), canManageCustomers(reader)]).toEqual([true, false]);
    expect(canManageStore(reader)).toBe(false);
    expect(canManageStore(writer)).toBe(true);
    expect(canViewOrders(writer)).toBe(true);
  });

  it("no access hides the module; a missing module counts as none, except store settings which stay readable", () => {
    const none = member({ products: "none", orders: "none", customers: "none" });
    expect([canViewCatalog(none), canViewOrders(none), canViewCustomers(none)]).toEqual([false, false, false]);
    expect(accessLevel(none, "settings")).toBe("read");
    expect(canManageStore(none)).toBe(false);
    expect(canViewCatalog(member({}))).toBe(false);
  });

  it("summarises what a member can do", () => {
    expect(summarizePermissions("owner", {})).toBe("Full access");
    expect(summarizePermissions("admin", { products: "write", orders: "none", customers: "read", settings: "read" })).toBe(
      "Products & inventory: Read & write · Customers: Read · Store settings: Read",
    );
  });

  it("a role is a preset of access levels; levels that match no preset show as Custom", () => {
    for (const key of ROLE_PRESET_KEYS) {
      expect(presetOf(ROLE_PRESETS[key].permissions), key).toBe(key);
      expect(roleLabel("admin", ROLE_PRESETS[key].permissions)).toBe(ROLE_PRESETS[key].label);
    }
    expect(presetOf({ ...ROLE_PRESETS.staff.permissions, customers: "read" })).toBe("custom");
    expect(roleLabel("admin", { ...ROLE_PRESETS.staff.permissions, customers: "none" })).toBe("Custom");
    expect(roleLabel("owner", {})).toBe("Owner");
  });

  it("presets never give more than the form allows, and old data maps onto them", () => {
    for (const key of ROLE_PRESET_KEYS) expect(createMemberSchema.safeParse({ fullName: "Aa", email: "a@b.co", password: "initial-pass-1", permissions: ROLE_PRESETS[key].permissions }).success, key).toBe(true);
    // migrated rows may carry orders:write; it counts as read, so a migrated manager still reads as Manager
    expect(presetOf({ products: "write", orders: "write", customers: "write", settings: "write" })).toBe("manager");
    expect(presetOf({})).toBe("custom");
  });

  it("members are stored with the member role and labelled Team member; the owner is never assignable", () => {
    expect(MEMBER_ROLE).toBe("admin");
    expect(ROLE_LABELS.admin).toBe("Team member");
    expect(ROLE_LABELS.owner).toBe("Owner");
  });

  it("rejects unknown role strings", () => {
    expect(isRole("superadmin")).toBe(false);
    expect(isRole("owner")).toBe(true);
  });
});

describe("active tenant resolution", () => {
  const a = { tenant: { id: "a" }, role: "owner" };
  const b = { tenant: { id: "b" }, role: "staff" };

  it("honours a preference that matches a membership (tenant switching)", () => {
    expect(resolveActiveTenant([a, b], "b")).toBe(b);
    expect(resolveActiveTenant([a, b], "a")).toBe(a);
  });

  it("ignores a forged / foreign tenant id and falls back to the first membership", () => {
    expect(resolveActiveTenant([a, b], "someone-elses-tenant")).toBe(a);
    expect(resolveActiveTenant([a, b], undefined)).toBe(a);
  });

  it("returns null when the user has no tenants, even with a cookie", () => {
    expect(resolveActiveTenant([], "a")).toBeNull();
  });
});

describe("safeNextPath (open-redirect protection)", () => {
  it.each([
    ["https://evil.com", "/dashboard"],
    ["//evil.com", "/dashboard"],
    ["/\\evil.com", "/dashboard"],
    ["javascript:alert(1)", "/dashboard"],
    ["", "/dashboard"],
    [null, "/dashboard"],
    ["/dashboard/settings?x=1", "/dashboard/settings?x=1"],
  ])("%s -> %s", (input, expected) => {
    expect(safeNextPath(input as string | null)).toBe(expected);
  });
});

describe("slugify", () => {
  it("normalises names", () => {
    expect(slugify("  Café Déjà Vu!! ")).toBe("cafe-deja-vu");
    expect(slugify("A".repeat(60)).length).toBeLessThanOrEqual(40);
  });
});

describe("auth validation", () => {
  it("validates the login payload and normalises the email", () => {
    expect(loginSchema.safeParse({ email: "nope", password: "x" }).success).toBe(false);
    const r = loginSchema.safeParse({ email: " Jane@Example.COM ", password: "x" });
    expect(r.success && r.data.email).toBe("jane@example.com");
  });

  it.each(["short1", "allletters", "12345678"])("rejects weak password %s", (password) => {
    expect(resetPasswordSchema.safeParse({ password }).success).toBe(false);
  });

  it("change password: confirmation must match and the new password must differ", () => {
    const ok = { currentPassword: "oldpass12", password: "newpass12", confirmPassword: "newpass12" };
    expect(changePasswordSchema.safeParse(ok).success).toBe(true);
    expect(changePasswordSchema.safeParse({ ...ok, confirmPassword: "other123" }).success).toBe(false);
    expect(changePasswordSchema.safeParse({ ...ok, password: "oldpass12", confirmPassword: "oldpass12" }).success).toBe(false);
  });
});

describe("company provisioning validation", () => {
  const base = {
    companyName: "Acme Trading", storeName: "Acme Store", storeSlug: "acme-store",
    ownerName: "Olivia Owner", ownerEmail: " Owner@Acme.COM ", ownerPassword: "initial-pass-1",
  };

  it("accepts valid input, normalises the email and the slug, and nulls empty optionals", () => {
    const r = createCompanySchema.safeParse({ ...base, storeSlug: " Acme-Store ", contactPhone: "", address: "" });
    expect(r.success && r.data).toMatchObject({ ownerEmail: "owner@acme.com", storeSlug: "acme-store", contactPhone: null, address: null });
  });

  it.each(["ab", "-acme", "acme-", "ac me", "acme--store", "admin", "www", "a_b_c"])("rejects slug %s", (storeSlug) => {
    expect(createCompanySchema.safeParse({ ...base, storeSlug }).success).toBe(false);
  });

  it("requires owner details and a policy-compliant password", () => {
    for (const missing of ["companyName", "storeName", "ownerName", "ownerEmail", "ownerPassword"] as const) {
      expect(createCompanySchema.safeParse({ ...base, [missing]: "" }).success, missing).toBe(false);
    }
    expect(createCompanySchema.safeParse({ ...base, ownerPassword: "nodigitshere" }).success).toBe(false);
  });

  it("rejects over-long descriptions", () => {
    expect(createCompanySchema.safeParse({ ...base, storeDescription: "x".repeat(501) }).success).toBe(false);
  });

  it("ignores any role or tenant the browser tries to smuggle in", () => {
    const r = createCompanySchema.safeParse({ ...base, role: "platform_admin", tenantId: "x", ownerId: "y" });
    expect(r.success && Object.keys(r.data)).not.toEqual(expect.arrayContaining(["role", "tenantId", "ownerId"]));
  });
});

describe("team member validation", () => {
  const permissions = { products: "write", orders: "read", customers: "read", settings: "read" };
  const base = { fullName: "Sana Staff", email: "Sana@Acme.com", password: "initial-pass-1", permissions };
  const id = "3f2b1c9e-8a4d-4c1e-9f6a-2b7d5e8c1a40";

  it("accepts a level per module", () => {
    expect(createMemberSchema.safeParse(base).success).toBe(true);
    expect(updateMemberSchema.safeParse({ userId: id, fullName: "Sana Staff", permissions }).success).toBe(true);
    expect(createMemberSchema.safeParse({ ...base, permissions: { products: "none", orders: "none", customers: "none", settings: "read" } }).success).toBe(true);
  });

  it.each([
    ["an unknown level", { ...permissions, products: "admin" }],
    ["write on orders (read-only for now)", { ...permissions, orders: "write" }],
    ["none on store settings (always readable)", { ...permissions, settings: "none" }],
    ["a missing module", { products: "read", orders: "read", customers: "read" }],
    ["no permissions at all", undefined],
  ])("rejects %s", (_label, p) => {
    expect(createMemberSchema.safeParse({ ...base, permissions: p }).success).toBe(false);
    expect(updateMemberSchema.safeParse({ userId: id, fullName: "Sana Staff", permissions: p }).success).toBe(false);
  });

  it.each(["owner", "platform_admin", "superuser"])("never lets the browser choose a role (%s is ignored)", (role) => {
    const r = createMemberSchema.safeParse({ ...base, role });
    expect(r.success && "role" in r.data).toBe(false);
  });

  it("does not accept a tenant id from the browser", () => {
    const r = createMemberSchema.safeParse({ ...base, tenantId: "3f2b1c9e-8a4d-4c1e-9f6a-2b7d5e8c1a40" });
    expect(r.success && "tenantId" in r.data).toBe(false);
  });
});
