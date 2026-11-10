import { describe, expect, it } from "vitest";
import { memberStatusSchema, recoverOwnerSchema, transferOwnershipSchema, updateCompanySchema, updateStoreSchema } from "@/lib/validations/admin-org";

const id = "3f2b1c9e-8a4d-4c1e-9f6a-2b7d5e8c1a40";

describe("edit organization", () => {
  it("trims text and stores empty phone and address as null", () => {
    expect(updateCompanySchema.parse({ companyName: "  Acme Ltd  ", contactPhone: "  ", address: "" })).toEqual({ companyName: "Acme Ltd", contactPhone: null, address: null });
    expect(updateCompanySchema.parse({ companyName: "Acme", contactPhone: "+91 98765 43210", address: " 1 Main St " })).toEqual({ companyName: "Acme", contactPhone: "+91 98765 43210", address: "1 Main St" });
  });

  it("rejects a missing, short or long name, a bad phone and an over-long address", () => {
    for (const bad of [{ companyName: "" }, { companyName: "A" }, { companyName: "x".repeat(81) }, { companyName: "Acme", contactPhone: "abc" }, { companyName: "Acme", contactPhone: "123" }, { companyName: "Acme", address: "x".repeat(301) }]) {
      expect(updateCompanySchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
  });

  it("ignores anything it does not know, such as a slug, status or tenant id from the browser", () => {
    const r = updateCompanySchema.safeParse({ companyName: "Acme", slug: "taken", status: "suspended", id });
    expect(r.success && Object.keys(r.data).sort()).toEqual(["address", "companyName", "contactPhone"]);
  });
});

describe("edit store", () => {
  const ok = { name: "Acme Store", description: "", contactEmail: "", contactPhone: "", currency: "usd", timezone: "Asia/Kolkata" };

  it("normalises the values the merchant settings form would", () => {
    expect(updateStoreSchema.parse(ok)).toEqual({ name: "Acme Store", description: null, contactEmail: null, contactPhone: null, currency: "USD", timezone: "Asia/Kolkata" });
  });

  it("does not accept a store address (slug) or logo from the browser", () => {
    const r = updateStoreSchema.safeParse({ ...ok, slug: "hijack", logoPath: "x/y.png" });
    expect(r.success && Object.keys(r.data).sort()).toEqual(["contactEmail", "contactPhone", "currency", "description", "name", "timezone"]);
  });

  it("rejects bad names, currencies, timezones, e-mails and phones", () => {
    for (const bad of [{ name: "" }, { name: "A" }, { currency: "US" }, { currency: "ZZZ9" }, { timezone: "Mars/Olympus" }, { timezone: "" }, { contactEmail: "nope" }, { contactPhone: "12" }, { description: "x".repeat(501) }]) {
      expect(updateStoreSchema.safeParse({ ...ok, ...bad }).success, JSON.stringify(bad)).toBe(false);
    }
  });
});

describe("member status", () => {
  it("allows only active or disabled for members", () => {
    for (const s of ["active", "disabled"]) expect(memberStatusSchema.safeParse(s).success).toBe(true);
    for (const s of ["removed", "suspended", "owner"]) expect(memberStatusSchema.safeParse(s).success, s).toBe(false);
  });
});

describe("ownership", () => {
  it("transfer needs a member id, and defaults to keeping the old owner", () => {
    expect(transferOwnershipSchema.parse({ userId: id })).toEqual({ userId: id, previousOwner: "keep" });
    expect(transferOwnershipSchema.parse({ userId: id, previousOwner: "disable" }).previousOwner).toBe("disable");
    for (const bad of [{}, { userId: "not-a-uuid" }, { userId: id, previousOwner: "delete" }]) expect(transferOwnershipSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
  });

  it("recovery needs a name, an e-mail and a valid password, and never a role or tenant", () => {
    const ok = { ownerName: "New Owner", ownerEmail: "  New@Owner.TEST ", ownerPassword: "recover-pass-123" };
    expect(recoverOwnerSchema.parse(ok)).toEqual({ ownerName: "New Owner", ownerEmail: "new@owner.test", ownerPassword: "recover-pass-123", previousOwner: "keep" });
    for (const bad of [{ ownerName: "" }, { ownerName: "A" }, { ownerEmail: "nope" }, { ownerPassword: "short1" }, { ownerPassword: "nodigitshere" }]) {
      expect(recoverOwnerSchema.safeParse({ ...ok, ...bad }).success, JSON.stringify(bad)).toBe(false);
    }
    const r = recoverOwnerSchema.safeParse({ ...ok, role: "owner", tenantId: id });
    expect(r.success && Object.keys(r.data).sort()).toEqual(["ownerEmail", "ownerName", "ownerPassword", "previousOwner"]);
  });
});
