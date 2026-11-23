import { crc32, deflateRawSync } from "node:zlib";

/**
 * Builds .xlsx archives byte by byte, for tests only. Unlike a zip library it can write archives whose headers DISAGREE (a local header
 * that declares a different size than the central directory, an entry the directory does not list, a data descriptor), which is exactly
 * what the import guard has to survive.
 */
export type Part = {
  name: string;
  data: string | Buffer;
  method?: 0 | 8;
  /** Overrides what the central directory declares. */
  centralUsize?: number;
  /** Overrides what the local header declares (written as is, unless `descriptor`). */
  localUsize?: number;
  /** Sizes follow the data in a data descriptor (flag bit 3); the local header carries zeros. */
  descriptor?: boolean;
  /** Written to the archive but left out of the central directory. */
  hidden?: boolean;
};

const u16 = (n: number) => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; };
const u32 = (n: number) => { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return b; };

export function buildZip(parts: Part[]): Buffer {
  const chunks: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  let listed = 0;
  for (const p of parts) {
    const raw = Buffer.from(p.data);
    const method = p.method ?? 8;
    const body = method === 8 ? deflateRawSync(raw) : raw;
    const name = Buffer.from(p.name);
    const crc = crc32(raw);
    const flags = p.descriptor ? 8 : 0;
    const local = Buffer.concat([
      u32(0x04034b50), u16(20), u16(flags), u16(method), u16(0), u16(0),
      u32(p.descriptor ? 0 : crc), u32(p.descriptor ? 0 : body.length), u32(p.descriptor ? 0 : (p.localUsize ?? raw.length)),
      u16(name.length), u16(0), name, body,
      ...(p.descriptor ? [u32(0x08074b50), u32(crc), u32(body.length), u32(raw.length)] : []),
    ]);
    if (!p.hidden) {
      central.push(Buffer.concat([
        u32(0x02014b50), u16(20), u16(20), u16(flags), u16(method), u16(0), u16(0),
        u32(crc), u32(body.length), u32(p.centralUsize ?? raw.length),
        u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name,
      ]));
      listed++;
    }
    chunks.push(local);
    offset += local.length;
  }
  const dir = Buffer.concat(central);
  return Buffer.concat([...chunks, dir, u32(0x06054b50), u16(0), u16(0), u16(listed), u16(listed), u32(dir.length), u32(offset), u16(0)]);
}

const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>`;
const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
const WORKBOOK = `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="${NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`;
const WORKBOOK_RELS = (rid = "rId1") => `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;

export const text = (ref: string, value: string) => `<c r="${ref}" t="inlineStr"><is><t>${value}</t></is></c>`;
export const sheetXml = (rows: string) => `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${NS}"><sheetData>${rows}</sheetData></worksheet>`;

/** The standard five parts of a minimal workbook around the given sheet, plus any overrides or extra parts. */
export function workbookParts(sheet: string, overrides: Partial<Record<string, Partial<Part>>> = {}, extra: Part[] = [], rid = "rId1"): Part[] {
  const base: Part[] = [
    { name: "[Content_Types].xml", data: CONTENT_TYPES },
    { name: "_rels/.rels", data: ROOT_RELS },
    { name: "xl/workbook.xml", data: WORKBOOK },
    { name: "xl/_rels/workbook.xml.rels", data: WORKBOOK_RELS(rid) },
    { name: "xl/worksheets/sheet1.xml", data: sheet },
  ];
  return [...base.map((p) => ({ ...p, ...overrides[p.name] })), ...extra];
}

export const xlsx = (sheet: string, overrides?: Partial<Record<string, Partial<Part>>>, extra?: Part[]) => buildZip(workbookParts(sheet, overrides, extra));

/** A valid two-row product sheet. */
export const PRODUCT_SHEET = sheetXml(`<row r="1">${text("A1", "name")}${text("B1", "price")}</row><row r="2">${text("A2", "Tee")}${text("B2", "10")}</row>`);
