import "server-only";
import Papa from "papaparse";
import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { buildXlsx, type XlsxSheet } from "./xlsx-writer";

/**
 * Turns the pages an export endpoint returns into a downloadable CSV or Excel file. The API already protects text a spreadsheet could
 * run as a formula (a leading apostrophe), and its imports remove that apostrophe again, so the values are written as they come.
 */

export type ExportTable = { columns: string[]; rows: Record<string, string>[] };

/** At most this many pages of 1000 rows are read for one file (100000 rows), so a file can never grow without bound. */
export const MAX_EXPORT_PAGES = 100;

export type ExportPage = ExportTable & { page: number; totalPages: number };

/** Reads page 1, 2, ... until the last page and returns every row. */
export async function collectPages<P extends ExportPage>(read: (page: number) => Promise<P>): Promise<{ first: P; rows: Record<string, string>[] }> {
  const first = await read(1);
  const rows = [...first.rows];
  if (first.totalPages > MAX_EXPORT_PAGES) throw new AppError("VALIDATION", "This export is too large for one file. Narrow it down and try again.");
  for (let page = 2; page <= first.totalPages; page++) rows.push(...(await read(page)).rows);
  return { first, rows };
}

export const tableToRows = (t: ExportTable): string[][] => [t.columns, ...t.rows.map((r) => t.columns.map((c) => r[c] ?? ""))];

/** CSV with a byte-order mark, so Excel reads accents and non-Latin names correctly. */
export const toCsv = (t: ExportTable): string => `\uFEFF${Papa.unparse(tableToRows(t), { newline: "\r\n" })}\r\n`;

const safeName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "export";

export function fileResponse(format: "csv" | "xlsx", baseName: string, sheets: { name: string; table: ExportTable }[]): NextResponse {
  const name = safeName(baseName);
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  if (format === "csv") {
    return new NextResponse(toCsv(sheets[0].table), { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}.csv"` } });
  }
  const book: XlsxSheet[] = sheets.map((s) => ({ name: s.name, rows: tableToRows(s.table) }));
  return new NextResponse(new Uint8Array(buildXlsx(book)), {
    headers: { ...headers, "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${name}.xlsx"` },
  });
}
