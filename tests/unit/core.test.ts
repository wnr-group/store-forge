import { describe, expect, it } from "vitest";
import { assignableRoles, can, canManageMembers, canManageStore, canManageTenant, canViewDashboard, isRole } from "@/lib/auth/permissions";
import { resolveActiveTenant } from "@/lib/tenant/resolve";
import { safeNextPath } from "@/lib/utils/redirect";
import { slugify } from "@/lib/utils/slug";
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from "@/lib/validations/auth";
import { onboardingSchema } from "@/lib/validations/onboarding";

describe("RBAC", () => {
  it("owner and admin manage; staff only views", () => {
    for (const role of ["owner", "admin"] as const) {
      expect(canManageStore(role)).toBe(true);
      expect(canManageTenant(role)).toBe(true);
      expect(canManageMembers(role)).toBe(true);
    }
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

  it("owner role is never assignable; admins can only assign staff", () => {
    expect(assignableRoles("owner")).toEqual(["admin", "staff"]);
    expect(assignableRoles("admin")).toEqual(["staff"]);
    expect(assignableRoles("staff")).toEqual([]);
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
  const valid = { fullName: "Jane Doe", email: " Jane@Example.COM ", password: "hunter22x", confirmPassword: "hunter22x", acceptTerms: true };

  it("accepts a valid registration and normalises email", () => {
    const r = registerSchema.safeParse(valid);
    expect(r.success && r.data.email).toBe("jane@example.com");
  });

  it("rejects mismatched passwords", () => {
    const r = registerSchema.safeParse({ ...valid, confirmPassword: "different1" });
    expect(r.success).toBe(false);
    expect(!r.success && r.error.issues[0].path).toEqual(["confirmPassword"]);
  });

  it.each(["short1", "allletters", "12345678"])("rejects weak password %s", (password) => {
    expect(registerSchema.safeParse({ ...valid, password, confirmPassword: password }).success).toBe(false);
  });

  it("requires terms acceptance", () => {
    expect(registerSchema.safeParse({ ...valid, acceptTerms: false }).success).toBe(false);
  });

  it("validates login, forgot and reset payloads", () => {
    expect(loginSchema.safeParse({ email: "nope", password: "x" }).success).toBe(false);
    expect(forgotPasswordSchema.safeParse({ email: "a@b.co" }).success).toBe(true);
    expect(resetPasswordSchema.safeParse({ password: "abcdefg1", confirmPassword: "abcdefg2" }).success).toBe(false);
  });
});

describe("onboarding validation", () => {
  const base = { businessName: "Acme", storeName: "Acme Store", storeSlug: "acme-store" };

  it("accepts valid input and lowercases the slug", () => {
    const r = onboardingSchema.safeParse({ ...base, storeSlug: " Acme-Store " });
    expect(r.success && r.data.storeSlug).toBe("acme-store");
  });

  it.each(["ab", "-acme", "acme-", "ac me", "acme--store", "admin", "www", "a_b_c"])("rejects slug %s", (storeSlug) => {
    expect(onboardingSchema.safeParse({ ...base, storeSlug }).success).toBe(false);
  });

  it("rejects over-long descriptions", () => {
    expect(onboardingSchema.safeParse({ ...base, description: "x".repeat(501) }).success).toBe(false);
  });
});
