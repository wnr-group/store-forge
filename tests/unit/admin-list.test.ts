import { describe, expect, it } from "vitest";
import { AUDIT_ACTIONS } from "@/lib/admin/audit";
import { ADMIN_PAGE_SIZES, auditListQuerySchema, orgListQuerySchema } from "@/lib/validations/admin-list";

describe("organization list query (from the URL)", () => {
  it("has sensible defaults", () => {
    expect(orgListQuerySchema.parse({})).toEqual({ q: "", status: "all", sort: "created", dir: "desc", page: 1, pageSize: 20 });
  });

  it("accepts the page sizes the UI offers and nothing else", () => {
    for (const n of ADMIN_PAGE_SIZES) expect(orgListQuerySchema.parse({ pageSize: String(n) }).pageSize).toBe(n);
    for (const bad of ["7", "0", "-10", "1000", "abc", ""]) expect(orgListQuerySchema.parse({ pageSize: bad }).pageSize, bad).toBe(20);
  });

  it("falls back instead of failing on bad input", () => {
    const q = orgListQuerySchema.parse({ status: "deleted", sort: "owner", dir: "sideways", page: "-3" });
    expect(q).toMatchObject({ status: "all", sort: "created", dir: "desc", page: 1 });
    expect(orgListQuerySchema.parse({ page: "abc" }).page).toBe(1);
    expect(orgListQuerySchema.parse({ page: "2.5" }).page).toBe(1);
  });

  it("keeps valid filters, trims the search and caps its length", () => {
    expect(orgListQuerySchema.parse({ q: "  acme  ", status: "suspended", sort: "name", dir: "asc", page: "3", pageSize: "50" })).toEqual({ q: "acme", status: "suspended", sort: "name", dir: "asc", page: 3, pageSize: 50 });
    expect(orgListQuerySchema.parse({ q: "x".repeat(500) }).q).toBe("");
  });
});

describe("audit list query (from the URL)", () => {
  const id = "3f2b1c9e-8a4d-4c1e-9f6a-2b7d5e8c1a40";

  it("has sensible defaults", () => {
    expect(auditListQuerySchema.parse({})).toEqual({ action: "all", entity: "all", admin: "all", org: "", q: "", from: "", to: "", page: 1, pageSize: 20 });
  });

  it("accepts only known actions, uuids and real dates", () => {
    for (const a of AUDIT_ACTIONS) expect(auditListQuerySchema.parse({ action: a }).action).toBe(a);
    expect(auditListQuerySchema.parse({ action: "organization.vaporised" }).action).toBe("all");
    expect(auditListQuerySchema.parse({ admin: id, org: id }).admin).toBe(id);
    expect(auditListQuerySchema.parse({ admin: "not-a-uuid", org: "'; drop table x;--" })).toMatchObject({ admin: "all", org: "" });
    expect(auditListQuerySchema.parse({ from: "2026-11-01", to: "2026-11-09" })).toMatchObject({ from: "2026-11-01", to: "2026-11-09" });
    for (const bad of ["2026-13-45", "yesterday", "2026-1-1", "2026-11-01T00:00:00Z"]) expect(auditListQuerySchema.parse({ from: bad }).from, bad).toBe("");
  });
});
