import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Evidence for the Razorpay feature, in the same format as the API repository's tooling (its manifest builder reads these
 * files). Evidence is written only for an explicit evidence run (QA_EVIDENCE=1), only AFTER the assertion passed, and never
 * when it contains one of the run's leak sentinels (QA_SENTINELS, a JSON array of synthetic secrets held in memory).
 */

export type EvidenceLayer = "FE" | "PW" | "STATIC" | "U" | "HTTP" | "REAL";
export type EvidenceFolder = "screenshots" | "api-evidence" | "logs" | "database-evidence" | "test-results" | "playwright-report";

const FOLDERS: EvidenceFolder[] = ["screenshots", "playwright-report", "test-results", "api-evidence", "database-evidence", "logs"];

export const evidenceRoot = () => process.env.QA_EVIDENCE_DIR ?? join(process.cwd(), "artifacts", "qa-evidence", "razorpay-configuration");

export const sentinels = (): string[] => {
  const raw = process.env.QA_SENTINELS;
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.some((s) => typeof s !== "string")) throw new Error("QA_SENTINELS must be a JSON array of strings");
  return parsed as string[];
};

/** True when `bytes` holds a sentinel as plain text, base64 or URL-encoded. Never reports the value. */
export function leaks(bytes: Buffer, list = sentinels()): number {
  const text = bytes.toString("latin1");
  return list.filter((s) => text.includes(s) || text.includes(Buffer.from(s).toString("base64").replace(/=+$/, "")) || text.includes(encodeURIComponent(s))).length;
}

export type Capture = {
  acId: string;
  folder: EvidenceFolder;
  /** Must start with the criterion id. */
  fileName: string;
  layer: EvidenceLayer;
  environment: "unit" | "pglite" | "local-stack" | "hosted";
  actualResult: string;
  testName: string;
  testFile: string;
  /** Runs first; when it throws, nothing is written. */
  assert: () => void | Promise<void>;
  /** May be async (a screenshot is taken here, after the assertion passed). */
  content: () => string | Buffer | object | Promise<string | Buffer | object>;
};

export async function capture(c: Capture): Promise<{ written: boolean; file?: string }> {
  if (!/^AC-[A-Z]+-\d+[a-z]?$/.test(c.acId) || !c.fileName.startsWith(c.acId) || /[\\/]/.test(c.fileName)) throw new Error("invalid evidence name");
  await c.assert();
  if (process.env.QA_EVIDENCE !== "1") return { written: false };
  const list = sentinels();
  if (list.length === 0) throw new Error("QA_SENTINELS is required for an evidence run: no evidence is written without leak protection");
  const produced = await c.content();
  const bytes = typeof produced === "string" ? Buffer.from(produced, "utf8") : Buffer.isBuffer(produced) ? produced : Buffer.from(`${JSON.stringify(produced, null, 2)}\n`, "utf8");
  if (leaks(bytes, list) > 0) throw new Error(`evidence for ${c.acId} contains a leak sentinel; nothing was written`);
  const entry = {
    acId: c.acId,
    artifact: `${c.folder}/${c.fileName}`,
    testName: c.testName,
    testFile: c.testFile.replace(/\\/g, "/"),
    layer: c.layer,
    environment: c.environment,
    actualResult: c.actualResult,
    timestamp: new Date().toISOString(),
  };
  const line = `${JSON.stringify(entry)}\n`;
  if (leaks(Buffer.from(line), list) > 0) throw new Error(`evidence entry for ${c.acId} contains a leak sentinel; nothing was written`);
  const root = evidenceRoot();
  for (const f of [...FOLDERS, "summary"]) mkdirSync(join(root, f), { recursive: true });
  writeFileSync(join(root, c.folder, c.fileName), bytes);
  appendFileSync(join(root, "summary", "evidence-entries.jsonl"), line);
  return { written: true, file: entry.artifact };
}
