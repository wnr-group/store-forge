import "server-only";
import Papa from "papaparse";
import { readSheet } from "read-excel-file/node";
import type { CatalogImportLevelRow, CatalogImportRow } from "@/lib/catalog/types";
import { CATALOG_LIMITS } from "@/lib/catalog/types";
import { CATALOG_FILE_LIMITS, CATALOG_ITEM_COLUMNS, CATALOG_LEVEL_COLUMNS, LEVELS_SHEET_NAME, isItemColumn } from "./catalog-columns";
import { scanFirstSheet, scanSheetAt, sheetNames, SheetScanError, type FormulaFinding, type SheetScan } from "./formula-scan";
import { LIMITS } from "./product-columns";
import { inspectXlsxZip } from "./zip-guard";

/**
 * Reads a catalog file (CSV or Excel) into the rows the API's `POST /catalog/import` takes. Nothing is saved here and nothing is
 * decided here either: the API validates every row against the database. This only reads the file safely (type, size, zip guard,
 * formula cells, sparse sheets) and turns cells into text.
 *
 * Items: the first sheet of an .xlsx file, or the CSV. Levels (optional): a sheet named "Levels" in the workbook, or a second file.
 */

export type CatalogFileError = { code: "type" | "size" | "empty" | "headers" | "rows" | "payload" | "unreadable" | "xlsx-guard" | "levels"; message: string };
export type CatalogParseOutcome =
  | { ok: true; rows: CatalogImportRow[]; levels: CatalogImportLevelRow[] | null; /** The deepest `level_N` column the file has. */ depth: number }
  | { ok: false; errors: CatalogFileError[] };

const fail = (code: CatalogFileError["code"], message: string): { ok: false; errors: CatalogFileError[] } => ({ ok: false, errors: [{ code, message }] });
const CSV_TYPES = new Set(["", "text/csv", "text/plain", "application/vnd.ms-excel"]);
const XLSX_TYPES = new Set(["", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/octet-stream"]);
const UNCACHED = "This cell contains a formula with no stored value. Paste it as a value and upload again.";
const FORMULA_ERROR = "This cell contains a formula error. Fix or replace it and upload again.";
const TOO_BIG = "The file is larger than 1 MB. Split it into smaller files.";

function cellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

type Grid = { cells: unknown[][]; formulas: FormulaFinding[]; xlsx: Buffer | null };
type Read = { ok: true; grid: Grid } | { ok: false; errors: CatalogFileError[] };

/** The file's first sheet (or CSV) as a grid of cells, after every size and safety check. */
async function readFirst(file: File): Promise<Read> {
  const ext = file.name.toLowerCase().match(/\.[^.]+$/)?.[0] ?? "";
  if (ext === ".xls") return fail("type", "Legacy .xls files are not supported. Save the file as .xlsx or CSV and upload it again.");
  if (ext !== ".csv" && ext !== ".xlsx") return fail("type", "Upload a .csv or .xlsx file.");
  if (!(ext === ".csv" ? CSV_TYPES : XLSX_TYPES).has(file.type)) return fail("type", `This file's type (${file.type}) does not match ${ext}. Upload a real ${ext} file.`);
  if (file.size > CATALOG_FILE_LIMITS.fileBytes) return fail("size", TOO_BIG);
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > CATALOG_FILE_LIMITS.fileBytes) return fail("size", TOO_BIG);
  try {
    if (ext === ".csv") {
      const parsed = Papa.parse<string[]>(buf.toString("utf8").replace(/^\uFEFF/, ""), { skipEmptyLines: false });
      if (parsed.errors.some((e) => e.type === "Quotes")) return fail("unreadable", "The CSV file is malformed (an unclosed quote). Fix it and upload again.");
      return { ok: true, grid: { cells: parsed.data, formulas: [], xlsx: null } };
    }
    const verdict = inspectXlsxZip(buf);
    if (!verdict.ok) return fail("xlsx-guard", verdict.reason);
    const scan = scanFirstSheet(buf); // throws for anything it cannot scan: never "no formulas" by default
    const tooWide = sheetLimit(scan);
    if (tooWide) return fail("xlsx-guard", tooWide);
    return { ok: true, grid: { cells: (await readSheet(buf)) as unknown[][], formulas: scan.formulas, xlsx: buf } };
  } catch (e) {
    return unreadable(e);
  }
}

function sheetLimit(scan: SheetScan): string | null {
  // The sheet reader expands every missing row between the first and last populated row, so a tiny file with one far cell is refused first.
  if (scan.maxRow > LIMITS.sheetRows || scan.maxCol > LIMITS.sheetCols) {
    return `This sheet has data as far as row ${scan.maxRow}, column ${scan.maxCol}. Imports can use at most ${LIMITS.sheetRows.toLocaleString("en-US")} rows and ${LIMITS.sheetCols} columns. Remove unused rows and columns, or export a CSV.`;
  }
  return null;
}

function unreadable(e: unknown): { ok: false; errors: CatalogFileError[] } {
  if (e instanceof RangeError) return fail("xlsx-guard", "This .xlsx file expands to too much data. Remove unused rows and columns, or export a CSV.");
  if (e instanceof SheetScanError) return fail("unreadable", "The file could not be read. Check that it is a valid file and upload it again.");
  return fail("unreadable", "The file could not be read. Check that it is a valid file and upload it again.");
}

/** The sheet named "Levels" of a workbook, as a grid; null when there is none. A "Levels" sheet in first place is refused (the items go there). */
async function readLevelsSheet(buf: Buffer): Promise<{ ok: true; grid: Grid | null } | { ok: false; errors: CatalogFileError[] }> {
  let names: string[];
  try {
    names = sheetNames(buf);
  } catch (e) {
    return unreadable(e);
  }
  const index = names.findIndex((n) => n.trim().toLowerCase() === LEVELS_SHEET_NAME.toLowerCase());
  if (index < 0) return { ok: true, grid: null };
  if (index === 0) return fail("levels", `The "${LEVELS_SHEET_NAME}" sheet has to come after the items sheet: the items are read from the first sheet.`);
  try {
    const scan = scanSheetAt(buf, index);
    const tooWide = sheetLimit(scan);
    if (tooWide) return fail("xlsx-guard", `The "${LEVELS_SHEET_NAME}" sheet: ${tooWide}`);
    return { ok: true, grid: { cells: (await readSheet(buf, index + 1)) as unknown[][], formulas: scan.formulas, xlsx: buf } };
  } catch (e) {
    return unreadable(e);
  }
}

const headerOf = (cells: unknown[]) => {
  const header = (cells ?? []).map((h) => cellText(h).replace(/^\uFEFF/, "").trim().toLowerCase());
  while (header.length && header[header.length - 1] === "") header.pop();
  return header;
};

/** Rows of a grid as `{ row, column: text }` records (the header is row 1); blank cells and blank rows are left out; formula cells that read as blank become `source_errors`. */
function recordsOf(grid: Grid, header: string[]): (Record<string, unknown> & { row: number; source_errors?: { column: string; message: string }[] })[] {
  const rows: (Record<string, unknown> & { row: number; source_errors?: { column: string; message: string }[] })[] = [];
  grid.cells.slice(1).forEach((cells, i) => {
    const out: Record<string, unknown> & { row: number } = { row: i + 2 };
    header.forEach((col, c) => {
      if (!col) return;
      const text = cellText(cells?.[c]).trim();
      if (text !== "") out[col] = text;
    });
    if (Object.keys(out).length > 1) rows.push(out);
  });
  const byRow = new Map(rows.map((r) => [r.row, r]));
  for (const f of grid.formulas) {
    const column = header[f.col - 1];
    if (f.row < 2 || !column) continue;
    let target = byRow.get(f.row);
    if (!target) {
      target = { row: f.row };
      byRow.set(f.row, target);
      rows.push(target);
    }
    target.source_errors = [...(target.source_errors ?? []), { column, message: f.kind === "uncached" ? UNCACHED : FORMULA_ERROR }];
  }
  return rows.sort((a, b) => a.row - b.row);
}

function checkHeader(header: string[], isKnown: (h: string) => boolean, allowed: string, required: (h: string[]) => string | null): CatalogFileError[] {
  const problems: string[] = [];
  const dups = header.filter((h, i) => h && header.indexOf(h) !== i);
  if (dups.length) problems.push(`Duplicate columns: ${[...new Set(dups)].join(", ")}.`);
  const unknown = header.filter((h) => h && !isKnown(h));
  if (unknown.length) problems.push(`Unknown columns: ${[...new Set(unknown)].join(", ")}. Allowed columns: ${allowed}.`);
  const missing = required(header);
  if (missing) problems.push(missing);
  return problems.map((message) => ({ code: "headers" as const, message }));
}

function parseLevels(grid: Grid): { ok: true; levels: CatalogImportLevelRow[] } | { ok: false; errors: CatalogFileError[] } {
  const header = headerOf(grid.cells[0] ?? []);
  if (header.length === 0) return fail("levels", "The levels file is empty. Add a header row (name, can_hold_products) and one row per level.");
  const problems = checkHeader(header, (h) => (CATALOG_LEVEL_COLUMNS as readonly string[]).includes(h), CATALOG_LEVEL_COLUMNS.join(", "), (h) => (h.includes("name") ? null : "Missing required column: name."));
  if (problems.length) return { ok: false, errors: problems.map((p) => ({ ...p, code: "levels" as const, message: `Levels: ${p.message}` })) };
  const rows = recordsOf(grid, header);
  if (rows.length === 0) return fail("levels", "The levels file has a header row but no levels.");
  if (rows.length > CATALOG_LIMITS.maxLevels) return fail("levels", `The levels file has ${rows.length} levels. A catalog can have at most ${CATALOG_LIMITS.maxLevels}.`);
  return {
    ok: true,
    levels: rows.map((r) => ({ row: r.row, ...(typeof r.name === "string" ? { name: r.name } : {}), ...(typeof r.can_hold_products === "string" ? { can_hold_products: r.can_hold_products } : {}) })),
  };
}

export async function parseCatalogFile(file: File, levelsFile?: File | null): Promise<CatalogParseOutcome> {
  const items = await readFirst(file);
  if (!items.ok) return items;
  // A workbook whose first sheet is the levels sheet would otherwise be reported as an items sheet with unknown columns.
  if (items.grid.xlsx) {
    let first: string | undefined;
    try {
      first = sheetNames(items.grid.xlsx)[0];
    } catch (e) {
      return unreadable(e);
    }
    if (first?.trim().toLowerCase() === LEVELS_SHEET_NAME.toLowerCase()) return fail("levels", `The "${LEVELS_SHEET_NAME}" sheet has to come after the items sheet: the items are read from the first sheet.`);
  }

  const header = headerOf(items.grid.cells[0] ?? []);
  if (header.length === 0) return fail("empty", "The file is empty. Add a header row and at least one row.");
  const problems = checkHeader(header, isItemColumn, `level_1 ... level_${CATALOG_LIMITS.maxLevels}, ${CATALOG_ITEM_COLUMNS.join(", ")}`, (h) => (h.includes("level_1") ? null : "Missing required column: level_1 (the name of the item on the top level)."));
  if (problems.length) return { ok: false, errors: problems };

  const rows = recordsOf(items.grid, header) as CatalogImportRow[];
  if (rows.length === 0) return fail("empty", "The file has a header row but no rows.");
  if (rows.length > CATALOG_FILE_LIMITS.rows) return fail("rows", `The file has ${rows.length} rows. The limit is ${CATALOG_FILE_LIMITS.rows.toLocaleString("en-US")} rows per file. Split it into smaller files.`);
  if (Buffer.byteLength(JSON.stringify(rows)) > 8_000_000) return fail("payload", "This file contains too much text. Shorten long descriptions or split the file.");

  let levels: CatalogImportLevelRow[] | null = null;
  if (levelsFile) {
    const read = await readFirst(levelsFile);
    if (!read.ok) return { ok: false, errors: read.errors.map((e) => ({ ...e, message: `Levels file: ${e.message}` })) };
    const parsed = parseLevels(read.grid);
    if (!parsed.ok) return parsed;
    levels = parsed.levels;
  } else if (items.grid.xlsx) {
    const sheet = await readLevelsSheet(items.grid.xlsx);
    if (!sheet.ok) return sheet;
    if (sheet.grid) {
      const parsed = parseLevels(sheet.grid);
      if (!parsed.ok) return parsed;
      levels = parsed.levels;
    }
  }

  const depth = header.reduce((d, h) => (h.startsWith("level_") ? Math.max(d, Number(h.slice(6)) || 0) : d), 0);
  return { ok: true, rows, levels, depth };
}
