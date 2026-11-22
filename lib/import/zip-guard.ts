// lib/import/zip-guard.ts
import { LIMITS } from "./product-columns";

export type ZipVerdict = { ok: true; declaredBytes: number } | { ok: false; reason: string };

/** Reads the zip central directory and refuses archives whose DECLARED uncompressed size is too large, before any inflating. */
export function inspectXlsxZip(buf: Buffer): ZipVerdict {
  if (buf.length < 22 || buf.readUInt32LE(0) !== 0x04034b50) return { ok: false, reason: "This is not a valid .xlsx file." };
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) return { ok: false, reason: "This .xlsx file is damaged." };
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  if (count === 0xffff || off === 0xffffffff) return { ok: false, reason: "This .xlsx file uses an unsupported archive format. Re-save it from Excel or export CSV." };
  if (count > LIMITS.zipEntries) return { ok: false, reason: "This .xlsx file contains too many parts." };
  let total = 0;
  for (let n = 0; n < count; n++) {
    if (off + 46 > buf.length || buf.readUInt32LE(off) !== 0x02014b50) return { ok: false, reason: "This .xlsx file is damaged." };
    total += buf.readUInt32LE(off + 24);
    off += 46 + buf.readUInt16LE(off + 28) + buf.readUInt16LE(off + 30) + buf.readUInt16LE(off + 32);
  }
  if (total > LIMITS.declaredXlsxBytes) return { ok: false, reason: "This .xlsx file expands to too much data. Remove unused rows and columns, or export a CSV." };
  return { ok: true, declaredBytes: total };
}
