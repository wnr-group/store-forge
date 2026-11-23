import { describe, expect, it } from "vitest";
import { findBlankLookingFormulaCells, SheetScanError } from "@/lib/import/formula-scan";
import { parseProductFile } from "@/lib/import/parse-product-file";
import { LIMITS } from "@/lib/import/product-columns";
import { inspectXlsxZip } from "@/lib/import/zip-guard";
import { buildZip, PRODUCT_SHEET, sheetXml, text, workbookParts, xlsx } from "../support/xlsx-builder";

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const file = (buf: Buffer) => new File([new Uint8Array(buf)], "p.xlsx", { type: XLSX_TYPE });
const outcome = async (buf: Buffer) => {
  const t0 = Date.now();
  const r = await parseProductFile(file(buf));
  return { r, ms: Date.now() - t0 };
};
const HUGE = 900 * 1024 * 1024;

describe("the test builder produces a workbook the importer reads", () => {
  it("parses an honest archive", async () => {
    const { r } = await outcome(xlsx(PRODUCT_SHEET));
    expect(r).toEqual({ ok: true, rows: [{ row: 2, name: "Tee", price: "10" }] });
  });
});

describe("zip guard: headers that disagree (review: bound the decompressed size before the sheet reader allocates)", () => {
  it("accepts an honest archive, stored or deflated, and an honest data-descriptor entry", () => {
    expect(inspectXlsxZip(xlsx(PRODUCT_SHEET)).ok).toBe(true);
    expect(inspectXlsxZip(buildZip(workbookParts(PRODUCT_SHEET).map((p) => ({ ...p, method: 0 as const })))).ok).toBe(true);
    expect(inspectXlsxZip(xlsx(PRODUCT_SHEET, { "xl/worksheets/sheet1.xml": { descriptor: true } })).ok).toBe(true);
  });

  it("refuses an entry whose LOCAL header declares far more than the central directory (the reader allocates the local size)", async () => {
    const buf = xlsx(PRODUCT_SHEET, { "xl/worksheets/sheet1.xml": { localUsize: HUGE } });
    expect(inspectXlsxZip(buf)).toEqual({ ok: false, reason: "This .xlsx file is damaged." });
    const { r, ms } = await outcome(buf);
    expect(r).toMatchObject({ ok: false, errors: [{ code: "xlsx-guard" }] });
    expect(ms).toBeLessThan(1_000);
  });

  it("refuses an entry that the central directory does not list (the streaming reader would still read it)", async () => {
    const hidden = { name: "xl/media/hidden.bin", data: Buffer.alloc(1024), localUsize: HUGE, hidden: true };
    const buf = buildZip([...workbookParts(PRODUCT_SHEET), hidden]);
    expect(inspectXlsxZip(buf).ok).toBe(false);
    const front = buildZip([hidden, ...workbookParts(PRODUCT_SHEET)]);
    expect(inspectXlsxZip(front).ok).toBe(false);
    expect((await outcome(front)).r).toMatchObject({ ok: false, errors: [{ code: "xlsx-guard" }] });
  });

  it("refuses a data-descriptor entry whose real size is not the declared one", () => {
    const lying = xlsx(PRODUCT_SHEET, { "xl/worksheets/sheet1.xml": { descriptor: true, centralUsize: 10 } });
    expect(inspectXlsxZip(lying).ok).toBe(false);
  });

  it("refuses a bomb quickly even when the data-descriptor declares a small size", () => {
    const bomb = xlsx(PRODUCT_SHEET, { "xl/worksheets/sheet1.xml": { descriptor: true, centralUsize: 2_000 } }, [{ name: "xl/pad.bin", data: Buffer.alloc(40 * 1024 * 1024), centralUsize: 2_000, descriptor: true }]);
    const t0 = Date.now();
    expect(inspectXlsxZip(bomb).ok).toBe(false);
    expect(Date.now() - t0).toBeLessThan(2_000);
  });

  it("refuses an encrypted entry and a method that differs between the headers", () => {
    const buf = xlsx(PRODUCT_SHEET);
    const encrypted = Buffer.from(buf);
    encrypted.writeUInt16LE(encrypted.readUInt16LE(6) | 1, 6); // first local header
    expect(inspectXlsxZip(encrypted)).toMatchObject({ ok: false, reason: expect.stringContaining("encrypted") });
    const swapped = Buffer.from(buf);
    swapped.writeUInt16LE(0, 8); // first local header claims "stored" while the directory says "deflated"
    expect(inspectXlsxZip(swapped).ok).toBe(false);
  });

  it("refuses a local header hidden in the gap before the central directory", () => {
    const parts = workbookParts(PRODUCT_SHEET);
    const honest = buildZip(parts);
    // Insert a second local header (signature only is enough for a streaming reader to try) between the last entry and the directory.
    let eocd = honest.length - 22;
    while (honest.readUInt32LE(eocd) !== 0x06054b50) eocd--;
    const cd = honest.readUInt32LE(eocd + 16);
    const gap = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(40)]);
    const tampered = Buffer.concat([honest.subarray(0, cd), gap, honest.subarray(cd)]);
    tampered.writeUInt32LE(cd + gap.length, tampered.length - 22 + 16);
    expect(inspectXlsxZip(tampered).ok).toBe(false);
  });
});

describe("sparse sheets (review: bound sparse worksheet row expansion before the sheet is read)", () => {
  const sheetWithProductAt = (row: number, col = "A") => sheetXml(`<row r="1">${text("A1", "name")}${text("B1", "price")}</row><row r="${row}">${text(`${col}${row}`, "Late")}${col === "A" ? text(`B${row}`, "5") : ""}</row>`);

  it("refuses a product at row 1,048,576 before the reader expands about a million rows", async () => {
    const { r, ms } = await outcome(xlsx(sheetWithProductAt(1_048_576)));
    expect(r).toMatchObject({ ok: false, errors: [{ code: "xlsx-guard", message: expect.stringContaining("row 1048576") }] });
    expect(ms).toBeLessThan(1_000);
  });

  it("accepts blank rows within the bound and refuses just past it", async () => {
    const ok = await outcome(xlsx(sheetWithProductAt(LIMITS.sheetRows)));
    expect(ok.r).toMatchObject({ ok: true, rows: [{ row: LIMITS.sheetRows, name: "Late", price: "5" }] });
    expect((await outcome(xlsx(sheetWithProductAt(LIMITS.sheetRows + 1)))).r).toMatchObject({ ok: false, errors: [{ code: "xlsx-guard" }] });
  });

  it("ignores styled but empty cells far down the sheet (the reader does not expand for them)", async () => {
    const sheet = sheetXml(`<row r="1">${text("A1", "name")}${text("B1", "price")}</row><row r="2">${text("A2", "Tee")}${text("B2", "10")}</row><row r="1048576"><c r="A1048576" s="1"/></row>`);
    expect((await outcome(xlsx(sheet))).r).toMatchObject({ ok: true, rows: [{ row: 2, name: "Tee", price: "10" }] });
  });

  it("refuses data beyond the column bound", async () => {
    const cell = (n: number) => { let s = ""; for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s; return s; };
    const sheet = sheetXml(`<row r="1">${text("A1", "name")}${text("B1", "price")}${text(`${cell(LIMITS.sheetCols + 1)}1`, "stray")}</row>`);
    expect((await outcome(xlsx(sheet))).r).toMatchObject({ ok: false, errors: [{ code: "xlsx-guard" }] });
  });
});

describe("formula scan (review: no pattern from uploaded text; use the cell's own row)", () => {
  it("looks the relationship up without building a pattern from the uploaded r:id (no exponential backtracking)", () => {
    const evil = "(a+)+$";
    const sheet = xlsx(PRODUCT_SHEET);
    const workbook = workbookParts(PRODUCT_SHEET, {}, [], `${"a".repeat(60)}!`);
    // The workbook points at r:id="(a+)+$", the rels only hold a long run of "a" characters: nothing matches, and it must say so at once.
    const tampered = buildZip(workbook.map((p) => (p.name === "xl/workbook.xml" ? { ...p, data: String(p.data).replace('r:id="rId1"', `r:id="${evil}"`) } : p)));
    const t0 = Date.now();
    expect(() => findBlankLookingFormulaCells(tampered)).toThrow(SheetScanError);
    expect(Date.now() - t0).toBeLessThan(500);
    expect(findBlankLookingFormulaCells(sheet)).toEqual([]);
  });

  it("an Id that equals the r:id is matched exactly, including regex metacharacters", () => {
    const rid = "r.Id+1";
    const parts = workbookParts(PRODUCT_SHEET, {}, [], rid).map((p) => (p.name === "xl/workbook.xml" ? { ...p, data: String(p.data).replace('r:id="rId1"', `r:id="${rid}"`) } : p));
    expect(findBlankLookingFormulaCells(buildZip(parts))).toEqual([]);
  });

  it("reports a formula cell on its own row when the row element has no r attribute", () => {
    const sheet = sheetXml(`<row r="1">${text("A1", "name")}</row><row><c r="C5"><f>1+1</f></c></row>`);
    expect(findBlankLookingFormulaCells(xlsx(sheet))).toEqual([{ row: 5, col: 3, kind: "uncached" }]);
  });

  it("falls back to the row counter for a cell without a reference", () => {
    const sheet = sheetXml(`<row r="7"><c><f>1+1</f></c></row>`);
    expect(findBlankLookingFormulaCells(xlsx(sheet))).toEqual([{ row: 7, col: 1, kind: "uncached" }]);
  });
});
