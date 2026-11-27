import { describe, expect, it } from "vitest";
import { buildXlsx } from "@/lib/import/xlsx-writer";
import { buildCatalogTemplateCsv, buildLevelsTemplateCsv, chunkImportRows, isItemColumn, LEVEL_COLUMNS } from "@/lib/import/catalog-columns";
import { aggregateImport } from "@/lib/import/catalog-aggregate";
import { parseCatalogFile } from "@/lib/import/parse-catalog-file";
import { parseProductFile } from "@/lib/import/parse-product-file";
import { fileResponse, tableToRows, toCsv } from "@/lib/import/export-file";
import type { CatalogImportResult, CatalogImportRow } from "@/lib/catalog/types";

const csv = (text: string, name = "catalog.csv") => new File([text], name, { type: "text/csv" });
const xlsx = (sheets: { name: string; rows: string[][] }[], name = "catalog.xlsx") => new File([new Uint8Array(buildXlsx(sheets))], name, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
const errors = async (f: File, levels?: File) => {
  const r = await parseCatalogFile(f, levels);
  return r.ok ? [] : r.errors.map((e) => e.code);
};

describe("parseCatalogFile (CSV)", () => {
  it("reads items with any number of levels, trimmed headers in any case, and keeps sheet row numbers", async () => {
    const r = await parseCatalogFile(csv("\uFEFF Level_1 ,LEVEL_2,level_3,product_sku\r\nMahindra,Centuro,Rock Star,BP-1\r\n\r\n,,,\r\nSuzuki,Access,,\r\n"));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.depth).toBe(3);
    expect(r.levels).toBeNull();
    expect(r.rows).toEqual([
      { row: 2, level_1: "Mahindra", level_2: "Centuro", level_3: "Rock Star", product_sku: "BP-1" },
      { row: 5, level_1: "Suzuki", level_2: "Access" },
    ]);
  });

  it("accepts up to twenty levels and refuses a twenty-first column", async () => {
    const header = (n: number) => Array.from({ length: n }, (_, i) => `level_${i + 1}`).join(",");
    expect((await parseCatalogFile(csv(`${header(20)}\r\n${Array(20).fill("x").join(",")}\r\n`))).ok).toBe(true);
    expect(await errors(csv(`${header(21)}\r\n${Array(21).fill("x").join(",")}\r\n`))).toEqual(["headers"]);
  });

  it("knows exactly the columns the API reads, including the ones its export writes", () => {
    for (const c of [...LEVEL_COLUMNS, "status", "description", "position", "product_id", "product_sku", "product_slug", "product_position", "part_number", "product_name"]) expect(isItemColumn(c)).toBe(true);
    for (const c of ["name", "sku", "level_0", "level_21", "row"]) expect(isItemColumn(c)).toBe(false);
  });

  it("rejects unknown and duplicate columns and a missing level_1 with a message that names them", async () => {
    const unknown = await parseCatalogFile(csv("level_1,colour\r\nA,red\r\n"));
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.errors[0].message).toMatch(/colour/);
    expect(await errors(csv("level_1,level_1\r\nA,B\r\n"))).toEqual(["headers"]);
    expect(await errors(csv("level_2,status\r\nA,active\r\n"))).toEqual(["headers"]);
  });

  it("rejects .xls, other types, empty and header-only files, and files over 1 MB", async () => {
    expect(await errors(csv("x", "c.xls"))).toEqual(["type"]);
    expect(await errors(csv("x", "c.txt"))).toEqual(["type"]);
    expect(await errors(csv(""))).toEqual(["empty"]);
    expect(await errors(csv("level_1\r\n"))).toEqual(["empty"]);
    expect(await errors(csv("level_1\r\n" + "a".repeat(1_100_000)))).toEqual(["size"]);
  });

  it("allows 10000 rows and refuses 10001", async () => {
    const body = (n: number) => "level_1\r\n" + Array.from({ length: n }, (_, i) => `N${i}`).join("\r\n");
    expect((await parseCatalogFile(csv(body(10_000)))).ok).toBe(true);
    expect(await errors(csv(body(10_001)))).toEqual(["rows"]);
  });

  it("reads an optional levels file and keeps its rows numbered like the sheet", async () => {
    const r = await parseCatalogFile(csv("level_1,level_2\r\nA,B\r\n"), csv("name,can_hold_products\r\nBrand,false\r\nModel,true\r\n", "levels.csv"));
    expect(r.ok).toBe(true);
    if (r.ok)
      expect(r.levels).toEqual([
        { row: 2, name: "Brand", can_hold_products: "false" },
        { row: 3, name: "Model", can_hold_products: "true" },
      ]);
  });

  it("explains a problem in the levels file and never imports anything", async () => {
    // An unknown column and the missing name column are two separate problems, both about the levels file.
    expect(new Set(await errors(csv("level_1\r\nA\r\n"), csv("title\r\nBrand\r\n", "levels.csv")))).toEqual(new Set(["levels"]));
    expect(await errors(csv("level_1\r\nA\r\n"), csv("name\r\n", "levels.csv"))).toEqual(["levels"]);
    const many = "name\r\n" + Array.from({ length: 21 }, (_, i) => `L${i}`).join("\r\n");
    expect(await errors(csv("level_1\r\nA\r\n"), csv(many, "levels.csv"))).toEqual(["levels"]);
  });
});

describe("parseCatalogFile (Excel)", () => {
  it("reads the items from the first sheet and the levels from a sheet named Levels", async () => {
    const r = await parseCatalogFile(
      xlsx([
        {
          name: "Catalog",
          rows: [
            ["level_1", "level_2", "product_sku", "part_number"],
            ["Mahindra", "Centuro", "00123", "PN-9"],
          ],
        },
        {
          name: "Levels",
          rows: [
            ["name", "can_hold_products"],
            ["Brand", "false"],
            ["Model", "true"],
          ],
        },
      ]),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Text stays text: a SKU with leading zeros is not turned into a number.
    expect(r.rows).toEqual([{ row: 2, level_1: "Mahindra", level_2: "Centuro", product_sku: "00123", part_number: "PN-9" }]);
    expect(r.levels?.map((l) => l.name)).toEqual(["Brand", "Model"]);
  });

  it("works without a Levels sheet, and ignores other sheets", async () => {
    const r = await parseCatalogFile(
      xlsx([
        { name: "Items", rows: [["level_1"], ["A"]] },
        { name: "Notes", rows: [["anything"], ["goes"]] },
      ]),
    );
    expect(r.ok && r.levels === null && r.rows.length === 1).toBe(true);
  });

  it("refuses a Levels sheet in first place, because the items are read from the first sheet", async () => {
    expect(
      await errors(
        xlsx([
          { name: "Levels", rows: [["name"], ["Brand"]] },
          { name: "Catalog", rows: [["level_1"], ["A"]] },
        ]),
      ),
    ).toEqual(["levels"]);
  });

  it("refuses a file that only claims to be .xlsx", async () => {
    expect(await errors(new File(["not a zip"], "c.xlsx", { type: "application/octet-stream" }))).toEqual(["xlsx-guard"]);
  });
});

function csvFile(text: string) {
  return new File([text], "p.csv", { type: "text/csv" });
}

describe("Excel export that reads back", () => {
  it("writes text cells (escaped, no control characters) that the import reader returns unchanged", async () => {
    const rows = [
      ["level_1", "description"],
      ["A & B <C>", 'say "hi"\tnow\u0001'],
      ["", "second"],
    ];
    const r = await parseCatalogFile(xlsx([{ name: "Catalog", rows }]));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rows[0]).toEqual({ row: 2, level_1: "A & B <C>", description: 'say "hi"\tnow' });
    expect(r.rows[1]).toEqual({ row: 3, description: "second" });
  });

  it("keeps the product export's columns readable by the product import (id and has_variants are accepted and ignored)", async () => {
    const book = xlsx(
      [
        {
          name: "Products",
          rows: [
            ["id", "name", "slug", "sku", "part_number", "price", "has_variants"],
            ["abc", "Pad", "pad", "SKU1", "PN-1", "10.00", "false"],
          ],
        },
      ],
      "p.xlsx",
    );
    const r = await parseProductFile(book);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.rows).toEqual([{ row: 2, name: "Pad", slug: "pad", sku: "SKU1", part_number: "PN-1", price: "10.00" }]);
  });

  it("flags an exported product that has variants, because the import only creates simple products", async () => {
    const r = await parseProductFile(csvFile("name,price,has_variants\r\nShirt,10,true\r\nCap,5,false\r\n"));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.rows[0].source_errors?.[0]).toMatchObject({ column: "has_variants" });
      expect(r.rows[1].source_errors).toBeUndefined();
    }
  });

  it("accepts part_number on a product CSV", async () => {
    const r = await parseProductFile(csvFile("name,price,part_number\r\nPad,10,PN-7\r\n"));
    expect(r.ok && r.rows[0].part_number === "PN-7").toBe(true);
  });
});

describe("templates and exports", () => {
  it("builds a template with one level column per level of this store, and at least one", () => {
    expect(buildCatalogTemplateCsv(["Brand", "Vehicle", "Variant", "Part group"]).split("\r\n")[0]).toBe("level_1,level_2,level_3,level_4,status,description,position,product_id,product_sku,product_slug,product_position,part_number,product_name");
    expect(buildCatalogTemplateCsv([]).split("\r\n")[0].startsWith("level_1,status")).toBe(true);
    expect(buildLevelsTemplateCsv(["Brand", "Model"])).toBe("name,can_hold_products\r\nBrand,false\r\nModel,false\r\n");
  });

  it("writes a CSV with a byte-order mark, quoting commas and quotes", () => {
    const text = toCsv({ columns: ["a", "b"], rows: [{ a: "x,y", b: 'q"r' }, { a: "" }] });
    expect(text.startsWith("\uFEFF")).toBe(true);
    expect(text).toContain('"x,y"');
    expect(text).toContain('"q""r"');
    expect(tableToRows({ columns: ["a", "b"], rows: [{ a: "1" }] })).toEqual([
      ["a", "b"],
      ["1", ""],
    ]);
  });

  it("answers a download with safe headers and the right type", () => {
    const table = { columns: ["a"], rows: [{ a: "1" }] };
    const c = fileResponse("csv", "My Catalog!", [{ name: "x", table }]);
    expect(c.headers.get("content-disposition")).toBe('attachment; filename="my-catalog.csv"');
    expect(c.headers.get("cache-control")).toBe("no-store");
    expect(c.headers.get("x-content-type-options")).toBe("nosniff");
    const x = fileResponse("xlsx", "../../etc/passwd", [{ name: "x", table }]);
    expect(x.headers.get("content-disposition")).toBe('attachment; filename="etc-passwd.xlsx"');
    expect(x.headers.get("content-type")).toContain("spreadsheetml.sheet");
  });
});

describe("chunking and joining the requests of one file", () => {
  const rows = (n: number, pad = ""): CatalogImportRow[] => Array.from({ length: n }, (_, i) => ({ row: i + 2, level_1: `Item ${i}${pad}` }));

  it("splits by row count and by size, keeps order, and never loses or repeats a row", () => {
    const chunks = chunkImportRows(rows(5000));
    expect(chunks.map((c) => c.length)).toEqual([2000, 2000, 1000]);
    expect(chunks.flat().map((r) => r.row)).toEqual(rows(5000).map((r) => r.row));
    const fat = chunkImportRows(rows(10, "x".repeat(400)), 2000, 1000);
    expect(fat.length).toBeGreaterThan(1);
    expect(fat.every((c) => JSON.stringify(c).length <= 1100)).toBe(true);
    expect(fat.flat()).toHaveLength(10);
    expect(chunkImportRows([])).toEqual([]);
    expect(chunkImportRows(rows(1))).toHaveLength(1);
  });

  const part = (over: Partial<CatalogImportResult["summary"]>, errs: CatalogImportResult["errors"] = [], valid = errs.length === 0): CatalogImportResult => ({
    dryRun: true,
    valid,
    summary: { hierarchyCreated: true, levelsCreated: 2, levelsUpdated: 0, nodesCreated: 1, nodesUpdated: 0, nodesUnchanged: 0, assignmentsCreated: 1, assignmentsExisting: 0, ...over },
    errors: errs,
    totalErrors: errs.length,
  });

  it("takes the catalog and levels from the first answer and adds up items and placements", () => {
    const a = aggregateImport([part({}), part({ hierarchyCreated: false, levelsCreated: 0, nodesCreated: 3, assignmentsCreated: 2, nodesUnchanged: 4 })]);
    expect(a.summary).toMatchObject({ hierarchyCreated: true, levelsCreated: 2, nodesCreated: 4, nodesUnchanged: 4, assignmentsCreated: 3 });
    expect(a.valid).toBe(true);
    expect(a.requests).toBe(2);
  });

  it("lists a problem reported by several requests once, in row order, and is invalid when any request is", () => {
    const level = { row: 0, column: "levels", message: "Too many levels.", value: "21" };
    const a = aggregateImport([part({}, [level, { row: 9, column: "level_2", message: "Gap.", value: "" }]), part({}, [level, { row: 4, column: "status", message: "Use draft or active.", value: "x" }])]);
    expect(a.valid).toBe(false);
    expect(a.errors.map((e) => e.row)).toEqual([0, 4, 9]);
    expect(a.totalErrors).toBe(3);
  });

  it("is valid and empty for nothing", () => {
    expect(aggregateImport([])).toMatchObject({ valid: true, requests: 0, totalErrors: 0 });
  });
});
