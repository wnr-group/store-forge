import { describe, expect, it } from "vitest";
import { assignableRoles, can, canManageMembers, canManageStore, canManageTenant, canViewDashboard, isRole, ROLE_LABELS } from "@/lib/auth/permissions";
import { resolveActiveTenant } from "@/lib/tenant/resolve";
import { safeNextPath } from "@/lib/utils/redirect";
import { slugify } from "@/lib/utils/slug";
import { changePasswordSchema, loginSchema, resetPasswordSchema } from "@/lib/validations/auth";
import { createCompanySchema } from "@/lib/validations/company";
import { createMemberSchema, updateMemberSchema } from "@/lib/validations/team";

describe("RBAC", () => {
  it("owner and admin (Manager) manage the store; staff only views; only the owner manages members", () => {
    for (const role of ["owner", "admin"] as const) {
      expect(canManageStore(role)).toBe(true);
      expect(canManageTenant(role)).toBe(true);
    }
    expect(canManageMembers("owner")).toBe(true);
    expect(canManageMembers("admin")).toBe(false);
    expect(canViewDashboard("staff")).toBe(true);
    expect(canManageStore("staff")).toBe(false);
    expect(canManageTenant("staff")).toBe(false);
    expect(canManageMembers("staff")).toBe(false);
  });

  it("only owners can delete stores/tenants", () => {
    expect(can("owner", "store:delete")).toBe(true);
    expect(can("admin", "store:delete")).toBe(false);
    expect(can("admin", "tenant:delete")).toBe(false);
  });

  it("only the owner can assign roles, and never owner; the middle role is labelled Manager", () => {
    expect(assignableRoles("owner")).toEqual(["admin", "staff"]);
    expect(assignableRoles("admin")).toEqual([]);
    expect(assignableRoles("staff")).toEqual([]);
    expect(ROLE_LABELS.admin).toBe("Manager");
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
  const base = { fullName: "Sana Staff", email: "Sana@Acme.com", password: "initial-pass-1", role: "staff" };

  it("accepts manager (stored as admin) and staff only", () => {
    expect(createMemberSchema.safeParse(base).success).toBe(true);
    expect(createMemberSchema.safeParse({ ...base, role: "admin" }).success).toBe(true);
  });

  it.each(["owner", "platform_admin", "superuser", "", undefined])("rejects privileged or unknown role %s", (role) => {
    expect(createMemberSchema.safeParse({ ...base, role }).success).toBe(false);
    expect(updateMemberSchema.safeParse({ userId: "3f2b1c9e-8a4d-4c1e-9f6a-2b7d5e8c1a40", fullName: "Sana Staff", role }).success).toBe(false);
  });

  it("does not accept a tenant id from the browser", () => {
    const r = createMemberSchema.safeParse({ ...base, tenantId: "3f2b1c9e-8a4d-4c1e-9f6a-2b7d5e8c1a40" });
    expect(r.success && "tenantId" in r.data).toBe(false);
  });
});
