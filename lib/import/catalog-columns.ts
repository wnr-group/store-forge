// Client-safe description of the catalog import file (no server-only code: the page builds the template from it).
import type { CatalogImportRow } from "@/lib/catalog/types";
import { CATALOG_LIMITS } from "@/lib/catalog/types";

/** Columns of the items sheet other than `level_N`. They are the API's own (`catalog-import.dto.ts`) and the ones its export writes. */
export const CATALOG_ITEM_COLUMNS = ["status", "description", "position", "product_id", "product_sku", "product_slug", "product_position", "part_number", "product_name"] as const;

/** Columns of the levels sheet. */
export const CATALOG_LEVEL_COLUMNS = ["name", "can_hold_products"] as const;

/** Name of the second sheet of an Excel workbook that carries the levels. */
export const LEVELS_SHEET_NAME = "Levels";

export const CATALOG_FILE_LIMITS = {
  /** Same as the product import: the app's server actions accept a 2 MB body. */
  fileBytes: 1_048_576,
  /** Rows of one file (sent to the API in requests of at most `CATALOG_LIMITS.importRowsPerRequest`). */
  rows: 10_000,
} as const;

export const levelColumn = (n: number) => `level_${n}`;

/** `level_1` ... `level_20`: the API reads that many. */
export const LEVEL_COLUMNS: string[] = Array.from({ length: CATALOG_LIMITS.maxLevels }, (_, i) => levelColumn(i + 1));

/** Whether a header names a column of the items sheet. */
export const isItemColumn = (header: string) => LEVEL_COLUMNS.includes(header) || (CATALOG_ITEM_COLUMNS as readonly string[]).includes(header);

const cell = (raw: string) => (/[",\r\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw);

/**
 * A template for this store: one `level_N` column per level it has (named in an example row after the levels), then the optional
 * columns. The example row is a hint only: a product is placed by `product_sku`, `product_slug` or `product_id`, never by part number.
 */
export function buildCatalogTemplateCsv(levelNames: string[]): string {
  const depth = Math.max(1, levelNames.length);
  const levels = Array.from({ length: depth }, (_, i) => levelColumn(i + 1));
  const header = [...levels, ...CATALOG_ITEM_COLUMNS];
  const example: Record<string, string> = { status: "active", position: "0" };
  levels.forEach((c, i) => (example[c] = levelNames[i] ? `${levelNames[i]} name` : `Item ${i + 1}`));
  return `${header.join(",")}\r\n${header.map((c) => cell(example[c] ?? "")).join(",")}\r\n`;
}

/** The optional levels file: one row per level, top level first. */
export const buildLevelsTemplateCsv = (levelNames: string[]): string =>
  `${CATALOG_LEVEL_COLUMNS.join(",")}\r\n${(levelNames.length ? levelNames : ["Level 1"]).map((n) => `${cell(n)},false`).join("\r\n")}\r\n`;

/** Splits rows into requests: at most `maxRows` rows and about `maxBytes` of JSON each. Every row carries its whole path, so any split is valid. */
export function chunkImportRows(rows: CatalogImportRow[], maxRows: number = CATALOG_LIMITS.importRowsPerRequest, maxBytes: number = CATALOG_LIMITS.importBytesPerRequest): CatalogImportRow[][] {
  const chunks: CatalogImportRow[][] = [];
  let current: CatalogImportRow[] = [];
  let size = 0;
  for (const row of rows) {
    const bytes = JSON.stringify(row).length + 1;
    if (current.length > 0 && (current.length >= maxRows || size + bytes > maxBytes)) {
      chunks.push(current);
      current = [];
      size = 0;
    }
    current.push(row);
    size += bytes;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}
