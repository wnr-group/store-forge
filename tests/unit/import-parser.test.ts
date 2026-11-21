import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseProductFile } from "@/lib/import/parse-product-file";
import { inspectXlsxZip } from "@/lib/import/zip-guard";

const csv = (text: string, name = "p.csv") => new File([text], name, { type: "text/csv" });
const fixture = (n: string) => new File([readFileSync(`tests/fixtures/import/${n}`)], n, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
const errs = async (f: File) => { const r = await parseProductFile(f); return r.ok ? [] : r.errors.map((e) => e.code); };

describe("parseProductFile", () => {
  it("parses a CSV with a BOM, any column order and trimmed, case-insensitive headers; row numbers match the sheet", async () => {
    const r = await parseProductFile(csv("\uFEFF Price ,NAME\r\n10.00,Tee\r\n\r\n,,\r\n7,Cap\r\n"));
    expect(r).toMatchObject({ ok: true });
    if (r.ok) expect(r.rows).toEqual([{ row: 2, price: "10.00", name: "Tee" }, { row: 5, price: "7", name: "Cap" }]);
  });
  it("rejects .xls, other types, an empty file and a header-only file", async () => {
    expect(await errs(csv("x", "p.xls"))).toEqual(["type"]);
    expect(await errs(csv("x", "p.txt"))).toEqual(["type"]);
    expect(await errs(csv(""))).toEqual(["empty"]);
    expect(await errs(csv("name,price\r\n"))).toEqual(["empty"]);
  });
  it("rejects unknown, duplicate and missing required headers", async () => {
    expect(await errs(csv("name,price,colour\r\nA,1"))).toEqual(["headers"]);
    expect(await errs(csv("name,price,price\r\nA,1,2"))).toEqual(["headers"]);
    expect(await errs(csv("name,sku\r\nA,1"))).toEqual(["headers"]);
  });
  it("enforces 500 data rows (501 rejected, 500 accepted) and ignores blank rows in the count", async () => {
    const body = (n: number) => "name,price\r\n" + Array.from({ length: n }, (_, i) => `P${i},1`).join("\r\n");
    expect((await parseProductFile(csv(body(500)))).ok).toBe(true);
    expect(await errs(csv(body(501)))).toEqual(["rows"]);
    expect((await parseProductFile(csv(body(500) + "\r\n,\r\n,\r\n"))).ok).toBe(true);
  });
  it("rejects a serialised payload over 1.5 MB (a CSV under the 1 MB size gate cannot reach it, so this uses an xlsx fixture)", async () => {
    expect(await errs(fixture("payload-over-1_5mb.xlsx"))).toEqual(["payload"]);
  });
  it("rejects a file over 1 MB before parsing", async () => {
    expect(await errs(csv("name,price\r\n" + "a".repeat(1_100_000)))).toEqual(["size"]);
  });
  it("reads a valid xlsx (numeric cells become plain text) and keeps spreadsheet row numbers", async () => {
    const r = await parseProductFile(fixture("valid.xlsx"));
    expect(r).toMatchObject({ ok: true });
    if (r.ok) expect(r.rows[0]).toMatchObject({ row: 2, price: "499.5", sku: "123" });
  });
  it("keeps spreadsheet row numbers across blank rows in an xlsx", async () => {
    const r = await parseProductFile(fixture("blank-rows.xlsx"));
    if (!r.ok) throw new Error("expected ok");
    expect(r.rows.map((x) => x.row)).toEqual([2, 5, 7]);
  });
  it("refuses a decompression bomb quickly and survives a lying archive", async () => {
    const t0 = Date.now();
    expect(await errs(fixture("bomb-padding.xlsx"))).toEqual(["xlsx-guard"]);
    expect(Date.now() - t0).toBeLessThan(1_000);
    expect(await errs(fixture("bomb-lying.xlsx"))).toEqual(["unreadable"]);
  });
  it("refuses ZIP64 metadata", () => {
    const buf = Buffer.from(readFileSync("tests/fixtures/import/valid.xlsx"));
    let eocd = buf.length - 22;
    while (buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
    buf.writeUInt16LE(0xffff, eocd + 10);
    expect(inspectXlsxZip(buf)).toMatchObject({ ok: false });
  });
});
