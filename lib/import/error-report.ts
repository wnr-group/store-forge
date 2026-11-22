// lib/import/error-report.ts
import type { RowErrorView } from "./import-result";

const cell = (raw: string, max = Infinity) => {
  let s = raw.length > max ? raw.slice(0, max) : raw;
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // never let a spreadsheet run imported text as a formula
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export function buildErrorReportCsv(errors: RowErrorView[]): string {
  return ["row,column,message,value", ...errors.map((e) => [String(e.row), cell(e.column), cell(e.message), cell(e.value, 100)].join(","))].join("\r\n") + "\r\n";
}
