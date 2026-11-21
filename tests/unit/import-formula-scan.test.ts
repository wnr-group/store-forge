import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { findBlankLookingFormulaCells, SheetScanError } from "@/lib/import/formula-scan";
import { parseProductFile } from "@/lib/import/parse-product-file";
import { inspectXlsxZip } from "@/lib/import/zip-guard";

const bytes = (n: string) => readFileSync(`tests/fixtures/import/formulas/${n}.xlsx`);
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const parse = (n: string) => parseProductFile(new File([bytes(n)], `${n}.xlsx`, { type: XLSX }));
const sourceErrors = async (n: string) => {
  const r = await parse(n);
  return r.ok ? r.rows.flatMap((x) => (x.source_errors ?? []).map((e) => `${x.row}:${e.column}`)) : `REJECTED:${r.errors[0].code}`;
};
const eocd = (b: Buffer) => { let i = b.length - 22; while (b.readUInt32LE(i) !== 0x06054b50) i--; return i; };

describe("formula cells that would read as blank", () => {
  it.each(["blank-absent", "blank-emptycell", "cached-number", "cached-string", "cached-emptystring", "shared-cached", "stored-cached", "ns-cached", "first-sheet-clean"])(
    "%s is not flagged", async (n) => expect(await sourceErrors(n)).toEqual([]));
  it.each(["uncached", "uncached-str", "uncached-selfclosing-f", "shared-uncached-child", "uncached-sparse-refs", "ns-uncached", "first-sheet-dirty", "absolute-target"])(
    "%s is reported on spreadsheet row 2, column cost", async (n) => expect(await sourceErrors(n)).toEqual(["2:cost"]));
  it("reports the right message and keeps the other cells of the row", async () => {
    const r = await parse("uncached");
    if (!r.ok) throw new Error("expected ok");
    expect(r.rows).toEqual([{ row: 2, name: "Tee", price: "10", source_errors: [{ column: "cost", message: expect.stringContaining("no stored value") }] }]);
  });
  it("uncached-no-refs: the scan flags it, but the library cannot read a file whose cells lack an r attribute, so the parser reports unreadable (safe, not silent)", async () => {
    expect(findBlankLookingFormulaCells(bytes("uncached-no-refs"))).toEqual([{ row: 2, col: 3, kind: "uncached" }]);
    expect(await sourceErrors("uncached-no-refs")).toBe("REJECTED:unreadable");
  });
  it.each(["bad-truncated-sheet", "bad-no-closing-worksheet", "bad-no-rels", "bad-missing-sheet-part", "bad-no-sheets-element"])(
    "%s is unreadable and never accepted as 'no formulas'", async (n) => expect(await sourceErrors(n)).toBe("REJECTED:unreadable"));
  it("the scan itself throws SheetScanError for malformed parts", () => {
    expect(() => findBlankLookingFormulaCells(bytes("bad-truncated-sheet"))).toThrow(SheetScanError);
  });
});

describe("intentional rule V-FE: formula error cells are rejected (documented in I1 step 3)", () => {
  it.each(["error-cached", "error-na", "error-ref", "error-no-v"])("%s is reported on row 2, column cost with the formula-error message", async (n) => {
    expect(findBlankLookingFormulaCells(bytes(n))).toEqual([{ row: 2, col: 3, kind: "error" }]);
    const r = await parse(n);
    if (!r.ok) throw new Error("expected ok");
    expect(r.rows[0].source_errors).toEqual([{ column: "cost", message: expect.stringContaining("formula error") }]);
    expect(r.rows[0].source_errors?.[0].message).not.toContain("no stored value");
  });
  it("keeps the other cells of the row so the API validates them too", async () => {
    const r = await parse("error-cached");
    if (!r.ok) throw new Error("expected ok");
    expect(r.rows[0]).toMatchObject({ row: 2, name: "Tee", price: "10" });
  });
  it("documented limitation: a literal error value with no formula is read as blank and is not flagged", async () => {
    expect(findBlankLookingFormulaCells(bytes("error-literal"))).toEqual([]);
    expect(await sourceErrors("error-literal")).toEqual([]);
  });
});

describe("zip edge cases", () => {
  it("refuses ZIP64 markers and too many entries in the guard", () => {
    const a = Buffer.from(bytes("uncached")); a.writeUInt16LE(0xffff, eocd(a) + 10);
    const b = Buffer.from(bytes("uncached")); b.writeUInt32LE(0xffffffff, eocd(b) + 16);
    const c = Buffer.from(bytes("uncached")); c.writeUInt16LE(500, eocd(c) + 10);
    for (const buf of [a, b, c]) expect(inspectXlsxZip(buf).ok).toBe(false);
  });
  it("a central-directory offset out of range never yields a silent result", () => {
    const b = Buffer.from(bytes("uncached")); b.writeUInt32LE(b.length - 5, eocd(b) + 16);
    if (inspectXlsxZip(b).ok) expect(() => findBlankLookingFormulaCells(b)).toThrow(SheetScanError);
  });
  it("corrupted sheet data, an encrypted flag and an unsupported compression method all throw", () => {
    const corrupt = Buffer.from(bytes("uncached"));
    const hdr = corrupt.indexOf("xl/worksheets/sheet1.xml") - 30;
    const start = hdr + 30 + corrupt.readUInt16LE(hdr + 26) + corrupt.readUInt16LE(hdr + 28);
    corrupt.fill(0xff, start, start + 12);
    const enc = Buffer.from(bytes("uncached"));
    const method = Buffer.from(bytes("uncached"));
    for (let i = 0; i + 4 < enc.length; i++) if (enc.readUInt32LE(i) === 0x02014b50) { enc.writeUInt16LE(enc.readUInt16LE(i + 8) | 1, i + 8); if (method.readUInt16LE(i + 10) === 8) method.writeUInt16LE(99, i + 10); }
    for (const buf of [corrupt, enc, method]) expect(() => findBlankLookingFormulaCells(buf)).toThrow();
  });
  it("a lying archive (declared 2 KB, really 120 MB) is bounded: the inflate throws instead of exhausting memory", () => {
    const t0 = Date.now();
    expect(() => findBlankLookingFormulaCells(readFileSync("tests/fixtures/import/bomb-lying.xlsx"))).toThrow();
    expect(Date.now() - t0).toBeLessThan(2_000);
  });
  it("an honest bomb is refused by the guard before the scan runs", () => {
    expect(inspectXlsxZip(readFileSync("tests/fixtures/import/bomb-padding.xlsx")).ok).toBe(false);
  });
});
