// tests/unit/import-error-report.test.ts
import { describe, expect, it } from "vitest";
import { buildErrorReportCsv } from "@/lib/import/error-report";

describe("buildErrorReportCsv", () => {
  it("writes row,column,message,value and escapes formula starters, quotes and commas", () => {
    const csv = buildErrorReportCsv([{ row: 4, column: "name", message: "Bad, value", value: "=HYPERLINK(\"x\")" }, { row: 5, column: "price", message: "m", value: "-5" }, { row: 6, column: "sku", message: "m", value: "@a" }]);
    expect(csv.split("\r\n")[0]).toBe("row,column,message,value");
    expect(csv).toContain('"\'=HYPERLINK(""x"")"');
    expect(csv).toContain("'-5");
    expect(csv).toContain("'@a");
    expect(csv).toContain('"Bad, value"');
  });
  it("truncates values to 100 characters", () => {
    const line = buildErrorReportCsv([{ row: 2, column: "description", message: "m", value: "y".repeat(300) }]).split("\r\n")[1];
    expect(line.endsWith("y".repeat(100))).toBe(true);
  });
});
