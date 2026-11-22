import { describe, expect, it } from "vitest";
import { toAppError } from "@/lib/api/client";
import { AppError, toFailure } from "@/lib/errors";

/**
 * The AppError constructor is shared by two features that each added a fourth parameter: `apiCode` (payments, on main) and
 * `details` (bulk import). The contract is `(code, message, fieldErrors?, apiCode?, details?)`. These tests pin both, so neither feature
 * can silently take the other's position again.
 */
describe("AppError constructor contract", () => {
  it("takes the API machine code as the 4th parameter and structured details as the 5th", () => {
    const e = new AppError("VALIDATION", "m", { a: "x" }, "PRODUCT_IMPORT_INVALID", { kind: "rows", total: 1 });
    expect(e).toMatchObject({ code: "VALIDATION", message: "m", fieldErrors: { a: "x" }, apiCode: "PRODUCT_IMPORT_INVALID", details: { kind: "rows", total: 1 } });
  });
  it("a 4-argument call carries only the machine code (how the payments tests and service build it)", () => {
    const e = new AppError("UNKNOWN", "Something went wrong. Please try again.", undefined, "PAYMENTS_UNAVAILABLE");
    expect(e.apiCode).toBe("PAYMENTS_UNAVAILABLE");
    expect(e.details).toBeUndefined();
  });
});

describe("toAppError keeps both the machine code and the allow-listed details", () => {
  const rows = { total: 1, errors: [{ row: 2, column: "price", message: "m", value: "0" }] };

  it("a payments outage keeps apiCode and has no details", () => {
    const e = toAppError(503, { success: false, message: "internal text", error: { code: "PAYMENTS_UNAVAILABLE" } });
    expect(e.apiCode).toBe("PAYMENTS_UNAVAILABLE");
    expect(e.details).toBeUndefined();
    expect(e.message).not.toContain("internal");
  });
  it("an import failure keeps BOTH the code and the structured rows", () => {
    const e = toAppError(400, { success: false, message: "No products were imported.", error: { code: "PRODUCT_IMPORT_INVALID", details: rows } });
    expect(e.apiCode).toBe("PRODUCT_IMPORT_INVALID");
    expect(e.details).toEqual(rows);
  });
  it("details of any other error code are dropped, the code is still kept", () => {
    const e = toAppError(400, { success: false, message: "bad", error: { code: "SOMETHING_ELSE", details: { secret: "internal" } } });
    expect(e.apiCode).toBe("SOMETHING_ELSE");
    expect(e.details).toBeUndefined();
  });
  it("a response without an error body has neither", () => {
    const e = toAppError(500, null);
    expect(e.apiCode).toBeUndefined();
    expect(e.details).toBeUndefined();
  });
});

describe("what reaches the browser", () => {
  it("exposes details (the import needs them) but never the API machine code", () => {
    const failure = toFailure(new AppError("VALIDATION", "No products were imported.", undefined, "PRODUCT_IMPORT_INVALID", { kind: "file", errors: [] }));
    expect(failure).toEqual({ ok: false, error: "No products were imported.", code: "VALIDATION", fieldErrors: undefined, details: { kind: "file", errors: [] } });
    expect(JSON.stringify(failure)).not.toContain("PRODUCT_IMPORT_INVALID");
  });
});
