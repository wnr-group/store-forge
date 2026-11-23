// lib/import/formula-scan.ts
import "server-only";
import { inflateRawSync } from "node:zlib";
import { LIMITS } from "./product-columns";

export type FormulaFinding = { row: number; col: number; kind: "uncached" | "error" };

/** Thrown for anything structurally wrong; the parser maps it to the "unreadable" file error. Never swallowed as "no formulas". */
export class SheetScanError extends Error {}

type Entry = { method: number; flags: number; data: Buffer };

/** Central-directory entries by name. The caller has already run inspectXlsxZip, but every offset is bounds-checked again. */
function entries(buf: Buffer): Map<string, Entry> {
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new SheetScanError("zip directory not found");
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const out = new Map<string, Entry>();
  for (let n = 0; n < count; n++) {
    if (off + 46 > buf.length || buf.readUInt32LE(off) !== 0x02014b50) throw new SheetScanError("corrupt zip directory");
    const flags = buf.readUInt16LE(off + 8);
    const method = buf.readUInt16LE(off + 10);
    const csize = buf.readUInt32LE(off + 20);
    const nlen = buf.readUInt16LE(off + 28), xlen = buf.readUInt16LE(off + 30), clen = buf.readUInt16LE(off + 32);
    const lho = buf.readUInt32LE(off + 42);
    if (lho + 30 > buf.length || buf.readUInt32LE(lho) !== 0x04034b50) throw new SheetScanError("corrupt local header");
    const start = lho + 30 + buf.readUInt16LE(lho + 26) + buf.readUInt16LE(lho + 28);
    if (start + csize > buf.length) throw new SheetScanError("entry outside the file");
    out.set(buf.toString("utf8", off + 46, off + 46 + nlen), { method, flags, data: buf.subarray(start, start + csize) });
    off += 46 + nlen + xlen + clen;
  }
  return out;
}

function read(files: Map<string, Entry>, name: string): string {
  const e = files.get(name);
  if (!e) throw new SheetScanError(`missing part ${name}`);
  if (e.flags & 1) throw new SheetScanError("encrypted part");
  if (e.method === 0) return e.data.toString("utf8");
  if (e.method !== 8) throw new SheetScanError("unsupported compression");
  // Bounded inflate: a part that expands beyond the cap throws instead of exhausting memory.
  try {
    return inflateRawSync(e.data, { maxOutputLength: LIMITS.declaredXlsxBytes }).toString("utf8");
  } catch (err) {
    // A part that expands past the cap is an inconsistent archive, reported like any other unreadable file.
    if (err instanceof RangeError) throw new SheetScanError("part expands beyond the allowed size");
    throw err;
  }
}

const NS = String.raw`(?:[A-Za-z_][\w.-]*:)?`; // optional XML namespace prefix, e.g. "x:"
const colNumber = (letters: string) => [...letters].reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0);

/** The sheet part (path inside the zip) of the FIRST sheet in workbook order, which is the sheet read-excel-file reads. */
function firstSheetPath(files: Map<string, Entry>): string {
  const wb = read(files, "xl/workbook.xml");
  const rid = wb.match(new RegExp(`<${NS}sheet\\b[^>]*?\\s[\\w.-]+:id="([^"]+)"`))?.[1];
  if (!rid) throw new SheetScanError("first sheet not found");
  const rels = read(files, "xl/_rels/workbook.xml.rels");
  // Compare the parsed Id to the uploaded r:id as plain strings: the uploaded text is never put into a pattern.
  const rel = [...rels.matchAll(/<Relationship\b[^>]*>/g)].map((m) => m[0]).find((t) => t.match(/\bId="([^"]*)"/)?.[1] === rid);
  const target = rel?.match(/\bTarget="([^"]+)"/)?.[1];
  if (!target) throw new SheetScanError("first sheet relationship not found");
  return target.startsWith("/") ? target.slice(1) : `xl/${target}`;
}

/**
 * Cells of the first sheet that hold a formula but would be read as BLANK: no stored result (uncached), or a formula error.
 * The parser library reads both as empty, so this is the only place they can be told apart from a genuinely blank cell.
 * Handles namespace prefixes and cells or rows without an `r` attribute. Throws SheetScanError for malformed input.
 */
export function findBlankLookingFormulaCells(buf: Buffer): FormulaFinding[] {
  return scanFirstSheet(buf).formulas;
}

/** The first sheet's formula findings and the extent of its cells that hold a value (a stored result, a formula or an inline string). */
export type SheetScan = { formulas: FormulaFinding[]; maxRow: number; maxCol: number };

/**
 * One pass over the first sheet. `maxRow` and `maxCol` are the highest row and column of any cell that holds a value; styled but empty
 * cells do not count, because the sheet reader does not expand rows for them either. The parser uses these BEFORE it reads the sheet,
 * to refuse a sparse sheet whose reader-side expansion (every missing row, padded to the header width) would exhaust memory.
 */
export function scanFirstSheet(buf: Buffer): SheetScan {
  const files = entries(buf);
  const xml = read(files, firstSheetPath(files));
  if (!new RegExp(`</${NS}sheetData>\\s*`).test(xml) || !new RegExp(`</${NS}worksheet>\\s*$`).test(xml)) throw new SheetScanError("sheet XML is incomplete");

  const found: FormulaFinding[] = [];
  const rowRe = new RegExp(`<${NS}row\\b([^>]*?)(?:/>|>([\\s\\S]*?)</${NS}row>)`, "g");
  const cellRe = new RegExp(`<${NS}c\\b([^>]*?)(?:/>|>([\\s\\S]*?)</${NS}c>)`, "g");
  const hasF = new RegExp(`<${NS}f[\\s>/]`);
  const hasV = new RegExp(`<${NS}v[\\s>/]`);
  const hasInline = new RegExp(`<${NS}is[\\s>/]`);
  let rowCounter = 0;
  let maxRow = 0;
  let maxCol = 0;
  for (const r of xml.matchAll(rowRe)) {
    rowCounter = Number(r[1].match(/\br="(\d+)"/)?.[1] ?? rowCounter + 1);
    let colCounter = 0;
    for (const c of (r[2] ?? "").matchAll(cellRe)) {
      const ref = c[1].match(/\br="([A-Z]+)(\d+)"/);
      colCounter = ref ? colNumber(ref[1]) : colCounter + 1;
      // A cell's own reference is authoritative for its row; the row element's counter is only the fallback.
      const row = ref ? Number(ref[2]) : rowCounter;
      const body = c[2] ?? "";
      const holdsFormula = hasF.test(body);
      if (holdsFormula || hasV.test(body) || hasInline.test(body)) {
        maxRow = Math.max(maxRow, row);
        maxCol = Math.max(maxCol, colCounter);
      }
      if (!holdsFormula) continue;
      if (/\bt="e"/.test(c[1])) found.push({ row, col: colCounter, kind: "error" });
      else if (!hasV.test(body)) found.push({ row, col: colCounter, kind: "uncached" });
    }
  }
  return { formulas: found, maxRow, maxCol };
}
