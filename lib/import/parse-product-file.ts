import "server-only";
import Papa from "papaparse";
import { readSheet } from "read-excel-file/node";
import { findBlankLookingFormulaCells, type FormulaFinding } from "./formula-scan";
import { ALL_COLUMNS, LIMITS, REQUIRED_COLUMNS, type ImportColumn } from "./product-columns";
import { inspectXlsxZip } from "./zip-guard";

export type FileError = { code: "type" | "size" | "empty" | "headers" | "rows" | "payload" | "unreadable" | "xlsx-guard"; message: string };
export type WireRow = { row: number; source_errors?: { column: string; message: string }[] } & Partial<Record<ImportColumn, string>>;
export type ParseOutcome = { ok: true; rows: WireRow[] } | { ok: false; errors: FileError[] };

const fail = (code: FileError["code"], message: string): ParseOutcome => ({ ok: false, errors: [{ code, message }] });
const CSV_TYPES = new Set(["", "text/csv", "text/plain", "application/vnd.ms-excel"]);
const XLSX_TYPES = new Set(["", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/octet-stream"]);
const UNCACHED = "This cell contains a formula with no stored value. Paste it as a value and upload again.";
const FORMULA_ERROR = "This cell contains a formula error. Fix or replace it and upload again.";

/** A cell as the text the API validates. Numbers become plain decimal text; blanks become "". */
function cellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

export async function parseProductFile(file: File): Promise<ParseOutcome> {
  const ext = file.name.toLowerCase().match(/\.[^.]+$/)?.[0] ?? "";
  if (ext === ".xls") return fail("type", "Legacy .xls files are not supported. Save the file as .xlsx or CSV and upload it again.");
  if (ext !== ".csv" && ext !== ".xlsx") return fail("type", "Upload a .csv or .xlsx file.");
  if (!(ext === ".csv" ? CSV_TYPES : XLSX_TYPES).has(file.type)) return fail("type", `This file's type (${file.type}) does not match ${ext}. Upload a real ${ext} file.`);
  if (file.size > LIMITS.fileBytes) return fail("size", "The file is larger than 1 MB. Remove unused rows or split it into smaller files.");
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > LIMITS.fileBytes) return fail("size", "The file is larger than 1 MB. Remove unused rows or split it into smaller files.");

  let grid: unknown[][];
  let formulas: FormulaFinding[] = [];
  try {
    if (ext === ".csv") {
      const parsed = Papa.parse<string[]>(buf.toString("utf8").replace(/^\uFEFF/, ""), { skipEmptyLines: false });
      if (parsed.errors.some((e) => e.type === "Quotes")) return fail("unreadable", "The CSV file is malformed (an unclosed quote). Fix it and upload again.");
      grid = parsed.data;
    } else {
      const verdict = inspectXlsxZip(buf);
      if (!verdict.ok) return fail("xlsx-guard", verdict.reason);
      grid = (await readSheet(buf)) as unknown[][];
      formulas = findBlankLookingFormulaCells(buf); // throws for anything it cannot scan: never "no formulas" by default
    }
  } catch (e) {
    if (e instanceof RangeError) return fail("xlsx-guard", "This .xlsx file expands to too much data. Remove unused rows and columns, or export a CSV.");
    return fail("unreadable", "The file could not be read. Check that it is a valid file and upload it again.");
  }

  const header = (grid[0] ?? []).map((h) => cellText(h).replace(/^\uFEFF/, "").trim().toLowerCase());
  while (header.length && header[header.length - 1] === "") header.pop();
  if (header.length === 0) return fail("empty", "The file is empty. Add a header row and at least one product.");
  const known = new Set<string>(ALL_COLUMNS);
  const problems: string[] = [];
  const dups = header.filter((h, i) => h && header.indexOf(h) !== i);
  if (dups.length) problems.push(`Duplicate columns: ${[...new Set(dups)].join(", ")}.`);
  const unknown = header.filter((h) => h && !known.has(h));
  if (unknown.length) problems.push(`Unknown columns: ${[...new Set(unknown)].join(", ")}. Allowed columns: ${ALL_COLUMNS.join(", ")}.`);
  const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length) problems.push(`Missing required columns: ${missing.join(", ")}.`);
  if (problems.length) return { ok: false, errors: problems.map((message) => ({ code: "headers" as const, message })) };

  const rows: WireRow[] = [];
  grid.slice(1).forEach((cells, i) => {
    const out: WireRow = { row: i + 2 };
    header.forEach((col, c) => {
      if (!col) return;
      const text = cellText(cells[c]).trim();
      if (text !== "") out[col as ImportColumn] = text;
    });
    if (Object.keys(out).length > 1) rows.push(out);
  });

  // Formula cells that read as blank become row errors (merged with the API's own validation); the rest of the row is still validated.
  const byRow = new Map(rows.map((r) => [r.row, r]));
  for (const f of formulas) {
    const column = header[f.col - 1];
    if (f.row < 2 || !column) continue; // the header row, or a column without a header (not imported)
    let target = byRow.get(f.row);
    if (!target) {
      target = { row: f.row };
      byRow.set(f.row, target);
      rows.push(target);
    }
    target.source_errors = [...(target.source_errors ?? []), { column, message: f.kind === "uncached" ? UNCACHED : FORMULA_ERROR }];
  }
  rows.sort((a, b) => a.row - b.row);

  if (rows.length === 0) return fail("empty", "The file has a header row but no products.");
  if (rows.length > LIMITS.rows) return fail("rows", `The file has ${rows.length} products. The limit is ${LIMITS.rows} per import. Split it into smaller files.`);
  if (Buffer.byteLength(JSON.stringify(rows)) > LIMITS.payloadBytes) return fail("payload", "This file contains too much text. Shorten long descriptions or split the file into smaller imports.");
  return { ok: true, rows };
}
