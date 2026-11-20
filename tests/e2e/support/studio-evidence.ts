import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { join, relative } from "node:path";

/**
 * Screenshot + result recorder for the Studio UI Enhancement acceptance criteria.
 *
 * - Screenshots go to artifacts/qa/screenshots/STUDIO-UI-ENHANCEMENT/<folder>/<label>-<name>.png (the repository's
 *   existing evidence convention, see tests/e2e/helpers.ts). `label` is "before" (origin/main) or "after" (the branch).
 * - Every capture is validated as a real PNG (signature, chunk CRCs, IHDR size, decodable pixel data that is not a single
 *   flat colour) and recorded as one JSON line in evidence-report/results-<label>.jsonl with the AC id, test id and the
 *   environment it came from. A capture that fails validation FAILS the test; it never passes silently.
 * - Inspection (a person looking at the image) is deliberately NOT recorded here: it is a separate, later step.
 */
export const LABEL = process.env.EVIDENCE_LABEL ?? "after";
export const ROOT = join(process.cwd(), "artifacts", "qa", "screenshots", "STUDIO-UI-ENHANCEMENT");
export const REPORT_DIR = join(ROOT, "evidence-report");
const RESULTS = join(REPORT_DIR, `results-${LABEL}.jsonl`);

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf: Buffer) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

export type PngInfo = { width: number; height: number; bytes: number; distinctRowSamples: number };

/** Throws unless `file` is a structurally valid PNG whose decoded pixels are not one flat colour. */
export function verifyPng(file: string): PngInfo {
  const buf = readFileSync(file);
  if (!buf.subarray(0, 8).equals(SIGNATURE)) throw new Error(`${file}: not a PNG (bad signature)`);
  let pos = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat: Buffer[] = [];
  let sawEnd = false;
  while (pos + 12 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    const crc = buf.readUInt32BE(pos + 8 + len);
    if (crc32(buf.subarray(pos + 4, pos + 8 + len)) !== crc) throw new Error(`${file}: bad CRC in ${type} chunk`);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    }
    if (type === "IDAT") idat.push(data);
    pos += 12 + len;
    if (type === "IEND") {
      sawEnd = true;
      break;
    }
  }
  if (!sawEnd || !width || !height) throw new Error(`${file}: truncated PNG`);
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType] ?? 0;
  if (bitDepth !== 8 || !channels) throw new Error(`${file}: unexpected PNG format (depth ${bitDepth}, colour type ${colorType})`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = 1 + width * channels;
  if (raw.length !== stride * height) throw new Error(`${file}: pixel data length mismatch`);
  // Sample rows across the image: a real UI has several distinct row signatures, a blank/failed render has one.
  const sigs = new Set<string>();
  for (let i = 0; i < 24; i++) {
    const row = Math.min(height - 1, Math.floor((i / 24) * height));
    sigs.add(raw.subarray(row * stride + 1, row * stride + stride).toString("base64"));
  }
  if (sigs.size < 2) throw new Error(`${file}: image is a single flat colour (blank render?)`);
  return { width, height, bytes: buf.length, distinctRowSamples: sigs.size };
}

type Env = { baseURL: string; serverTZ: string; browserTZ: string; colorScheme: string; viewport: string };

async function envOf(page: Page): Promise<Env> {
  const probe = await page.evaluate(() => ({ tz: Intl.DateTimeFormat().resolvedOptions().timeZone, dark: matchMedia("(prefers-color-scheme: dark)").matches, w: innerWidth, h: innerHeight }));
  return { baseURL: new URL(page.url()).origin, serverTZ: process.env.E2E_SERVER_TZ ?? "unspecified", browserTZ: probe.tz, colorScheme: probe.dark ? "dark" : "light", viewport: `${probe.w}x${probe.h}` };
}

function append(entry: Record<string, unknown>) {
  mkdirSync(REPORT_DIR, { recursive: true });
  appendFileSync(RESULTS, JSON.stringify({ at: new Date().toISOString(), label: LABEL, ...entry }) + "\n");
}

export type CaptureOptions = {
  /** Acceptance criterion id(s) this image is evidence for, e.g. "F1-1". */
  ac: string | string[];
  /** Folder under STUDIO-UI-ENHANCEMENT, e.g. "F1-command-palette". */
  folder: string;
  /** File name without label prefix or extension. */
  name: string;
  /** What state the image shows (what a reviewer should see). */
  note: string;
  fullPage?: boolean;
  /** Capture just this element instead of the viewport. */
  target?: Locator;
};

/** Takes a real screenshot, validates it, records it, and returns its path relative to the evidence root. */
export async function capture(page: Page, info: TestInfo, o: CaptureOptions): Promise<string> {
  const dir = join(ROOT, o.folder);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${LABEL}-${o.name}.png`);
  // Hide only the Next.js development overlay ("Compiling…" / issue badge). It is dev tooling, not product UI, and it
  // would otherwise sit on top of the sidebar in screenshots.
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  if (o.target) await o.target.screenshot({ path: file });
  else await page.screenshot({ path: file, fullPage: o.fullPage ?? false });
  expect(existsSync(file), `${file} exists`).toBe(true);
  expect(statSync(file).size).toBeGreaterThan(0);
  const png = verifyPng(file);
  const rel = relative(ROOT, file).replaceAll("\\", "/");
  append({ kind: "screenshot", ac: ([] as string[]).concat(o.ac), file: rel, note: o.note, test: info.titlePath.slice(1).join(" > "), env: await envOf(page), png });
  return rel;
}

/** Records a non-visual result (a measurement, or an expected-versus-actual comparison) against acceptance criteria. */
export function record(info: TestInfo, ac: string | string[], what: string, detail: Record<string, unknown>) {
  append({ kind: "result", ac: ([] as string[]).concat(ac), what, test: info.titlePath.slice(1).join(" > "), detail });
}
