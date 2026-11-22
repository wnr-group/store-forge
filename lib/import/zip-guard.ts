// lib/import/zip-guard.ts
import { inflateRawSync } from "node:zlib";
import { LIMITS } from "./product-columns";

export type ZipVerdict = { ok: true; declaredBytes: number } | { ok: false; reason: string };

const DAMAGED = { ok: false, reason: "This .xlsx file is damaged." } as const;
const LOCAL = 0x04034b50, CENTRAL = 0x02014b50, DESCRIPTOR = 0x08074b50;

type Central = { lho: number; flags: number; method: number; csize: number; usize: number };

/**
 * Refuses archives whose DECLARED sizes are too large, before any inflating, and refuses archives whose headers disagree.
 *
 * The XLSX reader streams the archive from the start and trusts each entry's LOCAL header (it allocates a buffer of the size the local
 * header declares). It never consults the central directory. So checking only the central directory is not enough: this also walks the
 * local headers in the order the reader sees them and requires that
 *   - every local entry is listed in the central directory (no hidden entries),
 *   - the local sizes equal the central sizes (so the reader's allocation is the size already checked),
 *   - nothing but the central directory follows the last entry,
 * and, for entries whose sizes live in a trailing data descriptor (the reader then buffers whatever inflates), that the real inflated
 * size equals the declared size, with the inflate itself capped.
 */
export function inspectXlsxZip(buf: Buffer): ZipVerdict {
  if (buf.length < 22 || buf.readUInt32LE(0) !== LOCAL) return { ok: false, reason: "This is not a valid .xlsx file." };
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) return { ok: false, reason: "This .xlsx file is damaged." };
  const count = buf.readUInt16LE(eocd + 10);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  if (count === 0xffff || cdOffset === 0xffffffff) return { ok: false, reason: "This .xlsx file uses an unsupported archive format. Re-save it from Excel or export CSV." };
  if (count > LIMITS.zipEntries) return { ok: false, reason: "This .xlsx file contains too many parts." };

  const entries = new Map<number, Central>();
  let off = cdOffset;
  let total = 0;
  for (let n = 0; n < count; n++) {
    if (off + 46 > buf.length || buf.readUInt32LE(off) !== CENTRAL) return DAMAGED;
    const usize = buf.readUInt32LE(off + 24);
    total += usize;
    entries.set(buf.readUInt32LE(off + 42), { lho: buf.readUInt32LE(off + 42), flags: buf.readUInt16LE(off + 8), method: buf.readUInt16LE(off + 10), csize: buf.readUInt32LE(off + 20), usize });
    off += 46 + buf.readUInt16LE(off + 28) + buf.readUInt16LE(off + 30) + buf.readUInt16LE(off + 32);
  }
  if (total > LIMITS.declaredXlsxBytes) return { ok: false, reason: "This .xlsx file expands to too much data. Remove unused rows and columns, or export a CSV." };
  if (entries.size !== count) return DAMAGED; // two directory records for one local header

  let pos = 0;
  let walked = 0;
  while (pos + 30 <= buf.length && buf.readUInt32LE(pos) === LOCAL) {
    const central = entries.get(pos);
    if (!central) return DAMAGED; // a local entry the directory does not list
    const flags = buf.readUInt16LE(pos + 6);
    if (flags & 1) return { ok: false, reason: "This .xlsx file is encrypted. Remove the password and upload it again." };
    if (buf.readUInt16LE(pos + 8) !== central.method) return DAMAGED;
    const csize = buf.readUInt32LE(pos + 18), usize = buf.readUInt32LE(pos + 22);
    if (csize === 0xffffffff || usize === 0xffffffff) return { ok: false, reason: "This .xlsx file uses an unsupported archive format. Re-save it from Excel or export CSV." };
    const dataStart = pos + 30 + buf.readUInt16LE(pos + 26) + buf.readUInt16LE(pos + 28);
    const dataEnd = dataStart + central.csize;
    if (dataEnd > buf.length) return DAMAGED;
    if (flags & 8) {
      // Sizes follow the data. The reader sees no size, so it buffers whatever inflates: prove the real size is the declared one.
      if (central.method === 8) {
        try {
          if (inflateRawSync(buf.subarray(dataStart, dataEnd), { maxOutputLength: central.usize + 1 }).length !== central.usize) return DAMAGED;
        } catch {
          return DAMAGED;
        }
      } else if (central.method !== 0 || central.csize !== central.usize) return DAMAGED;
      pos = dataEnd + (dataEnd + 4 <= buf.length && buf.readUInt32LE(dataEnd) === DESCRIPTOR ? 16 : 12);
    } else {
      if (csize !== central.csize || usize !== central.usize) return DAMAGED;
      pos = dataEnd;
    }
    walked++;
  }
  if (walked !== count) return DAMAGED;
  // Whatever lies between the last entry and the directory must not contain another local header the reader could pick up.
  if (pos > cdOffset || (pos < cdOffset && buf.subarray(pos, cdOffset).indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04])) !== -1)) return DAMAGED;
  return { ok: true, declaredBytes: total };
}
